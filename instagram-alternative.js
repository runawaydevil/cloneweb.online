const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Função alternativa para baixar do Instagram sem yt-dlp
async function downloadInstagramAlternative(url, progressCallback) {
  try {
    console.log(`[Instagram Alt] Iniciando download alternativo: ${url}`);
    
    // Extrair ID do post do Instagram
    const postIdMatch = url.match(/instagram\.com\/p\/([^\/\?]+)/);
    if (!postIdMatch) {
      throw new Error('URL do Instagram inválida');
    }
    
    const postId = postIdMatch[1];
    console.log(`[Instagram Alt] Post ID: ${postId}`);
    
    // Tentar diferentes APIs públicas
    const apis = [
      `https://www.instagram.com/p/${postId}/?__a=1&__d=1`,
      `https://www.instagram.com/api/v1/media/${postId}/info/`,
      `https://i.instagram.com/api/v1/media/${postId}/info/`
    ];
    
    let mediaData = null;
    
    for (const api of apis) {
      try {
        console.log(`[Instagram Alt] Tentando API: ${api}`);
        
        const response = await axios.get(api, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.instagram.com/',
            'Origin': 'https://www.instagram.com'
          },
          timeout: 10000
        });
        
        if (response.data) {
          mediaData = response.data;
          console.log(`[Instagram Alt] API funcionou: ${api}`);
          break;
        }
      } catch (e) {
        console.log(`[Instagram Alt] API falhou: ${api} - ${e.message}`);
        continue;
      }
    }
    
    if (!mediaData) {
      throw new Error('Não foi possível obter dados do post');
    }
    
    // Extrair URL da mídia
    let mediaUrl = null;
    
    // Tentar diferentes caminhos para encontrar a URL da mídia
    if (mediaData.items && mediaData.items[0]) {
      const item = mediaData.items[0];
      
      // Vídeo
      if (item.video_versions && item.video_versions.length > 0) {
        mediaUrl = item.video_versions[0].url;
      }
      // Imagem
      else if (item.image_versions2 && item.image_versions2.candidates) {
        mediaUrl = item.image_versions2.candidates[0].url;
      }
      // Carousel
      else if (item.carousel_media) {
        if (item.carousel_media[0].video_versions) {
          mediaUrl = item.carousel_media[0].video_versions[0].url;
        } else if (item.carousel_media[0].image_versions2) {
          mediaUrl = item.carousel_media[0].image_versions2.candidates[0].url;
        }
      }
    }
    
    if (!mediaUrl) {
      throw new Error('URL da mídia não encontrada');
    }
    
    console.log(`[Instagram Alt] URL da mídia encontrada: ${mediaUrl}`);
    
    // Baixar arquivo
    const tempDir = os.tmpdir();
    const randomNum = Math.floor(Math.random() * 1e6);
    const ext = mediaUrl.includes('.mp4') ? 'mp4' : 'jpg';
    const outPath = path.join(tempDir, `instagram_alt_${randomNum}.${ext}`);
    
    progressCallback(50);
    
    const writer = fs.createWriteStream(outPath);
    const response = await axios({
      method: 'GET',
      url: mediaUrl,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    return new Promise((resolve, reject) => {
      response.data.pipe(writer);
      
      writer.on('finish', () => {
        progressCallback(100);
        resolve({
          success: true,
          file: outPath,
          filename: `cloneweb--instagram-alt--${randomNum}.${ext}`
        });
      });
      
      writer.on('error', reject);
    });
    
  } catch (error) {
    console.error(`[Instagram Alt] Erro: ${error.message}`);
    throw error;
  }
}

module.exports = { downloadInstagramAlternative }; 