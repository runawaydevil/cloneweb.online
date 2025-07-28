// Configurações do CloneWeb2Zip
module.exports = {
  // Configurações de clonagem
  cloning: {
    maxDepth: 3,                    // Profundidade máxima de crawling
    maxFiles: 1000,                 // Limite máximo de arquivos
    maxSize: 100 * 1024 * 1024,     // 100MB - Tamanho máximo total
    concurrency: 5,                 // Downloads simultâneos
    timeout: 30000,                 // 30s - Timeout por request
    retryAttempts: 3,               // Tentativas de retry
    includeExternals: true,         // Incluir recursos externos
    followRedirects: true,          // Seguir redirects
    
    // Otimizações
    optimizeImages: true,           // Otimizar imagens
    minifyCode: true,               // Minificar CSS/JS
    imageQuality: 85,               // Qualidade JPEG (0-100)
    imageMaxWidth: 1920,            // Largura máxima de imagens
    imageMaxHeight: 1080,           // Altura máxima de imagens
    
    // User Agent
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  },
  
  // Configurações do servidor
  server: {
    port: process.env.PORT || 5463,
    host: '0.0.0.0',
    
    // Paths
    storagePath: './storage',
    tempPath: require('os').tmpdir(),
    
    // Limpeza automática
    cleanupInterval: 12 * 60 * 60 * 1000, // 12 horas
    zipRetentionDays: 7,                   // Manter ZIPs por 7 dias
    
    // Rate limiting
    maxDownloadsPerIP: 10,                 // Downloads por IP por dia
    rateLimitWindow: 24 * 60 * 60 * 1000   // 24 horas
  },
  
  // Configurações de logging
  logging: {
    logLevel: 'info',               // debug, info, warn, error
    logToFile: true,                // Salvar logs em arquivo
    logToConsole: true,             // Mostrar logs no console
    maxLogSize: 10 * 1024 * 1024,   // 10MB por arquivo de log
    maxLogFiles: 5                  // Manter 5 arquivos de log
  },
  
  // Tipos de arquivo suportados
  supportedTypes: {
    images: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'],
    styles: ['.css'],
    scripts: ['.js', '.mjs'],
    fonts: ['.woff', '.woff2', '.ttf', '.eot', '.otf'],
    videos: ['.mp4', '.webm', '.ogg', '.avi', '.mov'],
    audio: ['.mp3', '.wav', '.ogg', '.m4a', '.aac'],
    documents: ['.pdf', '.doc', '.docx', '.txt', '.rtf']
  },
  
  // Seletores CSS para extração de recursos
  resourceSelectors: [
    'img[src], img[data-src], img[data-lazy], img[data-original]',
    'link[rel="stylesheet"], link[rel="preload"][as="style"]',
    'script[src]',
    'source[src], source[srcset]',
    'video[src], video[poster]',
    'audio[src]',
    'iframe[src]',
    'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]',
    'object[data]',
    'embed[src]',
    '[style*="url("]'
  ],
  
  // Configurações do Puppeteer
  puppeteer: {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-extensions',
      '--disable-default-apps',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ],
    defaultViewport: {
      width: 1920,
      height: 1080
    }
  }
};