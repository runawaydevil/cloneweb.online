const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');
const rimraf = require('rimraf');
const { v4: uuidv4 } = require('uuid');
const progressoTarefas = {};
const zipsProntos = {};
const LOG_PATH = path.join(__dirname, '../storage/clones.log');

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
  res.render('index');
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
  const info = zipsProntos[req.params.id];
  if (!info) return res.status(404).send('Arquivo não encontrado ou ainda não pronto.');
  res.download(info.zipPath, 'site-clonado.zip', (err) => {
    try {
      // Não remover o ZIP da storage, apenas a pasta temporária
      if (info.tempDir && fs.existsSync(info.tempDir)) rimraf.sync(info.tempDir);
      delete zipsProntos[req.params.id];
      delete progressoTarefas[req.params.id];
    } catch (e) {
      console.error('Erro ao limpar arquivos temporários:', e);
    }
    if (err) {
      console.error('Erro ao enviar ZIP:', err);
    }
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
}); 