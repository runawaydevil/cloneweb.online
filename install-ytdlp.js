#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Verificando e instalando yt-dlp...');

function checkYtDlp() {
  const paths = [
    '/usr/local/bin/yt-dlp',
    '/usr/bin/yt-dlp',
    'yt-dlp',
    './yt-dlp'
  ];
  
  for (const ytPath of paths) {
    try {
      execSync(`${ytPath} --version`, { stdio: 'ignore' });
      console.log(`✅ yt-dlp encontrado em: ${ytPath}`);
      return ytPath;
    } catch (e) {
      continue;
    }
  }
  return null;
}

function installYtDlp() {
  console.log('📥 Instalando yt-dlp...');
  
  try {
    // Tentar instalar via pip
    console.log('Tentando instalar via pip...');
    execSync('pip install yt-dlp', { stdio: 'inherit' });
    return true;
  } catch (e) {
    console.log('pip falhou, tentando pip3...');
    try {
      execSync('pip3 install yt-dlp', { stdio: 'inherit' });
      return true;
    } catch (e2) {
      console.log('pip3 falhou, tentando curl...');
      try {
        // Baixar yt-dlp diretamente
        execSync('curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o yt-dlp', { stdio: 'inherit' });
        execSync('chmod +x yt-dlp', { stdio: 'inherit' });
        return true;
      } catch (e3) {
        console.log('❌ Falha ao instalar yt-dlp');
        return false;
      }
    }
  }
}

// Verificar se já está instalado
let ytPath = checkYtDlp();

if (!ytPath) {
  console.log('❌ yt-dlp não encontrado. Instalando...');
  const success = installYtDlp();
  
  if (success) {
    ytPath = checkYtDlp();
    if (ytPath) {
      console.log('✅ yt-dlp instalado com sucesso!');
    } else {
      console.log('❌ yt-dlp ainda não está funcionando após instalação');
    }
  }
} else {
  console.log('✅ yt-dlp já está instalado e funcionando!');
}

// Testar funcionalidade
if (ytPath) {
  try {
    console.log('🧪 Testando yt-dlp...');
    const version = execSync(`${ytPath} --version`, { encoding: 'utf8' }).trim();
    console.log(`📋 Versão do yt-dlp: ${version}`);
    console.log('✅ yt-dlp está funcionando corretamente!');
  } catch (e) {
    console.log('❌ Erro ao testar yt-dlp:', e.message);
  }
}

console.log('\n📝 Instruções manuais se a instalação automática falhar:');
console.log('1. Instale Python: https://python.org');
console.log('2. Execute: pip install yt-dlp');
console.log('3. Ou baixe: https://github.com/yt-dlp/yt-dlp/releases');
console.log('4. Reinicie o servidor após instalar'); 