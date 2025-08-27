// debug.js - Diagnosticar problemas de configuración
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 DIAGNÓSTICO COMPLETO CORRAFER\n');

// ✅ 1. Información del sistema
console.log('📍 UBICACIÓN:');
console.log('- Directorio actual:', process.cwd());
console.log('- Script ubicado en:', __dirname);
console.log('- Node.js versión:', process.version);
console.log('');

// ✅ 2. Buscar archivos importantes
console.log('🔍 BUSCANDO ARCHIVOS:');
const importantFiles = [
    'package.json',
    '.env',
    '.env.example',
    'services/initAFIP.js',
    'api/services/initAFIP.js'
];

const searchPaths = [
    '.',
    '..',
    '../..',
    './api',
    '../api'
];

for (const file of importantFiles) {
    let found = false;
    for (const searchPath of searchPaths) {
        const fullPath = path.join(searchPath, file);
        try {
            if (fs.existsSync(fullPath)) {
                console.log(`✅ ${file}: ${path.resolve(fullPath)}`);
                found = true;
                break;
            }
        } catch (e) {
            // Ignorar errores
        }
    }
    if (!found) {
        console.log(`❌ ${file}: NO ENCONTRADO`);
    }
}

// ✅ 3. Verificar certificados en múltiples ubicaciones
console.log('\n🔐 BUSCANDO CERTIFICADOS:');
const certSearchPaths = [
    './certificates',
    '../certificates', 
    '../../certificates',
    './api/certificates',
    './api/services/certificates',
    './services/certificates'
];

for (const certPath of certSearchPaths) {
    const certFile = path.join(certPath, 'certificado.crt');
    const keyFile = path.join(certPath, 'private.key');
    
    if (fs.existsSync(certFile) || fs.existsSync(keyFile)) {
        console.log(`📂 Directorio: ${path.resolve(certPath)}`);
        console.log(`  - certificado.crt: ${fs.existsSync(certFile) ? '✅' : '❌'}`);
        console.log(`  - private.key: ${fs.existsSync(keyFile) ? '✅' : '❌'}`);
    }
}

// ✅ 4. Leer .env manualmente
console.log('\n📄 CONTENIDO .ENV:');
const envSearchPaths = ['.env', '../.env', '../../.env'];

for (const envPath of envSearchPaths) {
    try {
        if (fs.existsSync(envPath)) {
            console.log(`\n📍 Archivo: ${path.resolve(envPath)}`);
            const envContent = fs.readFileSync(envPath, 'utf8');
            
            // Parsear variables manualmente
            const lines = envContent.split('\n');
            const vars = {};
            
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    const [key, ...valueParts] = trimmed.split('=');
                    if (key && valueParts.length > 0) {
                        vars[key.trim()] = valueParts.join('=').replace(/"/g, '').trim();
                    }
                }
            }
            
            // Mostrar variables importantes
            const importantVars = [
                'COMPANY_CUIT',
                'COMPANY_NAME', 
                'PUNTO_VENTA',
                'COMPANY_ADDRESS',
                'AFIP_ENV',
                'AFIP_CERT_PATH',
                'AFIP_KEY_PATH'
            ];
            
            console.log('Variables encontradas:');
            for (const varName of importantVars) {
                const value = vars[varName] || 'NO CONFIGURADO';
                console.log(`  ${varName}: ${value}`);
            }
            break;
        }
    } catch (error) {
        console.log(`❌ Error leyendo ${envPath}:`, error.message);
    }
}

// ✅ 5. Variables de entorno actuales
console.log('\n🌍 VARIABLES DE ENTORNO ACTUALES:');
const currentEnvVars = [
    'COMPANY_CUIT',
    'COMPANY_NAME',
    'PUNTO_VENTA', 
    'COMPANY_ADDRESS',
    'AFIP_ENV',
    'AFIP_CERT_PATH',
    'AFIP_KEY_PATH',
    'NODE_ENV',
    'PORT'
];

for (const varName of currentEnvVars) {
    const value = process.env[varName] || 'NO CONFIGURADO';
    console.log(`  ${varName}: ${value}`);
}

// ✅ 6. Crear archivos necesarios
console.log('\n🛠️ CREANDO ARCHIVOS NECESARIOS:');

// Crear .env correcto
const correctEnv = `# .env - CORRAFER AFIP Configuration
# ====================================

# 🏛️ AFIP Configuration  
AFIP_ENV=testing
AFIP_CUIT_REP=20292615834

# 🏢 Company Data
COMPANY_CUIT=20292615834
COMPANY_NAME=CORRAFER
PUNTO_VENTA=0001
COMPANY_ADDRESS=AVENIDA SAVIO 1940-SAN NICOLAS-BUENOS AIRES

# 🔐 Certificates
AFIP_CERT_PATH=certificates/certificado.crt
AFIP_KEY_PATH=certificates/private.key

# 🖥️ Server
PORT=3000
NODE_ENV=development

# 📊 Database
MONGO_URI=mongodb://localhost:27017/Corrafer
`;

try {
    // Crear .env en el directorio actual si no existe
    if (!fs.existsSync('.env')) {
        fs.writeFileSync('.env', correctEnv);
        console.log('✅ .env creado en directorio actual');
    } else {
        console.log('⚠️ .env ya existe en directorio actual');
    }
    
    // Crear también en directorio padre si estamos en subdirectorio
    const parentEnv = '../.env';
    if (!fs.existsSync(parentEnv)) {
        fs.writeFileSync(parentEnv, correctEnv);
        console.log('✅ .env creado en directorio padre');
    } else {
        console.log('⚠️ .env ya existe en directorio padre');
    }
    
} catch (error) {
    console.log('❌ Error creando .env:', error.message);
}

// ✅ 7. Recomendaciones
console.log('\n🎯 RECOMENDACIONES:');
console.log('1. 📂 Ubicación recomendada para ejecutar:');
console.log('   - Ve al directorio raíz donde está package.json');
console.log('   - Ejecuta desde ahí: node services/initAFIP.js');
console.log('');
console.log('2. 🔐 Certificados:');
console.log('   - Deben estar en el directorio "certificates"');
console.log('   - Nombres exactos: certificado.crt y private.key');
console.log('');
console.log('3. 📄 Variables .env:');
console.log('   - Usar el .env que acabo de crear');
console.log('   - Sin comillas en los valores');
console.log('   - Rutas relativas para certificados');

console.log('\n✅ Diagnóstico completado. Revisa los pasos de arriba.');