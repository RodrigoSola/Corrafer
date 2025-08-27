// quickfix.js - Arreglo rápido para problemas detectados
import fs from 'fs';
import path from 'path';

console.log('🔧 QUICK FIX PARA CORRAFER AFIP\n');

// ✅ 1. Corregir testInvoice.js (error de sintaxis)
const fixedTestScript = `// testInvoice.js - Script de prueba rápida CORRAFER
import dotenv from 'dotenv';
dotenv.config();

const testInvoiceData = {
    client: {
        name: 'Cliente de Prueba',
        typeOfClient: 'CF'
    },
    cartItems: [
        {
            name: 'Producto Test',
            quantity: 1,
            priceWithIVA: 1.00,
            priceWithoutIVA: 0.83
        }
    ],
    paymentMethod: 'Efectivo',
    testing: true // Cambiar a false para factura real
};

console.log('🧪 Probando factura CORRAFER...');
console.log('URL:', 'http://localhost:' + (process.env.PORT || 3000) + '/api/arca/generate-invoice');
console.log('Datos:', JSON.stringify(testInvoiceData, null, 2));

// Usar con curl:
const curlCommand = 'curl -X POST http://localhost:3000/api/arca/generate-invoice -H "Content-Type: application/json" -d \\'' + JSON.stringify(testInvoiceData) + '\\'';
console.log('\\nComando curl:');
console.log(curlCommand);
`;

// ✅ 2. Verificar directorio actual
console.log('📍 Directorio actual:', process.cwd());

// ✅ 3. Verificar estructura de archivos
const files = ['package.json', '.env', 'initAFIP.js'];
const locations = ['.', '..', '../..'];

console.log('\n🔍 Buscando archivos...');
for (const file of files) {
    for (const loc of locations) {
        const fullPath = path.join(loc, file);
        if (fs.existsSync(fullPath)) {
            console.log(`✅ ${file}: ${path.resolve(fullPath)}`);
            break;
        }
    }
}

// ✅ 4. Verificar certificados
console.log('\n🔐 Verificando certificados...');
const certPaths = ['./certificates', '../certificates', '../../certificates'];

for (const certPath of certPaths) {
    const certFile = path.join(certPath, 'certificado.crt');
    const keyFile = path.join(certPath, 'private.key');
    
    if (fs.existsSync(certFile) && fs.existsSync(keyFile)) {
        console.log(`✅ Certificados encontrados en: ${path.resolve(certPath)}`);
        
        // Verificar contenido básico
        try {
            const certContent = fs.readFileSync(certFile, 'utf8');
            const keyContent = fs.readFileSync(keyFile, 'utf8');
            
            if (certContent.includes('BEGIN CERTIFICATE')) {
                console.log('✅ Certificado válido');
            }
            if (keyContent.includes('BEGIN PRIVATE KEY') || keyContent.includes('BEGIN RSA PRIVATE KEY')) {
                console.log('✅ Clave privada válida');
            }
        } catch (e) {
            console.log('⚠️ Error verificando certificados:', e.message);
        }
        break;
    }
}

// ✅ 5. Crear testInvoice.js corregido
try {
    fs.writeFileSync('testInvoice.js', fixedTestScript);
    console.log('\n✅ testInvoice.js corregido creado');
} catch (error) {
    console.log('❌ Error creando testInvoice.js:', error.message);
}

// ✅ 6. Mostrar próximos pasos
console.log('\n📋 PRÓXIMOS PASOS:');
console.log('1. Ve al directorio raíz del proyecto:');
console.log('   cd ..');
console.log('   cd ..');
console.log('');
console.log('2. Copia el .env corregido al directorio raíz');
console.log('');
console.log('3. Ejecuta el inicializador desde el directorio raíz:');
console.log('   node services/initAFIP.js');
console.log('   # O mueve initAFIP.js al directorio raíz');
console.log('');
console.log('4. Si todo está OK, prueba la facturación:');
console.log('   node testInvoice.js');

console.log('\n🎯 DATOS CORRAFER DETECTADOS:');
console.log('- CUIT: 20292615834');
console.log('- Certificado: BL5909368296111');  
console.log('- Ambiente: PRODUCCIÓN');
console.log('- Punto de venta: 0001');
console.log('\n⚠️ IMPORTANTE: Estás en ambiente PRODUCTION');
console.log('   Las facturas generadas serán REALES y oficiales');