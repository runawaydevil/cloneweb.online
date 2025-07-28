#!/usr/bin/env node

// Script de instalação de dependências opcionais
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Instalando dependências opcionais para CloneWeb2Zip...\n');

const optionalDeps = [
  { name: 'sharp', description: 'Otimização de imagens' },
  { name: 'clean-css', description: 'Minificação de CSS' },
  { name: 'uglify-js', description: 'Minificação de JavaScript' }
];

async function installDep(depName) {
  return new Promise((resolve) => {
    console.log(`📦 Instalando ${depName}...`);
    
    const npm = spawn('npm', ['install', depName], {
      stdio: 'pipe',
      shell: true
    });
    
    npm.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${depName} instalado com sucesso`);
        resolve(true);
      } else {
        console.log(`⚠️ Falha ao instalar ${depName} (opcional)`);
        resolve(false);
      }
    });
    
    npm.on('error', () => {
      console.log(`⚠️ Erro ao instalar ${depName} (opcional)`);
      resolve(false);
    });
  });
}

async function testDep(depName) {
  try {
    require(depName);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log('🧪 Verificando dependências...\n');
  
  for (const dep of optionalDeps) {
    const isInstalled = await testDep(dep.name);
    
    if (isInstalled) {
      console.log(`✅ ${dep.name} - ${dep.description} (já instalado)`);
    } else {
      console.log(`❌ ${dep.name} - ${dep.description} (não encontrado)`);
      await installDep(dep.name);
    }
  }
  
  console.log('\n🎉 Instalação concluída!');
  console.log('\n📋 Status das funcionalidades:');
  
  for (const dep of optionalDeps) {
    const isInstalled = await testDep(dep.name);
    const status = isInstalled ? '✅ Ativo' : '⚠️ Desabilitado';
    console.log(`   ${dep.description}: ${status}`);
  }
  
  console.log('\n🚀 Execute "npm start" para iniciar o servidor');
}

main().catch(console.error);