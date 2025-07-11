# Guia de Troubleshooting - CloneWeb2Zip

## Problemas com Instagram Downloader

### Erro: "Erro ao baixar do Instagram (yt-dlp)"

**Causas possíveis:**

1. **yt-dlp não está instalado**
   ```bash
   # Execute o script de instalação automática
   npm run install-ytdlp
   
   # Ou instale manualmente
   pip install yt-dlp
   ```

2. **yt-dlp não está no PATH**
   - Verifique se o yt-dlp está instalado: `yt-dlp --version`
   - Se não funcionar, instale via pip: `pip install yt-dlp`

3. **Problemas de permissão**
   ```bash
   # Dar permissão de execução
   chmod +x yt-dlp
   ```

4. **Instagram bloqueou o acesso**
   - O Instagram pode ter detectado o download automatizado
   - Tente com uma URL diferente
   - Aguarde alguns minutos e tente novamente

### Verificar Status do yt-dlp

Acesse: `http://localhost:5463/ytdlp-status`

Resposta esperada:
```json
{
  "status": "ok",
  "message": "yt-dlp funcionando",
  "version": "2023.12.30",
  "path": "/usr/local/bin/yt-dlp",
  "available": true
}
```

### Logs Detalhados

O sistema agora gera logs detalhados no console. Verifique:

1. **Iniciar servidor com logs:**
   ```bash
   node src/app.js
   ```

2. **Procurar por mensagens como:**
   ```
   [Instagram] Iniciando download: https://...
   [Instagram] Comando: yt-dlp ...
   [Instagram] stderr: ...
   [Instagram] Processo finalizado com código: 0
   ```

### Soluções Comuns

#### 1. Reinstalar yt-dlp
```bash
pip uninstall yt-dlp
pip install yt-dlp --upgrade
```

#### 2. Usar versão específica
```bash
pip install yt-dlp==2023.12.30
```

#### 3. Verificar Python
```bash
python --version
python3 --version
```

#### 4. Instalar dependências do sistema (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install python3-pip ffmpeg
pip3 install yt-dlp
```

### Teste Manual

Teste se o yt-dlp funciona manualmente:

```bash
# Testar com uma URL do Instagram
yt-dlp "https://www.instagram.com/p/EXEMPLO/" --no-warnings

# Se funcionar, o problema está no código
# Se não funcionar, o problema é com o yt-dlp
```

### URLs Suportadas

O Instagram downloader suporta:
- Posts de imagem: `https://www.instagram.com/p/...`
- Posts de vídeo: `https://www.instagram.com/p/...`
- Stories: `https://www.instagram.com/stories/...`
- Reels: `https://www.instagram.com/reel/...`

### Contato

Se o problema persistir:
1. Verifique os logs do console
2. Teste o yt-dlp manualmente
3. Verifique se a URL do Instagram é válida
4. Tente com uma URL diferente

### Atualizações

O yt-dlp é atualizado frequentemente. Para manter atualizado:

```bash
pip install yt-dlp --upgrade
```

Ou use o script automático:
```bash
npm run install-ytdlp
``` 