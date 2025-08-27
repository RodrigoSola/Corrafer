// test-init.js - Prueba rápida para verificar que funciona
import fs from 'fs';
import { fileURLToPath } from 'url';

console.log('🧪 Testing script execution...');

// Test básico de ES modules
const currentFile = fileURLToPath(import.meta.url);
console.log('✅ Current file:', currentFile);

// Test de archivos
console.log('✅ Checking files...');
console.log('- package.json:', fs.existsSync('./package.json') ? '✅' : '❌');
console.log('- .env:', fs.existsSync('./.env') ? '✅' : '❌');

// Test de variables de entorno
console.log('✅ Environment variables:');
console.log('- NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('- COMPANY_CUIT:', process.env.COMPANY_CUIT || 'not set');

// Test de importación dinámica
try {
    // Intentar importar el inicializador corregido
    const AFIPInitializer = (await import('./initAFIP.js')).default;
    console.log('✅ AFIPInitializer imported successfully');
    
    // Crear instancia sin ejecutar
    const initializer = new AFIPInitializer();
    console.log('✅ AFIPInitializer instance created');
    
    console.log('\n🎉 ¡Todo funciona! Ahora ejecuta: node initAFIP.js');
    
} catch (error) {
    console.error('❌ Error importing AFIPInitializer:', error.message);
    
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
        console.log('💡 Asegúrate de que initAFIP.js existe en el directorio actual');
    }
}