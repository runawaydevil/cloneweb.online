const axios = require('axios');
const cheerio = require('cheerio');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const os = require('os');

// Função utilitária para baixar arquivos
async function baixarArquivo(url, destino) {
  const writer = fs.createWriteStream(destino);
  let response;
  try {
    response = await axios({ url, method: 'GET', responseType: 'stream' });
  } catch (err) {
    console.error(`[ERRO] Falha ao baixar arquivo: ${url}\nMotivo: ${err.message}`);
    throw err;
  }
  return new Promise((resolve, reject) => {
    response.data.pipe(writer);
    let error = null;
    writer.on('error', err => {
      error = err;
      writer.close();
      console.error(`[ERRO] Falha ao salvar arquivo: ${destino}\nMotivo: ${err.message}`);
      reject(err);
    });
    writer.on('close', () => {
      if (!error) {
        console.log(`[OK] Arquivo salvo: ${destino}`);
        resolve();
      }
    });
  });
}

// Função principal: clonar o site e zipar
async function clonarESzipar({ url, renameAssets, simpleDownload, mobileVersion, saveStructure, returnTempDir }) {
  // Pasta temporária para salvar arquivos
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cloneweb2zip-'));
  const arquivosBaixados = new Set();
  const fila = [url];
  const baseUrl = new URL(url).origin;

  // Função para normalizar URLs relativas
  function normalizar(link, paginaAtual) {
    try {
      return new URL(link, paginaAtual).href;
    } catch {
      return null;
    }
  }

  // Função para baixar e salvar um arquivo se ainda não baixado
  async function baixarSeNovo(link, destinoRel) {
    if (arquivosBaixados.has(link)) return;
    arquivosBaixados.add(link);
    const destinoAbs = path.join(tempDir, destinoRel);
    fs.mkdirSync(path.dirname(destinoAbs), { recursive: true });
    await baixarArquivo(link, destinoAbs);
  }

  // Escaneia recursivamente páginas e assets
  while (fila.length > 0) {
    const paginaUrl = fila.shift();
    // Remover restrição de domínio para assets, mas manter para recursão de páginas
    if (!paginaUrl.startsWith(baseUrl)) continue; // só clona o mesmo domínio para páginas
    if (arquivosBaixados.has(paginaUrl)) continue;
    arquivosBaixados.add(paginaUrl);
    let html;
    try {
      const resp = await axios.get(paginaUrl);
      html = resp.data;
      console.log(`[OK] Página baixada: ${paginaUrl}`);
    } catch (e) {
      console.error(`[ERRO] Falha ao baixar página: ${paginaUrl}\nMotivo: ${e.message}`);
      continue;
    }
    // Salva HTML
    let relPath = paginaUrl.replace(baseUrl, '').replace(/^[\/]/, '') || 'index.html';
    if (!relPath.endsWith('.html')) relPath += '.html';
    const absPath = path.join(tempDir, relPath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, html);
    // Escaneia assets
    const $ = cheerio.load(html);
    const assets = [];
    $('img[src], script[src], link[rel="stylesheet"][href], source[src], video[src], audio[src]').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('href');
      if (src) assets.push(normalizar(src, paginaUrl));
    });
    // Busca links internos para recursão
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      const linkAbs = normalizar(href, paginaUrl);
      if (linkAbs && linkAbs.startsWith(baseUrl) && !arquivosBaixados.has(linkAbs)) {
        fila.push(linkAbs);
      }
    });
    // Baixa assets (agora permite externos)
    for (const asset of assets) {
      if (!asset || !asset.startsWith('http')) continue;
      let assetRel;
      if (asset.startsWith(baseUrl)) {
        assetRel = asset.replace(baseUrl, '').replace(/^[\/]/, '');
        if (!assetRel) assetRel = path.basename(asset);
      } else {
        // Para recursos externos, salva em _externos/<domínio>/<path>
        const extUrl = new URL(asset);
        assetRel = path.join('_externos', extUrl.hostname, extUrl.pathname.replace(/^\//, ''));
        if (assetRel.endsWith('/')) assetRel += 'index';
      }
      await baixarSeNovo(asset, assetRel);
    }
  }

  // Após baixar tudo, buscar imagens/fontes em CSS
  // (também permite externos)
  const cssFiles = Array.from(arquivosBaixados).filter(f => f.endsWith('.css'));
  const urlRegex = /url\((['"]?)([^'"\)]+)\1\)/g;
  for (const cssUrl of cssFiles) {
    let cssRel = cssUrl.replace(baseUrl, '').replace(/^[\/]/, '');
    if (!cssRel) cssRel = path.basename(cssUrl);
    const cssPath = path.join(tempDir, cssRel);
    if (!fs.existsSync(cssPath)) continue;
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    let match;
    while ((match = urlRegex.exec(cssContent)) !== null) {
      let assetUrl = match[2];
      if (assetUrl.startsWith('data:')) continue;
      const assetAbs = normalizar(assetUrl, cssUrl);
      if (!assetAbs || !assetAbs.startsWith('http')) continue;
      let assetRel;
      if (assetAbs.startsWith(baseUrl)) {
        assetRel = assetAbs.replace(baseUrl, '').replace(/^[\/]/, '');
        if (!assetRel) assetRel = path.basename(assetAbs);
      } else {
        const extUrl = new URL(assetAbs);
        assetRel = path.join('_externos', extUrl.hostname, extUrl.pathname.replace(/^\//, ''));
        if (assetRel.endsWith('/')) assetRel += 'index';
      }
      await baixarSeNovo(assetAbs, assetRel);
    }
  }

  // Após baixar tudo, preparar lista de HTMLs para uso em todos os trechos seguintes
  const htmlFiles = [];
  function walk(dir) {
    for (const file of fs.readdirSync(dir)) {
      const full = path.join(dir, file);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (file.endsWith('.html')) htmlFiles.push(full);
    }
  }
  walk(tempDir);

  // Buscar por URLs em scripts inline e arquivos JS
  const jsFiles = [];
  function walkJs(dir) {
    for (const file of fs.readdirSync(dir)) {
      const full = path.join(dir, file);
      if (fs.statSync(full).isDirectory()) walkJs(full);
      else if (file.endsWith('.js')) jsFiles.push(full);
    }
  }
  walkJs(tempDir);
  // Regex para capturar URLs de arquivos comuns
  const urlAssetRegex = /(["'])(https?:\/\/[^"'\s]+\.(?:png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|otf|json|mp4|webm|ogg|mp3|wav|pdf|zip|csv|xml|txt))["']/gi;
  // Buscar em arquivos JS
  for (const jsPath of jsFiles) {
    const jsContent = fs.readFileSync(jsPath, 'utf8');
    let match;
    while ((match = urlAssetRegex.exec(jsContent)) !== null) {
      const assetAbs = match[2];
      if (!assetAbs.startsWith('http')) continue;
      let assetRel;
      if (assetAbs.startsWith(baseUrl)) {
        assetRel = assetAbs.replace(baseUrl, '').replace(/^[\/]/, '');
        if (!assetRel) assetRel = path.basename(assetAbs);
      } else {
        const extUrl = new URL(assetAbs);
        assetRel = path.join('_externos', extUrl.hostname, extUrl.pathname.replace(/^\//, ''));
        if (assetRel.endsWith('/')) assetRel += 'index';
      }
      await baixarSeNovo(assetAbs, assetRel);
    }
  }
  // Buscar em scripts inline dos HTMLs
  for (const htmlPath of htmlFiles) {
    const html = fs.readFileSync(htmlPath, 'utf8');
    let match;
    while ((match = urlAssetRegex.exec(html)) !== null) {
      const assetAbs = match[2];
      if (!assetAbs.startsWith('http')) continue;
      let assetRel;
      if (assetAbs.startsWith(baseUrl)) {
        assetRel = assetAbs.replace(baseUrl, '').replace(/^[\/]/, '');
        if (!assetRel) assetRel = path.basename(assetAbs);
      } else {
        const extUrl = new URL(assetAbs);
        assetRel = path.join('_externos', extUrl.hostname, extUrl.pathname.replace(/^\//, ''));
        if (assetRel.endsWith('/')) assetRel += 'index';
      }
      await baixarSeNovo(assetAbs, assetRel);
    }
  }

  // Preparar lista de HTMLs antes de buscar por assets em JS/scripts inline
  // Remover duplicidade da declaração de htmlFiles e walk mais abaixo

  // Reescrever caminhos nos HTMLs e CSSs para apontar para arquivos locais
  function ajustarCaminhoAsset(assetUrl) {
    if (!assetUrl || assetUrl.startsWith('data:')) return assetUrl;
    try {
      const abs = normalizar(assetUrl, url);
      if (!abs.startsWith('http')) return assetUrl;
      if (abs.startsWith(baseUrl)) {
        let rel = abs.replace(baseUrl, '').replace(/^[\/]/, '');
        if (!rel) rel = path.basename(abs);
        return rel;
      } else {
        const extUrl = new URL(abs);
        let rel = path.join('_externos', extUrl.hostname, extUrl.pathname.replace(/^\//, ''));
        if (rel.endsWith('/')) rel += 'index';
        return rel;
      }
    } catch {
      return assetUrl;
    }
  }

  // Atualizar HTMLs
  for (const htmlPath of htmlFiles) {
    let html = fs.readFileSync(htmlPath, 'utf8');
    // Atualiza src/href de assets
    html = html.replace(/(<(?:img|script|source|video|audio)[^>]+(?:src|href)=["'])([^"'>]+)(["'])/gi, (m, p1, p2, p3) => {
      return p1 + ajustarCaminhoAsset(p2) + p3;
    });
    // Atualiza links de CSS
    html = html.replace(/(<link[^>]+href=["'])([^"'>]+)(["'])/gi, (m, p1, p2, p3) => {
      return p1 + ajustarCaminhoAsset(p2) + p3;
    });
    // Atualiza links internos (a href)
    html = html.replace(/(<a[^>]+href=["'])([^"'>]+)(["'])/gi, (m, p1, p2, p3) => {
      const abs = normalizar(p2, url);
      if (abs && abs.startsWith(baseUrl)) {
        let rel = abs.replace(baseUrl, '').replace(/^[\/]/, '');
        if (!rel) rel = 'index.html';
        if (!rel.endsWith('.html')) rel += '.html';
        return p1 + rel + p3;
      }
      return m;
    });
    fs.writeFileSync(htmlPath, html);
  }
  // Atualizar CSSs
  const cssFilesPaths = [];
  function walkCss(dir) {
    for (const file of fs.readdirSync(dir)) {
      const full = path.join(dir, file);
      if (fs.statSync(full).isDirectory()) walkCss(full);
      else if (file.endsWith('.css')) cssFilesPaths.push(full);
    }
  }
  walkCss(tempDir);
  for (const cssPath of cssFilesPaths) {
    let css = fs.readFileSync(cssPath, 'utf8');
    css = css.replace(/url\((['"]?)([^'"\)]+)\1\)/g, (m, q, p2) => {
      return `url(${q}${ajustarCaminhoAsset(p2)}${q})`;
    });
    fs.writeFileSync(cssPath, css);
  }

  // Cria o ZIP
  const STORAGE_DIR = path.join(__dirname, '../storage');
  if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR);
  const zipName = `site-clonado-${Date.now()}-${Math.floor(Math.random()*1e6)}.zip`;
  const zipPath = path.join(STORAGE_DIR, zipName);
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', () => {
      console.log(`[OK] ZIP criado: ${zipPath}`);
      resolve();
    });
    archive.on('error', err => {
      console.error(`[ERRO] Falha ao criar ZIP: ${zipPath}\nMotivo: ${err.message}`);
      reject(err);
    });
    archive.pipe(output);
    archive.directory(tempDir, false);
    archive.finalize();
  });
  if (returnTempDir) {
    return { zipPath, tempDir };
  }
  return zipPath;
}

// Limpeza automática de ZIPs antigos (mais de 7 dias)
function limparZipsAntigos() {
  const dir = path.join(__dirname, '../storage');
  const files = fs.readdirSync(dir);
  const agora = Date.now();
  for (const file of files) {
    if (file.endsWith('.zip')) {
      const filePath = path.join(dir, file);
      try {
        const stats = fs.statSync(filePath);
        if (agora - stats.mtimeMs > 7 * 24 * 60 * 60 * 1000) {
          fs.unlinkSync(filePath);
        }
      } catch {}
    }
  }
}
// Executa a limpeza a cada 12 horas
setInterval(limparZipsAntigos, 12 * 60 * 60 * 1000);
limparZipsAntigos();

module.exports = { clonarESzipar }; 