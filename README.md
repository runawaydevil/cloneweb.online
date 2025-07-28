# CloneWeb2Zip

**CloneWeb2Zip** lets you easily clone any website and download all its files (HTML, CSS, JS, images, fonts) as a ZIP archive. Fast, simple and free!

**Live domain:** [https://cloneweb.online](https://cloneweb.online)

---

## Features

### 🚀 **Advanced Website Cloning**
- **Smart Resource Detection**: Automatically detects and downloads all website resources
- **SPA Support**: Uses Puppeteer to handle Single Page Applications and JavaScript-rendered content
- **Parallel Downloads**: Downloads multiple files simultaneously for faster cloning
- **External Resources**: Optionally includes external resources (CDNs, fonts, etc.)
- **Deep Crawling**: Configurable depth for multi-page website cloning

### 🎯 **Intelligent Optimization**
- **Image Optimization**: Automatically compresses images while maintaining quality
- **Code Minification**: Minifies CSS and JavaScript files to reduce size
- **Smart Caching**: Prevents duplicate downloads with intelligent caching system
- **Size Management**: Configurable limits to prevent excessive resource usage

### 📊 **Advanced Progress Tracking**
- **Real-time Progress**: Detailed progress information with current operation status
- **File Statistics**: Shows total files, downloaded files, optimized files, and errors
- **Performance Metrics**: Displays download speed, total size, and completion time
- **Error Reporting**: Comprehensive error tracking and reporting

### 🛠 **Robust Error Handling**
- **Automatic Retry**: Exponential backoff retry mechanism for failed downloads
- **Graceful Degradation**: Falls back to alternative methods when primary fails
- **Comprehensive Logging**: Detailed logging system with multiple levels and rotation
- **Resource Validation**: Validates and sanitizes all downloaded resources

### ⚙️ **Configurable Options**
- **Optimization Settings**: Enable/disable image optimization and code minification
- **Download Limits**: Configurable file count, size limits, and concurrency
- **Crawling Depth**: Control how deep the cloner should traverse website links
- **Resource Filtering**: Choose which types of resources to include/exclude

### 🔒 **Security & Performance**
- **Rate Limiting**: Prevents abuse with configurable rate limits
- **Resource Validation**: Validates file types and sizes for security
- **Memory Management**: Efficient memory usage with streaming downloads
- **Automatic Cleanup**: Automatic cleanup of temporary files and old archives

---.

## Installation
.
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