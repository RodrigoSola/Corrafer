// ✅ SCRIPT DE VERIFICACIÓN PARA FACTURAS REALES
// Guardar como: checkProductionReady.js

import fs from 'fs';
import path from 'path';
import forge from 'node-forge';
import dotenv from 'dotenv';

dotenv.config();

console.log('🏛️ VERIFICACIÓN PARA FACTURAS REALES - CORRAFER');
console.log('='.repeat(55));

const checks = [];

// 1. Verificar ambiente
console.log('\n1️⃣ VERIFICANDO AMBIENTE...');
const isProduction = process.env.AFIP_ENV === 'production';
console.log(`   Ambiente actual: ${process.env.AFIP_ENV}`);
console.log(`   Modo: ${isProduction ? '🏛️ PRODUCCIÓN REAL' : '🧪 TESTING'}`);

if (isProduction) {
    checks.push({ name: 'Ambiente', status: '✅ PRODUCCIÓN - Facturas reales' });
} else {
    checks.push({ name: 'Ambiente', status: '⚠️ TESTING - Solo facturas de prueba' });
}

// 2. Verificar configuración empresa
console.log('\n2️⃣ VERIFICANDO CONFIGURACIÓN EMPRESA...');
const requiredVars = {
    'COMPANY_CUIT': process.env.COMPANY_CUIT,
    'COMPANY_NAME': process.env.COMPANY_NAME,
    'PUNTO_VENTA': process.env.PUNTO_VENTA,
    'COMPANY_ADDRESS': process.env.COMPANY_ADDRESS
};

let configOK = true;
for (const [key, value] of Object.entries(requiredVars)) {
    const exists = value && value.trim() !== '';
    console.log(`   ${key}: ${exists ? '✅' : '❌'} ${value || 'NO CONFIGURADO'}`);
    if (!exists) configOK = false;
}

checks.push({ 
    name: 'Configuración', 
    status: configOK ? '✅ Completa' : '❌ Incompleta' 
});

// 3. Verificar certificados AFIP
console.log('\n3️⃣ VERIFICANDO CERTIFICADOS AFIP...');
const certPath = process.env.AFIP_CERT_PATH;
const keyPath = process.env.AFIP_KEY_PATH;

let certValid = false;
let keyValid = false;
let certInfo = null;

if (certPath && fs.existsSync(certPath)) {
    try {
        const certPem = fs.readFileSync(certPath, 'utf8');
        const cert = forge.pki.certificateFromPem(certPem);
        
        const now = new Date();
        const validFrom = cert.validity.notBefore;
        const validTo = cert.validity.notAfter;
        const isValidNow = now >= validFrom && now <= validTo;
        
        console.log(`   Certificado: ✅ Encontrado`);
        console.log(`   Válido desde: ${validFrom.toLocaleDateString('es-AR')}`);
        console.log(`   Válido hasta: ${validTo.toLocaleDateString('es-AR')}`);
        console.log(`   Estado: ${isValidNow ? '✅ VÁLIDO' : '❌ EXPIRADO'}`);
        
        certValid = isValidNow;
        certInfo = {
            validFrom: validFrom,
            validTo: validTo,
            isValid: isValidNow,
            daysToExpiry: Math.floor((validTo - now) / (1000 * 60 * 60 * 24))
        };
        
    } catch (error) {
        console.log(`   Certificado: ❌ Error leyendo: ${error.message}`);
    }
} else {
    console.log(`   Certificado: ❌ No encontrado en: ${certPath}`);
}

if (keyPath && fs.existsSync(keyPath)) {
    try {
        const keyPem = fs.readFileSync(keyPath, 'utf8');
        forge.pki.privateKeyFromPem(keyPem);
        console.log(`   Clave privada: ✅ Válida`);
        keyValid = true;
    } catch (error) {
        console.log(`   Clave privada: ❌ Error: ${error.message}`);
    }
} else {
    console.log(`   Clave privada: ❌ No encontrada en: ${keyPath}`);
}

checks.push({ 
    name: 'Certificados', 
    status: (certValid && keyValid) ? '✅ Válidos' : '❌ Problema con certificados' 
});

// 4. Verificar URLs AFIP
console.log('\n4️⃣ VERIFICANDO URLS AFIP...');
const wsaaUrl = isProduction 
    ? 'https://wsaa.afip.gov.ar/ws/services/LoginCms'
    : 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms';
const wsfeUrl = isProduction
    ? 'https://servicios1.afip.gov.ar/wsfev1/service.asmx?WSDL'
    : 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx?WSDL';

console.log(`   WSAA: ${wsaaUrl}`);
console.log(`   WSFE: ${wsfeUrl}`);
console.log(`   Modo: ${isProduction ? '🏛️ PRODUCCIÓN' : '🧪 HOMOLOGACIÓN'}`);

checks.push({ 
    name: 'URLs AFIP', 
    status: `✅ Configuradas para ${isProduction ? 'PRODUCCIÓN' : 'TESTING'}` 
});

// RESUMEN FINAL
console.log('\n' + '='.repeat(55));
console.log('📊 RESUMEN DE VERIFICACIÓN');
console.log('='.repeat(55));

checks.forEach(check => {
    console.log(`${check.name.padEnd(20)}: ${check.status}`);
});

const allOK = checks.every(check => check.status.includes('✅'));

console.log('\n🎯 RESULTADO FINAL:');
if (allOK && isProduction) {
    console.log('✅ ¡LISTO PARA FACTURAS REALES!');
    console.log('🏛️ Sistema configurado correctamente para producción AFIP');
    console.log('⚠️  LAS FACTURAS GENERADAS TENDRÁN VALIDEZ FISCAL');
} else if (allOK && !isProduction) {
    console.log('✅ Sistema OK para modo testing');
    console.log('💡 Para activar facturas reales, cambiar AFIP_ENV=production');
} else {
    console.log('❌ SISTEMA NO LISTO');
    console.log('🔧 Revisar elementos marcados con ❌');
}

console.log('\n📋 PRÓXIMOS PASOS:');
if (isProduction && allOK) {
    console.log('1. Hacer backup de la base de datos');
    console.log('2. Probar con una factura simple primero');
    console.log('3. Verificar el CAE en el sitio de AFIP');
    console.log('4. Monitorear logs durante las primeras facturas');
} else {
    console.log('1. Corregir elementos con ❌');
    console.log('2. Volver a ejecutar esta verificación');
    console.log('3. Hacer pruebas en ambiente testing primero');
}

console.log('\n⚠️  IMPORTANTE:');
console.log('- En PRODUCCIÓN cada factura consume un número oficial');
console.log('- No se pueden anular facturas, solo emitir notas de crédito');
console.log('- Mantener backup de certificados y base de datos');

if (certInfo && certInfo.isValid && certInfo.daysToExpiry < 30) {
    console.log(`\n⏰ ADVERTENCIA: Certificado expira en ${certInfo.daysToExpiry} días`);
    console.log('   Renovar certificado AFIP pronto');
}