// Sistema de clonagem simplificado - sem dependências opcionais
const axios = require('axios');
const cheerio = require('cheerio');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const os = require('os');
const crypto = require('crypto');

// Configurações básicas
const DEFAULT_OPTIONS = {
  maxFiles: 1000,
  maxSize: 100 * 1024 * 1024, // 100MB
  timeout: 30000,
  concurrency: 3,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

// Cache para evitar downloads duplicados
const downloadCache = new Map();

// Limitador de concorrência simples
class SimpleLimiter {
  constructor(limit) {
    this.limit = limit;
    this.running = 0;
    this.queue = [];
  }

  async add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.running >= this.limit || this.queue.length === 0) return;
    
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

class SimpleCloner {
  constructor(options = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.tempDir = null;
    this.baseUrl = null;
    this.downloadedFiles = new Set();
    this.errors = [];
    this.stats = {
      totalFiles: 0,
      downloadedFiles: 0,
      totalSize: 0,
      startTime: null
    };
    this.progressCallback = null;
    this.limiter = new SimpleLimiter(this.options.concurrency);
  }

  updateProgress(status, etapa, progresso = 0) {
    if (this.progressCallback) {
      this.progressCallback({
        status,
        etapa,
        progresso: Math.min(100, Math.max(0, progresso)),
        totalArquivos: this.stats.totalFiles,
        arquivosBaixados: this.stats.downloadedFiles,
        erros: this.errors.length
      });
    }
  }

  normalizeUrl(url, baseUrl) {
    try {
      return new URL(url, baseUrl).href;
    } catch {
      return null;
    }
  }

  generateDestPath(url, baseUrl) {
    try {
      const urlObj = new URL(url);
      let relativePath;

      if (url.startsWith(baseUrl)) {
        relativePath = urlObj.pathname.replace(/^\//, '') || 'index.html';
      } else {
        relativePath = path.join('_externos', urlObj.hostname, urlObj.pathname.replace(/^\//, ''));
      }

      if (!path.extname(relativePath) && !relativePath.includes('?')) {
        relativePath += '.html';
      }

      return relativePath.split('?')[0];
    } catch {
      return null;
    }
  }

  async downloadFile(url, destPath) {
    const cacheKey = crypto.createHash('md5').update(url).digest('hex');
    
    if (downloadCache.has(cacheKey)) {
      const cachedPath = downloadCache.get(cacheKey);
      if (fs.existsSync(cachedPath)) {
        fs.copyFileSync(cachedPath, destPath);
        return;
      }
    }

    const writer = fs.createWriteStream(destPath);
    
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      timeout: this.options.timeout,
      headers: {
        'User-Agent': this.options.userAgent,
        'Accept': '*/*'
      },
      maxRedirects: 5
    });

    return new Promise((resolve, reject) => {
      response.data.pipe(writer);
      
      let downloadedBytes = 0;
      response.data.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        this.stats.totalSize += chunk.length;
        
        if (this.stats.totalSize > this.options.maxSize) {
          writer.destroy();
          reject(new Error('Limite de tamanho excedido'));
        }
      });

      writer.on('finish', () => {
        downloadCache.set(cacheKey, destPath);
        this.stats.downloadedFiles++;
        resolve();
      });
      
      writer.on('error', reject);
    });
  }

  extractResources(html, baseUrl) {
    const $ = cheerio.load(html);
    const resources = new Set();

    const selectors = [
      'img[src], img[data-src]',
      'link[rel="stylesheet"]',
      'script[src]',
      'source[src]',
      'video[src], video[poster]',
      'audio[src]',
      'link[rel="icon"]'
    ];

    selectors.forEach(selector => {
      $(selector).each((_, el) => {
        const $el = $(el);
        const src = $el.attr('src') || $el.attr('href') || $el.attr('data-src') || $el.attr('poster');
        
        if (src) {
          const normalizedUrl = this.normalizeUrl(src, baseUrl);
          if (normalizedUrl) {
            resources.add(normalizedUrl);
          }
        }
      });
    });

    return Array.from(resources);
  }

  async clonarESzipar({ url, returnTempDir, progresso }) {
    this.stats.startTime = Date.now();
    this.progressCallback = (progress) => {
      if (progresso) {
        Object.assign(progresso, progress);
      }
    };

    try {
      this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cloneweb-simple-'));
      this.baseUrl = new URL(url).origin;
      
      this.updateProgress('iniciando', 'Inicializando...', 5);

      // Baixar página principal
      this.updateProgress('baixando', 'Baixando página principal...', 10);
      
      const response = await axios.get(url, {
        headers: { 'User-Agent': this.options.userAgent },
        timeout: this.options.timeout
      });

      const mainPagePath = path.join(this.tempDir, 'index.html');
      fs.writeFileSync(mainPagePath, response.data);

      // Extrair recursos
      this.updateProgress('analisando', 'Analisando recursos...', 20);
      const resources = this.extractResources(response.data, url);
      this.stats.totalFiles = resources.length + 1;

      // Baixar recursos
      this.updateProgress('baixando', 'Baixando recursos...', 30);
      
      const downloadTasks = resources.map(resourceUrl => {
        return this.limiter.add(async () => {
          const destPath = this.generateDestPath(resourceUrl, this.baseUrl);
          if (!destPath) return;

          const fullDestPath = path.join(this.tempDir, destPath);
          fs.mkdirSync(path.dirname(fullDestPath), { recursive: true });

          try {
            await this.downloadFile(resourceUrl, fullDestPath);
            
            const progress = 30 + (this.stats.downloadedFiles / this.stats.totalFiles) * 50;
            this.updateProgress('baixando', `Baixando recursos... (${this.stats.downloadedFiles}/${this.stats.totalFiles})`, progress);
          } catch (error) {
            this.errors.push({ url: resourceUrl, error: error.message });
            console.warn(`Erro ao baixar ${resourceUrl}: ${error.message}`);
          }
        });
      });

      await Promise.allSettled(downloadTasks);

      // Reescrever URLs
      this.updateProgress('processando', 'Processando arquivos...', 85);
      await this.rewriteUrls();

      // Criar ZIP
      this.updateProgress('compactando', 'Criando arquivo ZIP...', 95);
      const zipPath = await this.createZip();

      const duration = (Date.now() - this.stats.startTime) / 1000;
      
      this.updateProgress('concluido', `Clonagem concluída em ${duration.toFixed(1)}s`, 100, {
        tamanhoTotal: this.formatBytes(this.stats.totalSize),
        duracao: `${duration.toFixed(1)}s`
      });

      if (returnTempDir) {
        return { zipPath, tempDir: this.tempDir };
      }
      return zipPath;

    } catch (error) {
      this.updateProgress('erro', `Erro: ${error.message}`, 0);
      throw error;
    }
  }

  async rewriteUrls() {
    const htmlFiles = this.findFiles(this.tempDir, '.html');
    
    for (const htmlFile of htmlFiles) {
      try {
        let html = fs.readFileSync(htmlFile, 'utf8');
        const $ = cheerio.load(html);

        $('img, script, link, source, video, audio').each((_, el) => {
          const $el = $(el);
          ['src', 'href', 'data-src'].forEach(attr => {
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
  }

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

  async createZip() {
    const STORAGE_DIR = path.join(__dirname, '../storage');
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }

    const zipName = `site-clonado-${Date.now()}-${Math.floor(Math.random() * 1e6)}.zip`;
    const zipPath = path.join(STORAGE_DIR, zipName);

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve(zipPath));
      archive.on('error', reject);

      archive.pipe(output);
      archive.directory(this.tempDir, false);
      archive.finalize();
    });
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Função wrapper para compatibilidade
async function clonarESzipar(options) {
  const cloner = new SimpleCloner();
  return await cloner.clonarESzipar(options);
}

module.exports = { clonarESzipar, SimpleCloner };