# CloneWeb2Zip

**CloneWeb2Zip** lets you easily clone any website and download all its files (HTML, CSS, JS, images, fonts) as a ZIP archive. Fast, simple and free!

**Live domain:** [https://cloneweb.online](https://cloneweb.online)

---

## Features
- Clone any public website and download as a ZIP
- Options: Rename all files, Simplified download, Copy mobile version, Save website structure
- Responsive and modern UI
- Progress bar and download button
- SEO optimized for search engines
- All ZIPs are stored for 7 days for admin review
- All clone actions are logged for security and audit

---.

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/youruser/cloneweb2zip.git
   cd cloneweb2zip
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Run the server:**
   ```bash
   node src/app.js
   ```
4. **Access in your browser:**
   [http://localhost:5463](http://localhost:5463)

---

## Usage
- Enter the website URL you want to clone.
- Select the desired options.
- Click "Clone and download ZIP".
- Wait for the progress bar to reach 100% and click the download button.

---

## SEO
- Meta tags for title, description, keywords, Open Graph, and canonical are included.
- Optimized for the domain: **cloneweb.online**

---

## Logs & Storage
- All generated ZIPs are stored in the `storage/` folder for up to 7 days.
- All clone actions are logged in `storage/clones.log` (date, URL, ZIP name, IP, status).
- Old ZIPs are automatically deleted after 7 days.

---

## Dica para Download Managers (IDM, etc.)
Se estiver usando um gerenciador de downloads como o Internet Download Manager (IDM) e o download automático não funcionar:
- Clique com o botão direito no botão de download ZIP e escolha "Copiar link".
- Cole o link diretamente no seu gerenciador de downloads.
- O link é válido por pelo menos 2 minutos após a geração do ZIP.

---

## License
MIT

---

**Developed by RunawayDevil - {year}** 

---

## Novas Funcionalidades

### Youtube Downloader (yt-dlp)
- Baixe vídeos do YouTube em MP3 (áudio) ou MP4 (vídeo até 1080p).
- Utiliza o yt-dlp para máxima compatibilidade com o YouTube.
- Barra de progresso visual e download automático.
- O arquivo baixado é removido do servidor em até 1 minuto após o download.

### Reddit Downloader
- Baixe vídeos de posts do Reddit (com áudio, se disponível).
- O sistema une vídeo e áudio automaticamente.
- Barra de progresso visual e download automático.
- O arquivo baixado é removido do servidor em até 1 minuto após o download.

### Pinterest Downloader
- Baixe vídeos de pins do Pinterest facilmente.
- Barra de progresso visual e download automático.
- O arquivo baixado é removido do servidor em até 1 minuto após o download.

---

## Segurança e Privacidade
- **Os arquivos baixados do YouTube, Reddit e Pinterest NÃO ficam salvos no servidor por mais de 1 minuto.**
- Após o download, os arquivos temporários são automaticamente removidos.

--- 