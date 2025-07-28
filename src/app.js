// Código minificado gerado automaticamente
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');
const rimraf = require('rimraf');
const { v4: uuidv4 } = require('uuid');
const progressoTarefas = {};
const zipsProntos = {};
const LOG_PATH = path.join(__dirname, '../storage/clones.log');
const { default: axios } = require('axios');

function registrarClone({ url, zipPath, status, erro, req }) {
  const log = {
    data: new Date().toISOString(),
    url,
    zip: zipPath ? path.basename(zipPath) : null,
    ip: req ? req.ip : null,
    status,
    erro: erro || null
  };
  fs.appendFileSync(LOG_PATH, JSON.stringify(log) + '\n');
}

// Função para registrar logs de acesso
function logAccess({ req, tipo, url }) {
  const fs = require('fs');
  const path = require('path');
  const logDir = path.join(__dirname, '../storage');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, 'access.log');
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
  const data = new Date().toISOString();
  const linha = `[${data}] IP: ${ip} | Tipo: ${tipo} | URL: ${url}\n`;
  fs.appendFileSync(logPath, linha);
}

// Sistema de log centralizado
const SYSTEM_LOG_PATH = path.join(__dirname, '../storage/system.log');
function logToFile(...args) {
  const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  const linha = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(SYSTEM_LOG_PATH, linha);
}

// Sobrescrever console.log e console.error
const originalLog = console.log;
const originalError = console.error;
console.log = (...args) => {
  logToFile('[LOG]', ...args);
  originalLog(...args);
};
console.error = (...args) => {
  logToFile('[ERRO]', ...args);
  originalError(...args);
};

const app = express();
const PORT = process.env.PORT || 5463;

// Configura EJS como view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, '../public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Rota principal
app.get('/', (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
  let countryCode = '';
  try {
    const geo = geoip.lookup(ip);
    if (geo && geo.country) countryCode = geo.country;
  } catch {}
  res.render('index', { ip, countryCode });
});

// Rota para clonar e baixar o site
const { clonarESzipar } = require('./clone');

app.post('/clonar', async (req, res) => {
  const { url, renameAssets, simpleDownload, mobileVersion, saveStructure } = req.body;
  if (!url) {
    return res.status(400).json({ erro: 'URL obrigatória.' });
  }
  const id = uuidv4();
  progressoTarefas[id] = { status: 'iniciando', progresso: 0, erro: null };
  res.json({ id });
  // Processa em background
  (async () => {
    try {
      progressoTarefas[id] = { status: 'baixando', progresso: 10 };
      const { zipPath, tempDir } = await clonarESzipar({ url, renameAssets, simpleDownload, mobileVersion, saveStructure, returnTempDir: true, progresso: progressoTarefas[id] });
      progressoTarefas[id] = { status: 'pronto', progresso: 100 };
      zipsProntos[id] = { zipPath, tempDir };
      registrarClone({ url, zipPath, status: 'sucesso', req });
    } catch (e) {
      progressoTarefas[id] = { status: 'erro', progresso: 0, erro: e.message };
      registrarClone({ url, status: 'erro', erro: e.message, req });
    }
  })();
});

app.get('/progresso/:id', (req, res) => {
  const prog = progressoTarefas[req.params.id];
  if (!prog) return res.status(404).json({ erro: 'ID não encontrado.' });
  res.json(prog);
});

app.get('/download/:id', (req, res) => {
  incrementDownloadsCount();
  const info = zipsProntos[req.params.id];
  if (!info) return res.status(404).send('Arquivo não encontrado ou ainda não pronto.');
  // Extrair domínio do site clonado
  let dominio = 'site';
  try {
    const zipBase = info.zipPath.split('site-clonado-')[1];
    if (zipBase) {
      // O domínio não está no nome do arquivo, então vamos tentar pegar do progressoTarefas
      // ou do arquivo temporário
      // Se não conseguir, mantém 'site'
    }
    if (progressoTarefas[req.params.id] && progressoTarefas[req.params.id].url) {
      const url = progressoTarefas[req.params.id].url;
      dominio = new URL(url).hostname.replace(/^www\./, '').replace(/[^a-zA-Z0-9\-]/g, '-');
    }
  } catch {}
  const randomNum = Math.floor(Math.random() * 1e6);
  const downloadName = `cloneweb-${dominio}-${randomNum}.zip`;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename=\"${downloadName}\"`);
  res.download(info.zipPath, downloadName, (err) => {
    // Não remover o ZIP da storage imediatamente, apenas a pasta temporária
    try {
      if (info.tempDir && fs.existsSync(info.tempDir)) rimraf.sync(info.tempDir);
      // Remover o registro do ZIP e progresso após 2 minutos
      setTimeout(() => {
        delete zipsProntos[req.params.id];
        delete progressoTarefas[req.params.id];
      }, 2 * 60 * 1000); // 2 minutos
    } catch (e) {
      console.error('Erro ao limpar arquivos temporários:', e);
    }
    if (err) {
      console.error('Erro ao enviar ZIP:', err);
    }
  });
});










// --- INÍCIO CONTADOR DE DOWNLOADS ---
const DOWNLOADS_COUNT_PATH = path.join(__dirname, '../storage/downloads_count.json');
function getDownloadsCount() {
  try {
    if (!fs.existsSync(DOWNLOADS_COUNT_PATH)) fs.writeFileSync(DOWNLOADS_COUNT_PATH, '0');
    return parseInt(fs.readFileSync(DOWNLOADS_COUNT_PATH, 'utf8')) || 0;
  } catch { return 0; }
}
function incrementDownloadsCount() {
  const count = getDownloadsCount() + 1;
  fs.writeFileSync(DOWNLOADS_COUNT_PATH, String(count));
  return count;
}
app.get('/downloads-count', (req, res) => {
  res.json({ count: getDownloadsCount() });
});
// --- FIM CONTADOR DE DOWNLOADS ---



// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando em http://127.0.0.1:${PORT} (ou acesse pelo IP da sua rede local)`);
}); 