// Sistema de clonagem avançado - CloneWeb2Zip
const axios = require('axios');
const cheerio = require('cheerio');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const os = require('os');
const puppeteer = require('puppeteer');
// const pLimit = require('p-limit'); // Removido temporariamente
const sharp = require('sharp');
const CleanCSS = require('clean-css');
const UglifyJS = require('uglify-js');
const crypto = require('crypto');
const config = require('./config');
const logger = require('./logger');

// Configurações padrão vindas do arquivo de config
const DEFAULT_OPTIONS = config.cloning;

// Cache global para evitar downloads duplicados
const downloadCache = new Map();

// Implementação simples de limitação de concorrência
class ConcurrencyLimiter {
  constructor(limit) {
    this.limit = limit;
    this.running = 0;
    this.queue = [];
  }

  async add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        fn,
        resolve,
        reject
      });
      this.process();
    });
  }

  async process() {
    if (this.running >= this.limit || this.queue.length === 0) {
      return;
    }

    this.running++;
    const { fn, resolve, reject } = this.queue.shift();

    try {
      const result = await fn();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.running--;
      this.process();
    }
  }
}

// Classe principal do clonador
class WebCloner {
  constructor(options = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.tempDir = null;
    this.baseUrl = null;
    this.downloadedFiles = new Set();
    this.processedUrls = new Set();
    this.downloadQueue = [];
    this.errors = [];
    this.stats = {
      totalFiles: 0,
      downloadedFiles: 0,
      optimizedFiles: 0,
      totalSize: 0,
      startTime: null,
      endTime: null
    };
    this.progressCallback = null;
    
    // Usar nossa implementação personalizada de limitação de concorrência
    this.limiter = new ConcurrencyLimiter(this.options.concurrency);
  }

  // Função para atualizar progresso
  updateProgress(status, etapa, progresso = 0, extra = {}) {
    if (this.progressCallback) {
      this.progressCallback({
        status,
        etapa,
        progresso: Math.min(100, Math.max(0, progresso)),
        totalArquivos: this.stats.totalFiles,
        arquivosBaixados: this.stats.downloadedFiles,
        erros: this.errors.length,
        ...extra
      });
    }
  }

  // Gerar hash para cache
  getCacheKey(url) {
    return crypto.createHash('md5').update(url).digest('hex');
  }

  // Normalizar URLs
  normalizeUrl(url, baseUrl) {
    try {
      return new URL(url, baseUrl).href;
    } catch {
      return null;
    }
  }

  // Verificar se é uma imagem
  isImage(url) {
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];
    const urlPath = new URL(url).pathname.toLowerCase();
    return imageExts.some(ext => urlPath.endsWith(ext));
  }

  // Verificar se é CSS
  isCSS(url) {
    return new URL(url).pathname.toLowerCase().endsWith('.css');
  }

  // Verificar se é JavaScript
  isJS(url) {
    const jsExts = ['.js', '.mjs'];
    const urlPath = new URL(url).pathname.toLowerCase();
    return jsExts.some(ext => urlPath.endsWith(ext));
  }

  // Download com retry e otimização
  async downloadWithRetry(url, destPath, maxRetries = null) {
    maxRetries = maxRetries || this.options.retryAttempts;

    const cacheKey = this.getCacheKey(url);
    if (downloadCache.has(cacheKey)) {
      const cachedPath = downloadCache.get(cacheKey);
      if (fs.existsSync(cachedPath)) {
        fs.copyFileSync(cachedPath, destPath);
        return;
      }
    }

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await this.downloadFile(url, destPath);

        // Otimizar arquivo se necessário
        if (this.options.optimizeImages && this.isImage(url)) {
          await this.optimizeImage(destPath);
          this.stats.optimizedFiles++;
        } else if (this.options.minifyCode && this.isCSS(url)) {
          await this.minifyCSS(destPath);
          this.stats.optimizedFiles++;
        } else if (this.options.minifyCode && this.isJS(url)) {
          await this.minifyJS(destPath);
          this.stats.optimizedFiles++;
        }

        // Adicionar ao cache
        downloadCache.set(cacheKey, destPath);
        this.stats.downloadedFiles++;
        return;

      } catch (error) {
        if (attempt === maxRetries - 1) {
          this.errors.push({ url, error: error.message });
          throw error;
        }
        // Backoff exponencial
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  // Download básico de arquivo
  async downloadFile(url, destPath) {
    logger.downloadStart(url, destPath);

    const writer = fs.createWriteStream(destPath);

    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      timeout: this.options.timeout,
      headers: {
        'User-Agent': this.options.userAgent,
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive'
      },
      maxRedirects: this.options.followRedirects ? 5 : 0
    });

    return new Promise((resolve, reject) => {
      response.data.pipe(writer);

      let downloadedBytes = 0;
      response.data.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        this.stats.totalSize += chunk.length;

        // Verificar limite de tamanho
        if (this.stats.totalSize > this.options.maxSize) {
          writer.destroy();
          reject(new Error('Limite de tamanho excedido'));
        }
      });

      writer.on('finish', () => {
        logger.downloadComplete(url, destPath, downloadedBytes);
        resolve();
      });

      writer.on('error', (error) => {
        logger.downloadError(url, error);
        reject(error);
      });
    });
  }

  // Otimizar imagem
  async optimizeImage(imagePath) {
    try {
      const ext = path.extname(imagePath).toLowerCase();
      const tempPath = imagePath + '.tmp';

      if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
        await sharp(imagePath)
          .resize(1920, 1080, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ quality: 85 })
          .png({ compressionLevel: 9 })
          .webp({ quality: 85 })
          .toFile(tempPath);

        // Substituir apenas se o arquivo otimizado for menor
        const originalSize = fs.statSync(imagePath).size;
        const optimizedSize = fs.statSync(tempPath).size;

        if (optimizedSize < originalSize) {
          fs.renameSync(tempPath, imagePath);
          logger.optimization('image', imagePath, originalSize, optimizedSize);
        } else {
          fs.unlinkSync(tempPath);
        }
      }
    } catch (error) {
      console.warn(`Falha ao otimizar imagem ${imagePath}: ${error.message}`);
    }
  }

  // Minificar CSS
  async minifyCSS(cssPath) {
    try {
      const css = fs.readFileSync(cssPath, 'utf8');
      const result = new CleanCSS({
        level: 2,
        returnPromise: false
      }).minify(css);

      if (!result.errors.length) {
        fs.writeFileSync(cssPath, result.styles);
      }
    } catch (error) {
      console.warn(`Falha ao minificar CSS ${cssPath}: ${error.message}`);
    }
  }

  // Minificar JavaScript
  async minifyJS(jsPath) {
    try {
      const js = fs.readFileSync(jsPath, 'utf8');
      const result = UglifyJS.minify(js, {
        compress: {
          drop_console: false,
          drop_debugger: true
        },
        mangle: true
      });

      if (!result.error) {
        fs.writeFileSync(jsPath, result.code);
      }
    } catch (error) {
      console.warn(`Falha ao minificar JS ${jsPath}: ${error.message}`);
    }
  }

  // Extrair recursos de uma página usando Puppeteer
  async extractResourcesWithPuppeteer(url) {
    let browser = null;
    try {
      browser = await puppeteer.launch(config.puppeteer);

      const page = await browser.newPage();

      // Configurar viewport e user agent
      await page.setViewport(config.puppeteer.defaultViewport);
      await page.setUserAgent(this.options.userAgent);

      // Interceptar requests para coletar recursos
      const resources = new Set();

      page.on('response', response => {
        const url = response.url();
        const contentType = response.headers()['content-type'] || '';

        if (contentType.includes('text/css') ||
          contentType.includes('javascript') ||
          contentType.includes('image/') ||
          contentType.includes('font/') ||
          url.match(/\.(css|js|png|jpg|jpeg|gif|webp|svg|woff|woff2|ttf|eot)$/i)) {
          resources.add(url);
        }
      });

      // Navegar para a página
      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: this.options.timeout
      });

      // Aguardar um pouco mais para lazy loading
      await page.waitForTimeout(2000);

      // Extrair HTML renderizado
      const html = await page.content();

      // Extrair recursos adicionais do DOM
      const domResources = await page.evaluate(() => {
        const resources = new Set();

        // Imagens (incluindo lazy loading)
        document.querySelectorAll('img').forEach(img => {
          [img.src, img.dataset.src, img.dataset.lazy].forEach(src => {
            if (src && src.startsWith('http')) resources.add(src);
          });
        });

        // CSS
        document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
          if (link.href) resources.add(link.href);
        });

        // JavaScript
        document.querySelectorAll('script[src]').forEach(script => {
          if (script.src) resources.add(script.src);
        });

        // Outros recursos
        document.querySelectorAll('source, video, audio, iframe').forEach(el => {
          if (el.src) resources.add(el.src);
        });

        // Fontes e ícones
        document.querySelectorAll('link[rel*="icon"]').forEach(link => {
          if (link.href) resources.add(link.href);
        });

        return Array.from(resources);
      });

      domResources.forEach(resource => resources.add(resource));

      return { html, resources: Array.from(resources) };

    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  // Extrair recursos usando Cheerio (fallback)
  extractResourcesWithCheerio(html, baseUrl) {
    const $ = cheerio.load(html);
    const resources = new Set();

    // Seletores para diferentes tipos de recursos
    const selectors = config.resourceSelectors;

    selectors.forEach(selector => {
      $(selector).each((_, el) => {
        const $el = $(el);
        const src = $el.attr('src') || $el.attr('href') || $el.attr('data-src') || $el.attr('data-lazy') || $el.attr('data') || $el.attr('poster');

        if (src) {
          const normalizedUrl = this.normalizeUrl(src, baseUrl);
          if (normalizedUrl) {
            resources.add(normalizedUrl);
          }
        }

        // Processar srcset
        const srcset = $el.attr('srcset');
        if (srcset) {
          srcset.split(',').forEach(src => {
            const url = src.trim().split(' ')[0];
            const normalizedUrl = this.normalizeUrl(url, baseUrl);
            if (normalizedUrl) {
              resources.add(normalizedUrl);
            }
          });
        }
      });
    });

    // Extrair URLs de CSS inline
    $('[style]').each((_, el) => {
      const style = $(el).attr('style');
      const urlMatches = style.match(/url\(['"]?([^'")]+)['"]?\)/g);
      if (urlMatches) {
        urlMatches.forEach(match => {
          const url = match.replace(/url\(['"]?([^'")]+)['"]?\)/, '$1');
          const normalizedUrl = this.normalizeUrl(url, baseUrl);
          if (normalizedUrl) {
            resources.add(normalizedUrl);
          }
        });
      }
    });

    return Array.from(resources);
  }

  // Processar arquivo CSS para extrair recursos
  async processCSSFile(cssPath, cssUrl) {
    try {
      const css = fs.readFileSync(cssPath, 'utf8');
      const urlRegex = /url\(['"]?([^'")]+)['"]?\)/g;
      const resources = [];
      let match;

      while ((match = urlRegex.exec(css)) !== null) {
        const resourceUrl = match[1];
        if (!resourceUrl.startsWith('data:')) {
          const normalizedUrl = this.normalizeUrl(resourceUrl, cssUrl);
          if (normalizedUrl) {
            resources.push(normalizedUrl);
          }
        }
      }

      return resources;
    } catch (error) {
      console.warn(`Erro ao processar CSS ${cssPath}: ${error.message}`);
      return [];
    }
  }

  // Gerar caminho de destino para um recurso
  generateDestPath(url, baseUrl) {
    try {
      const urlObj = new URL(url);
      let relativePath;

      if (url.startsWith(baseUrl)) {
        // Recurso interno
        relativePath = urlObj.pathname.replace(/^\//, '') || 'index.html';
      } else {
        // Recurso externo
        if (this.options.includeExternals) {
          relativePath = path.join('_externos', urlObj.hostname, urlObj.pathname.replace(/^\//, ''));
        } else {
          return null;
        }
      }

      // Garantir extensão para páginas HTML
      if (!path.extname(relativePath) && !relativePath.includes('?')) {
        relativePath += '.html';
      }

      // Limpar query parameters do nome do arquivo
      relativePath = relativePath.split('?')[0];

      return relativePath;
    } catch {
      return null;
    }
  }

  // Função principal de clonagem
  async clonarESzipar({ url, renameAssets, simpleDownload, mobileVersion, saveStructure, returnTempDir, progresso }) {
    this.stats.startTime = Date.now();
    this.progressCallback = (progress) => {
      if (progresso) {
        Object.assign(progresso, progress);
      }
      logger.cloneProgress(url, progress);
    };

    logger.cloneStart(url, { renameAssets, simpleDownload, mobileVersion, saveStructure });

    try {
      // Inicialização
      this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cloneweb2zip-advanced-'));
      this.baseUrl = new URL(url).origin;

      this.updateProgress('iniciando', 'Inicializando sistema de clonagem...', 5);

      // Extrair recursos da página principal
      this.updateProgress('analisando', 'Analisando página principal...', 10);

      let mainPageData;
      try {
        // Tentar com Puppeteer primeiro para SPAs
        mainPageData = await this.extractResourcesWithPuppeteer(url);
      } catch (error) {
        logger.warn('Puppeteer falhou, usando Cheerio como fallback', { error: error.message });
        // Fallback para Cheerio
        try {
          const response = await axios.get(url, {
            headers: { 'User-Agent': this.options.userAgent },
            timeout: this.options.timeout
          });
          mainPageData = {
            html: response.data,
            resources: this.extractResourcesWithCheerio(response.data, url)
          };
        } catch (fallbackError) {
          logger.error('Falha também no fallback Cheerio', { error: fallbackError.message });
          throw new Error(`Não foi possível acessar a página: ${fallbackError.message}`);
        }
      }

      // Salvar página principal
      const mainPagePath = path.join(this.tempDir, 'index.html');
      fs.writeFileSync(mainPagePath, mainPageData.html);

      // Coletar todos os recursos
      const allResources = new Set(mainPageData.resources);
      this.stats.totalFiles = allResources.size + 1; // +1 para a página principal

      this.updateProgress('coletando', 'Coletando lista de recursos...', 20);

      // Processar recursos em lotes paralelos
      const resourceBatches = Array.from(allResources).map(resourceUrl => {
        return this.limiter.add(async () => {
          const destPath = this.generateDestPath(resourceUrl, this.baseUrl);
          if (!destPath) return;

          const fullDestPath = path.join(this.tempDir, destPath);
          fs.mkdirSync(path.dirname(fullDestPath), { recursive: true });

          try {
            await this.downloadWithRetry(resourceUrl, fullDestPath);

            // Se for CSS, processar recursos internos
            if (this.isCSS(resourceUrl)) {
              const cssResources = await this.processCSSFile(fullDestPath, resourceUrl);
              for (const cssResource of cssResources) {
                const cssDestPath = this.generateDestPath(cssResource, this.baseUrl);
                if (cssDestPath) {
                  const cssFullDestPath = path.join(this.tempDir, cssDestPath);
                  fs.mkdirSync(path.dirname(cssFullDestPath), { recursive: true });
                  try {
                    await this.downloadWithRetry(cssResource, cssFullDestPath);
                  } catch (error) {
                    console.warn(`Erro ao baixar recurso CSS ${cssResource}: ${error.message}`);
                  }
                }
              }
            }

            // Atualizar progresso
            const progress = 20 + (this.stats.downloadedFiles / this.stats.totalFiles) * 60;
            this.updateProgress('baixando', `Baixando recursos... (${this.stats.downloadedFiles}/${this.stats.totalFiles})`, progress);

          } catch (error) {
            console.warn(`Erro ao baixar ${resourceUrl}: ${error.message}`);
          }
        });
      });

      // Executar downloads
      await Promise.allSettled(resourceBatches);

      this.updateProgress('processando', 'Processando e otimizando arquivos...', 85);

      // Reescrever URLs nos arquivos HTML e CSS
      await this.rewriteUrls();

      // Tirar screenshot
      await this.takeScreenshot(url);

      this.updateProgress('compactando', 'Criando arquivo ZIP...', 95);

      // Criar ZIP
      const zipPath = await this.createZip();

      this.stats.endTime = Date.now();
      const duration = (this.stats.endTime - this.stats.startTime) / 1000;

      const finalStats = {
        arquivosOtimizados: this.stats.optimizedFiles,
        tamanhoTotal: this.formatBytes(this.stats.totalSize),
        duracao: `${duration.toFixed(1)}s`,
        totalFiles: this.stats.totalFiles,
        downloadedFiles: this.stats.downloadedFiles,
        errors: this.errors.length
      };

      this.updateProgress('concluido', `Clonagem concluída em ${duration.toFixed(1)}s`, 100, finalStats);

      logger.cloneComplete(url, finalStats);

      if (returnTempDir) {
        return { zipPath, tempDir: this.tempDir };
      }
      return zipPath;

    } catch (error) {
      logger.cloneError(url, error);
      this.updateProgress('erro', `Erro durante clonagem: ${error.message}`, 0);
      throw error;
    }
  }

  // Reescrever URLs nos arquivos
  async rewriteUrls() {
    const htmlFiles = this.findFiles(this.tempDir, '.html');
    const cssFiles = this.findFiles(this.tempDir, '.css');

    // Processar arquivos HTML
    for (const htmlFile of htmlFiles) {
      try {
        let html = fs.readFileSync(htmlFile, 'utf8');
        const $ = cheerio.load(html);

        // Reescrever URLs de recursos
        $('img, script, link, source, video, audio, iframe').each((_, el) => {
          const $el = $(el);
          ['src', 'href', 'data-src', 'data-lazy'].forEach(attr => {
            const url = $el.attr(attr);
            if (url && url.startsWith('http')) {
              const newPath = this.generateDestPath(url, this.baseUrl);
              if (newPath) {
                $el.attr(attr, newPath);
              }
            }
          });
        });

        fs.writeFileSync(htmlFile, $.html());
      } catch (error) {
        console.warn(`Erro ao reescrever URLs em ${htmlFile}: ${error.message}`);
      }
    }

    // Processar arquivos CSS
    for (const cssFile of cssFiles) {
      try {
        let css = fs.readFileSync(cssFile, 'utf8');
        css = css.replace(/url\(['"]?([^'")]+)['"]?\)/g, (match, url) => {
          if (url.startsWith('data:')) return match;

          const normalizedUrl = this.normalizeUrl(url, this.baseUrl);
          if (normalizedUrl) {
            const newPath = this.generateDestPath(normalizedUrl, this.baseUrl);
            if (newPath) {
              return `url('${newPath}')`;
            }
          }
          return match;
        });

        fs.writeFileSync(cssFile, css);
      } catch (error) {
        console.warn(`Erro ao reescrever URLs em ${cssFile}: ${error.message}`);
      }
    }
  }

  // Encontrar arquivos por extensão
  findFiles(dir, extension) {
    const files = [];

    function walk(currentDir) {
      const items = fs.readdirSync(currentDir);
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (fullPath.endsWith(extension)) {
          files.push(fullPath);
        }
      }
    }

    walk(dir);
    return files;
  }

  // Tirar screenshot
  async takeScreenshot(url) {
    let browser = null;
    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      const screenshotPath = path.join(this.tempDir, 'screenshot.png');
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
        type: 'png'
      });

      // Otimizar screenshot se habilitado
      if (this.options.optimizeImages) {
        await this.optimizeImage(screenshotPath);
      }

    } catch (error) {
      console.warn(`Erro ao tirar screenshot: ${error.message}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  // Criar arquivo ZIP
  async createZip() {
    const STORAGE_DIR = path.join(__dirname, '../storage');
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }

    const zipName = `site-clonado-${Date.now()}-${Math.floor(Math.random() * 1e6)}.zip`;
    const zipPath = path.join(STORAGE_DIR, zipName);

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', {
        zlib: { level: 9 },
        store: false
      });

      output.on('close', () => resolve(zipPath));
      archive.on('error', reject);

      archive.pipe(output);
      archive.directory(this.tempDir, false);
      archive.finalize();
    });
  }

  // Formatar bytes
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Função de limpeza automática melhorada
function limparZipsAntigos() {
  const dir = path.join(__dirname, '../storage');

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    return;
  }

  try {
    const files = fs.readdirSync(dir);
    const agora = Date.now();
    let removedCount = 0;

    for (const file of files) {
      if (file.endsWith('.zip')) {
        const filePath = path.join(dir, file);
        try {
          const stats = fs.statSync(filePath);
          if (agora - stats.mtimeMs > 7 * 24 * 60 * 60 * 1000) {
            fs.unlinkSync(filePath);
            removedCount++;
          }
        } catch (error) {
          console.warn(`Erro ao processar arquivo ${file}: ${error.message}`);
        }
      }
    }

    if (removedCount > 0) {
      console.log(`[LIMPEZA] ${removedCount} arquivos ZIP antigos removidos`);
    }
  } catch (error) {
    console.error(`[ERRO] Falha na limpeza automática: ${error.message}`);
  }
}

// Função wrapper para compatibilidade
async function clonarESzipar(options) {
  const cloner = new WebCloner({
    optimizeImages: !options.simpleDownload,
    minifyCode: !options.simpleDownload,
    includeExternals: true,
    maxDepth: options.saveStructure ? 3 : 1
  });

  return await cloner.clonarESzipar(options);
}

// Executar limpeza a cada 12 horas
setInterval(limparZipsAntigos, 12 * 60 * 60 * 1000);
limparZipsAntigos();

module.exports = { clonarESzipar, WebCloner };