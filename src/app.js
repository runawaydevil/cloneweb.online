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
const ytProgresso = {};
const { default: axios } = require('axios');
const cheerio = require('cheerio');
const spawn = require('cross-spawn');
// Tentar diferentes caminhos para yt-dlp
const YTDLP_PATHS = [
  '/usr/local/bin/yt-dlp',
  '/usr/bin/yt-dlp',
  'yt-dlp',
  './yt-dlp'
];

function findYtDlp() {
  for (const path of YTDLP_PATHS) {
    try {
      require('child_process').execSync(`${path} --version`, { stdio: 'ignore' });
      return path;
    } catch (e) {
      continue;
    }
  }
  return null;
}

const YTDLP_PATH = findYtDlp();

// ffmpeg para Reddit Downloader
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);

// Progresso para Reddit e Pinterest
const redditProgresso = {};
const pinterestProgresso = {};
const instagramProgresso = {};

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
  const randomNum = Math.floor(Math.random() * 1e6);
  const downloadName = `cloneweb--${randomNum}.zip`;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
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

// Rota para Reddit Downloader
app.get('/reddit', (req, res) => {
  res.render('reddit');
});
// Rota para Pinterest Downloader
app.get('/pinterest', (req, res) => {
  res.render('pinterest');
});

// Rota para Instagram Downloader
app.get('/instagram', (req, res) => {
  res.render('instagram');
});

// Rota para Youtube Downloader
app.get('/youtube', (req, res) => {
  res.redirect('/?ytindisponivel=1');
});

// Rota para processar download do Youtube
app.post('/youtube/download', async (req, res) => {
  try {
    const { yturl, tipo } = req.body;
    if (!yturl || !tipo || !['mp3', 'mp4'].includes(tipo)) {
      return res.status(400).send('Requisição inválida.');
    }
    const id = uuidv4();
    ytProgresso[id] = { status: 'iniciando', progresso: 0, erro: null, downloadUrl: null };
    res.json({ id });
    (async () => {
      try {
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        const tempDir = os.tmpdir();
        const randomNum = Math.floor(Math.random() * 1e6);
        let outPath, downloadName;
        let ext = tipo === 'mp3' ? 'mp3' : 'mp4';
        outPath = path.join(tempDir, `yt_${randomNum}.${ext}`);
        downloadName = `cloneweb--youtube--${randomNum}.${ext}`;
        ytProgresso[id].status = 'baixando';
        ytProgresso[id].progresso = 5;
        // Montar argumentos do yt-dlp
        let args = [
          yturl,
          '-o', outPath,
          '--no-playlist',
          '--no-warnings',
          '--progress',
        ];
        if (tipo === 'mp3') {
          args.push('-x', '--audio-format', 'mp3', '--audio-quality', '192K');
        } else {
          args.push('-f', 'bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/mp4');
        }
        // Rodar yt-dlp
        const proc = spawn(YTDLP_PATH, args);
        proc.stderr.setEncoding('utf8');
        proc.stdout.setEncoding('utf8');
        let lastProgress = 5;
        const progressRegex = /\[download\]\s+(\d+\.\d+)%/;
        proc.stderr.on('data', (data) => {
          const lines = data.split('\n');
          for (const line of lines) {
            const match = line.match(progressRegex);
            if (match) {
              let prog = Math.round(parseFloat(match[1]));
              if (prog > lastProgress) {
                lastProgress = prog;
                ytProgresso[id].progresso = Math.min(99, prog);
                ytProgresso[id].status = 'baixando';
              }
            }
          }
        });
        proc.on('close', (code) => {
          if (code === 0 && fs.existsSync(outPath)) {
            ytProgresso[id].status = 'pronto';
            ytProgresso[id].progresso = 100;
            ytProgresso[id].downloadUrl = `/youtube/downloadfile/${id}`;
            ytProgresso[id].outPath = outPath;
            ytProgresso[id].downloadName = downloadName;
            setTimeout(() => { try { fs.unlinkSync(outPath); delete ytProgresso[id]; } catch {} }, 60 * 1000);
          } else {
            ytProgresso[id].status = 'erro';
            ytProgresso[id].erro = 'Erro ao baixar do YouTube (yt-dlp).';
          }
        });
        proc.on('error', (err) => {
          ytProgresso[id].status = 'erro';
          ytProgresso[id].erro = 'Erro ao iniciar yt-dlp: ' + (err.message || err);
        });
      } catch (e) {
        ytProgresso[id].status = 'erro';
        ytProgresso[id].erro = 'Erro ao processar o download do Youtube: ' + (e.message || e);
      }
    })();
  } catch (e) {
    res.status(500).send('Erro ao processar o download do Youtube: ' + (e.message || e));
  }
});

// Rota para consultar progresso
app.get('/youtube/progresso/:id', (req, res) => {
  const prog = ytProgresso[req.params.id];
  if (!prog) return res.status(404).json({ erro: 'ID não encontrado.' });
  res.json(prog);
});

// Rota para entregar o arquivo pronto
app.get('/youtube/downloadfile/:id', (req, res) => {
  const prog = ytProgresso[req.params.id];
  if (!prog || !prog.outPath || !prog.downloadName) return res.status(404).send('Arquivo não encontrado ou expirado.');
  incrementDownloadsCount();
  res.download(prog.outPath, prog.downloadName);
});

// REDDIT DOWNLOADER
app.post('/reddit/download', async (req, res) => {
  try {
    const { redditurl } = req.body;
    if (!redditurl || !redditurl.startsWith('http')) {
      return res.status(400).send('URL inválida.');
    }
    if (/cloneweb\.online/i.test(redditurl)) {
      return res.status(400).send('I do not download myself.');
    }
    logAccess({ req, tipo: 'reddit', url: redditurl });
    const id = uuidv4();
    redditProgresso[id] = { status: 'iniciando', progresso: 0, erro: null, downloadUrl: null };
    res.json({ id });
    (async () => {
      try {
        redditProgresso[id].status = 'baixando';
        redditProgresso[id].progresso = 10;
        // Obter JSON do post
        let jsonUrl = redditurl.split('?')[0];
        if (!jsonUrl.endsWith('/')) jsonUrl += '/';
        jsonUrl += '.json';
        const { data } = await axios.get(jsonUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        // Extrair info do vídeo
        const post = data[0].data.children[0].data;
        const media = post.secure_media || post.media;
        if (!media || !media.reddit_video) throw new Error('Vídeo não encontrado no post.');
        const videoUrl = media.reddit_video.fallback_url;
        // Tentar extrair áudio (Reddit separa vídeo e áudio)
        const base = videoUrl.split('DASH_')[0];
        const audioUrl = base + 'DASH_audio.mp4';
        // Baixar vídeo
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        const tempDir = os.tmpdir();
        const randomNum = Math.floor(Math.random() * 1e6);
        const videoPath = path.join(tempDir, `redditvid_${randomNum}.mp4`);
        const audioPath = path.join(tempDir, `redditaud_${randomNum}.mp4`);
        const outPath = path.join(tempDir, `redditfinal_${randomNum}.mp4`);
        const downloadFile = async (url, dest) => {
          const writer = fs.createWriteStream(dest);
          const response = await axios({ url, method: 'GET', responseType: 'stream' });
          return new Promise((resolve, reject) => {
            response.data.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
          });
        };
        await downloadFile(videoUrl, videoPath);
        redditProgresso[id].progresso = 60;
        // Tentar baixar áudio
        let hasAudio = false;
        try {
          await downloadFile(audioUrl, audioPath);
          hasAudio = true;
        } catch { hasAudio = false; }
        redditProgresso[id].progresso = 80;
        // Se tiver áudio, unir com ffmpeg
        if (hasAudio) {
          await new Promise((resolve, reject) => {
            ffmpeg()
              .input(videoPath)
              .input(audioPath)
              .outputOptions('-c:v copy', '-c:a aac', '-strict experimental')
              .save(outPath)
              .on('end', resolve)
              .on('error', reject);
          });
        } else {
          fs.copyFileSync(videoPath, outPath);
        }
        redditProgresso[id].progresso = 100;
        redditProgresso[id].status = 'pronto';
        redditProgresso[id].downloadUrl = `/reddit/downloadfile/${id}`;
        redditProgresso[id].outPath = outPath;
        redditProgresso[id].downloadName = `cloneweb--reddit-video--${randomNum}.mp4`;
        setTimeout(() => {
          try {
            fs.unlinkSync(videoPath);
            if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
            fs.unlinkSync(outPath);
            delete redditProgresso[id];
          } catch {}
        }, 60 * 1000);
      } catch (e) {
        redditProgresso[id].status = 'erro';
        redditProgresso[id].erro = 'Erro ao baixar vídeo do Reddit: ' + (e.message || e);
      }
    })();
  } catch (e) {
    res.status(500).send('Erro ao iniciar download do Reddit: ' + (e.message || e));
  }
});

app.get('/reddit/progresso/:id', (req, res) => {
  const prog = redditProgresso[req.params.id];
  if (!prog) return res.status(404).json({ erro: 'ID não encontrado.' });
  res.json(prog);
});

app.get('/reddit/downloadfile/:id', (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
  if (!canDownload(ip)) {
    return res.status(429).send('You have reached the daily download limit. Please try again in 24 hours.');
  }
  const prog = redditProgresso[req.params.id];
  if (!prog || !prog.outPath || !prog.downloadName) return res.status(404).send('Arquivo não encontrado ou expirado.');
  if (!isMediaFile(prog.downloadName)) {
    return res.status(403).send('Only media files can be downloaded from this service.');
  }
  incrementDownloadsCount();
  res.download(prog.outPath, prog.downloadName);
});

// PINTEREST DOWNLOADER
app.post('/pinterest/download', async (req, res) => {
  try {
    const { pinteresturl } = req.body;
    if (!pinteresturl || !pinteresturl.startsWith('http')) {
      return res.status(400).send('URL inválida.');
    }
    if (/cloneweb\.online/i.test(pinteresturl)) {
      return res.status(400).send('I do not download myself.');
    }
    logAccess({ req, tipo: 'pinterest', url: pinteresturl });
    const id = uuidv4();
    pinterestProgresso[id] = { status: 'iniciando', progresso: 0, erro: null, downloadUrl: null };
    res.json({ id });
    (async () => {
      try {
        pinterestProgresso[id].status = 'baixando';
        pinterestProgresso[id].progresso = 10;
        // Baixar HTML do pin
        const { data: html } = await axios.get(pinteresturl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(html);
        // Procurar vídeo no HTML
        let videoUrl = null;
        // 1. Tentar pegar de <video src>
        videoUrl = $('video').attr('src');
        // 2. Se não achar, procurar em JSON embutido
        if (!videoUrl) {
          const matches = html.match(/"contentUrl":"(https:[^"]+\.mp4)"/);
          if (matches) videoUrl = matches[1].replace(/\\u002F/g, '/');
        }
        if (!videoUrl) throw new Error('Vídeo não encontrado no pin.');
        pinterestProgresso[id].progresso = 60;
        // Baixar vídeo
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        const tempDir = os.tmpdir();
        const randomNum = Math.floor(Math.random() * 1e6);
        const outPath = path.join(tempDir, `pinterest_${randomNum}.mp4`);
        const writer = fs.createWriteStream(outPath);
        const response = await axios({ url: videoUrl, method: 'GET', responseType: 'stream' });
        await new Promise((resolve, reject) => {
          response.data.pipe(writer);
          writer.on('finish', resolve);
          writer.on('error', reject);
        });
        pinterestProgresso[id].progresso = 100;
        pinterestProgresso[id].status = 'pronto';
        pinterestProgresso[id].downloadUrl = `/pinterest/downloadfile/${id}`;
        pinterestProgresso[id].outPath = outPath;
        pinterestProgresso[id].downloadName = `cloneweb--pinterest-video--${randomNum}.mp4`;
        setTimeout(() => {
          try {
            fs.unlinkSync(outPath);
            delete pinterestProgresso[id];
          } catch {}
        }, 60 * 1000);
      } catch (e) {
        pinterestProgresso[id].status = 'erro';
        pinterestProgresso[id].erro = 'Erro ao baixar vídeo do Pinterest: ' + (e.message || e);
      }
    })();
  } catch (e) {
    res.status(500).send('Erro ao iniciar download do Pinterest: ' + (e.message || e));
  }
});

app.get('/pinterest/progresso/:id', (req, res) => {
  const prog = pinterestProgresso[req.params.id];
  if (!prog) return res.status(404).json({ erro: 'ID não encontrado.' });
  res.json(prog);
});

app.get('/pinterest/downloadfile/:id', (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
  if (!canDownload(ip)) {
    return res.status(429).send('You have reached the daily download limit. Please try again in 24 hours.');
  }
  const prog = pinterestProgresso[req.params.id];
  if (!prog || !prog.outPath || !prog.downloadName) return res.status(404).send('Arquivo não encontrado ou expirado.');
  if (!isMediaFile(prog.downloadName)) {
    return res.status(403).send('Only media files can be downloaded from this service.');
  }
  incrementDownloadsCount();
  res.download(prog.outPath, prog.downloadName);
});

// Instagram Downloader
app.post('/instagram/download', async (req, res) => {
  try {
    const { igurl } = req.body;
    if (!igurl || !igurl.startsWith('http')) {
      return res.status(400).send('URL inválida.');
    }
    if (/cloneweb\.online/i.test(igurl)) {
      return res.status(400).send('I do not download myself.');
    }
    
    // Verificar se yt-dlp está disponível
    if (!YTDLP_PATH) {
      return res.status(500).json({ erro: 'yt-dlp não está instalado ou não foi encontrado no sistema.' });
    }
    
    logAccess({ req, tipo: 'instagram', url: igurl });
    const id = uuidv4();
    instagramProgresso[id] = { status: 'iniciando', progresso: 0, erro: null, downloadUrl: null };
    res.json({ id });
    
    (async () => {
      try {
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        const tempDir = os.tmpdir();
        const randomNum = Math.floor(Math.random() * 1e6);
        const outPath = path.join(tempDir, `instagram_${randomNum}.%(ext)s`);
        let downloadName = `cloneweb--instagram-media--${randomNum}`;
        
        instagramProgresso[id].status = 'baixando';
        instagramProgresso[id].progresso = 5;
        
        // Montar argumentos do yt-dlp com melhor configuração
        let args = [
          igurl,
          '-o', outPath,
          '--no-warnings',
          '--progress',
          '--no-playlist',
          '--extract-audio',
          '--audio-format', 'mp3',
          '--audio-quality', '192K',
          '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        ];
        
        console.log(`[Instagram] Iniciando download: ${igurl}`);
        console.log(`[Instagram] Comando: ${YTDLP_PATH} ${args.join(' ')}`);
        
        // Rodar yt-dlp
        const proc = spawn(YTDLP_PATH, args);
        proc.stderr.setEncoding('utf8');
        proc.stdout.setEncoding('utf8');
        
        let lastProgress = 5;
        let errorOutput = '';
        const progressRegex = /\[download\]\s+(\d+\.\d+)%/;
        
        proc.stderr.on('data', (data) => {
          errorOutput += data;
          console.log(`[Instagram] stderr: ${data}`);
          
          const lines = data.split('\n');
          for (const line of lines) {
            const match = line.match(progressRegex);
            if (match) {
              let prog = Math.round(parseFloat(match[1]));
              if (prog > lastProgress) {
                lastProgress = prog;
                instagramProgresso[id].progresso = Math.min(99, prog);
                instagramProgresso[id].status = 'baixando';
              }
            }
          }
        });
        
        proc.stdout.on('data', (data) => {
          console.log(`[Instagram] stdout: ${data}`);
        });
        
        proc.on('close', (code) => {
          console.log(`[Instagram] Processo finalizado com código: ${code}`);
          console.log(`[Instagram] Erro output: ${errorOutput}`);
          
          // Procurar arquivo baixado (pode ser mp4, jpg, etc)
          let foundFile = null;
          if (code === 0) {
            const exts = ['mp4', 'jpg', 'jpeg', 'png', 'webp', 'mp3', 'm4a'];
            for (const ext of exts) {
              const candidate = path.join(tempDir, `instagram_${randomNum}.${ext}`);
              if (fs.existsSync(candidate)) {
                foundFile = candidate;
                downloadName = `cloneweb--instagram-media--${randomNum}.${ext}`;
                console.log(`[Instagram] Arquivo encontrado: ${foundFile}`);
                break;
              }
            }
          }
          
          if (foundFile) {
            instagramProgresso[id].status = 'pronto';
            instagramProgresso[id].progresso = 100;
            instagramProgresso[id].downloadUrl = `/instagram/downloadfile/${id}`;
            instagramProgresso[id].outPath = foundFile;
            instagramProgresso[id].downloadName = downloadName;
            setTimeout(() => { 
              try { 
                fs.unlinkSync(foundFile); 
                delete instagramProgresso[id]; 
              } catch {} 
            }, 60 * 1000);
          } else {
            instagramProgresso[id].status = 'erro';
            instagramProgresso[id].erro = `Erro ao baixar do Instagram. Código: ${code}. Detalhes: ${errorOutput.substring(0, 200)}`;
          }
        });
        
        proc.on('error', (err) => {
          console.error(`[Instagram] Erro no processo: ${err.message}`);
          instagramProgresso[id].status = 'erro';
          instagramProgresso[id].erro = 'Erro ao iniciar yt-dlp: ' + (err.message || err);
        });
        
      } catch (e) {
        console.error(`[Instagram] Exceção: ${e.message}`);
        instagramProgresso[id].status = 'erro';
        instagramProgresso[id].erro = 'Erro ao processar o download do Instagram: ' + (e.message || e);
      }
    })();
  } catch (e) {
    console.error(`[Instagram] Erro na requisição: ${e.message}`);
    res.status(500).json({ erro: 'Erro ao iniciar download do Instagram: ' + (e.message || e) });
  }
});

app.get('/instagram/progresso/:id', (req, res) => {
  const prog = instagramProgresso[req.params.id];
  if (!prog) return res.status(404).json({ erro: 'ID não encontrado.' });
  res.json(prog);
});

app.get('/instagram/downloadfile/:id', (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
  if (!canDownload(ip)) {
    return res.status(429).send('You have reached the daily download limit. Please try again in 24 hours.');
  }
  const prog = instagramProgresso[req.params.id];
  if (!prog || !prog.outPath || !prog.downloadName) return res.status(404).send('Arquivo não encontrado ou expirado.');
  if (!isMediaFile(prog.downloadName)) {
    return res.status(403).send('Only media files can be downloaded from this service.');
  }
  incrementDownloadsCount();
  res.download(prog.outPath, prog.downloadName);
});

// Rota para verificar status do yt-dlp
app.get('/ytdlp-status', (req, res) => {
  try {
    if (!YTDLP_PATH) {
      return res.json({ 
        status: 'error', 
        message: 'yt-dlp não encontrado',
        available: false 
      });
    }
    
    // Testar se yt-dlp funciona
    const { execSync } = require('child_process');
    const version = execSync(`${YTDLP_PATH} --version`, { encoding: 'utf8' }).trim();
    
    res.json({ 
      status: 'ok', 
      message: 'yt-dlp funcionando',
      version: version,
      path: YTDLP_PATH,
      available: true 
    });
  } catch (e) {
    res.json({ 
      status: 'error', 
      message: 'yt-dlp não está funcionando: ' + e.message,
      available: false 
    });
  }
});

// Rota para Midia Downloader
app.get('/midia', (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
  let countryCode = '';
  try {
    const geo = geoip.lookup(ip);
    if (geo && geo.country) countryCode = geo.country;
  } catch {}
  res.render('midia', { ip, countryCode });
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

// Limite de downloads por IP (10 por 24h)
const DOWNLOADS_PER_IP_PATH = path.join(__dirname, '../storage/downloads_per_ip.json');
function getDownloadsPerIp() {
  try {
    if (!fs.existsSync(DOWNLOADS_PER_IP_PATH)) fs.writeFileSync(DOWNLOADS_PER_IP_PATH, '{}');
    return JSON.parse(fs.readFileSync(DOWNLOADS_PER_IP_PATH, 'utf8'));
  } catch { return {}; }
}
function saveDownloadsPerIp(data) {
  fs.writeFileSync(DOWNLOADS_PER_IP_PATH, JSON.stringify(data));
}
function canDownload(ip) {
  const data = getDownloadsPerIp();
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  if (!data[ip]) data[ip] = [];
  // Remove registros antigos
  data[ip] = data[ip].filter(ts => now - ts < DAY);
  if (data[ip].length >= 10) return false;
  data[ip].push(now);
  saveDownloadsPerIp(data);
  return true;
}

// Lista de extensões de mídia permitidas
const ALLOWED_MEDIA_EXTS = ['mp4','jpg','jpeg','png','webp','gif','mov','avi','mp3','m4a','wav'];
function isMediaFile(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  return ALLOWED_MEDIA_EXTS.includes(ext);
}

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando em http://127.0.0.1:${PORT} (ou acesse pelo IP da sua rede local)`);
}); 