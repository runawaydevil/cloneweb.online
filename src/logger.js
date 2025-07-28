// Sistema de logging avançado para CloneWeb2Zip
const fs = require('fs');
const path = require('path');
const config = require('./config');

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '../storage/logs');
    this.ensureLogDir();
    this.currentLogFile = this.getLogFileName();
  }

  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  getLogFileName() {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `cloneweb-${date}.log`);
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}\n`;
  }

  writeToFile(level, message, meta) {
    if (!config.logging.logToFile) return;

    try {
      const logFile = this.getLogFileName();
      const formattedMessage = this.formatMessage(level, message, meta);
      
      // Verificar tamanho do arquivo
      if (fs.existsSync(logFile)) {
        const stats = fs.statSync(logFile);
        if (stats.size > config.logging.maxLogSize) {
          this.rotateLogFile(logFile);
        }
      }
      
      fs.appendFileSync(logFile, formattedMessage);
    } catch (error) {
      console.error('Erro ao escrever log:', error);
    }
  }

  rotateLogFile(currentFile) {
    try {
      const timestamp = Date.now();
      const rotatedFile = currentFile.replace('.log', `-${timestamp}.log`);
      fs.renameSync(currentFile, rotatedFile);
      
      // Limpar logs antigos
      this.cleanOldLogs();
    } catch (error) {
      console.error('Erro ao rotacionar log:', error);
    }
  }

  cleanOldLogs() {
    try {
      const files = fs.readdirSync(this.logDir)
        .filter(file => file.startsWith('cloneweb-') && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.logDir, file),
          mtime: fs.statSync(path.join(this.logDir, file)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);

      // Manter apenas os arquivos mais recentes
      if (files.length > config.logging.maxLogFiles) {
        files.slice(config.logging.maxLogFiles).forEach(file => {
          fs.unlinkSync(file.path);
        });
      }
    } catch (error) {
      console.error('Erro ao limpar logs antigos:', error);
    }
  }

  log(level, message, meta = {}) {
    // Verificar se o nível está habilitado
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(config.logging.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    
    if (messageLevelIndex < currentLevelIndex) return;

    // Log para console
    if (config.logging.logToConsole) {
      const colors = {
        debug: '\x1b[36m',  // Cyan
        info: '\x1b[32m',   // Green
        warn: '\x1b[33m',   // Yellow
        error: '\x1b[31m'   // Red
      };
      const reset = '\x1b[0m';
      const color = colors[level] || '';
      
      console.log(`${color}[${level.toUpperCase()}]${reset} ${message}`, meta);
    }

    // Log para arquivo
    this.writeToFile(level, message, meta);
  }

  debug(message, meta) {
    this.log('debug', message, meta);
  }

  info(message, meta) {
    this.log('info', message, meta);
  }

  warn(message, meta) {
    this.log('warn', message, meta);
  }

  error(message, meta) {
    this.log('error', message, meta);
  }

  // Log específico para clonagem
  cloneStart(url, options) {
    this.info('Iniciando clonagem', { url, options });
  }

  cloneProgress(url, progress) {
    this.debug('Progresso da clonagem', { url, ...progress });
  }

  cloneComplete(url, stats) {
    this.info('Clonagem concluída', { url, ...stats });
  }

  cloneError(url, error) {
    this.error('Erro na clonagem', { url, error: error.message, stack: error.stack });
  }

  downloadStart(url, destPath) {
    this.debug('Iniciando download', { url, destPath });
  }

  downloadComplete(url, destPath, size) {
    this.debug('Download concluído', { url, destPath, size });
  }

  downloadError(url, error) {
    this.warn('Erro no download', { url, error: error.message });
  }

  optimization(type, filePath, originalSize, newSize) {
    this.debug('Arquivo otimizado', { 
      type, 
      filePath, 
      originalSize, 
      newSize, 
      savings: `${((originalSize - newSize) / originalSize * 100).toFixed(1)}%` 
    });
  }
}

// Instância singleton
const logger = new Logger();

module.exports = logger;