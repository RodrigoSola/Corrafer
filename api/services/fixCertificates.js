import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Script para regenerar certificados desde archivo P12
export const regenerateCertificatesFromP12 = async () => {
    console.log('🔄 REGENERANDO CERTIFICADOS DESDE P12');
    console.log('====================================');
    
    // Buscar archivo P12 en la carpeta certificates
    const certDir = path.resolve('certificates');
    console.log(`📂 Buscando archivos P12 en: ${certDir}`);
    
    if (!fs.existsSync(certDir)) {
        fs.mkdirSync(certDir, { recursive: true });
        console.log('📁 Directorio certificates creado');
    }
    
    // Buscar archivos P12
    const files = fs.readdirSync(certDir);
    const p12Files = files.filter(file => file.toLowerCase().endsWith('.p12') || file.toLowerCase().endsWith('.pfx'));
    
    console.log(`🔍 Archivos P12 encontrados: ${p12Files.length}`);
    p12Files.forEach(file => console.log(`   - ${file}`));
    
    if (p12Files.length === 0) {
        console.log('\n❌ No se encontraron archivos P12/PFX');
        console.log('🔧 PASOS A SEGUIR:');
        console.log('   1. Descargar certificado desde portal AFIP');
        console.log('   2. Guardar como .p12 en carpeta certificates/');
        console.log('   3. Ejecutar este script nuevamente');
        return false;
    }
    
    // Usar el primer archivo P12 encontrado
    const p12File = p12Files[0];
    const p12Path = path.join(certDir, p12File);
    
    console.log(`\n📄 Usando archivo: ${p12File}`);
    
    // Solicitar contraseña (en un entorno real, usar readline)
    console.log('\n⚠️ NOTA: Necesitarás la contraseña del certificado P12');
    console.log('En un entorno de producción, usar variables de entorno para la contraseña');
    
    // Comandos OpenSSL para extraer certificado y clave
    const certOutputPath = path.join(certDir, 'certificado.crt');
    const keyOutputPath = path.join(certDir, 'private.key');
    
    try {
        console.log('\n🔓 Extrayendo certificado...');
        
        // Comando para extraer certificado
        const certCommand = `openssl pkcs12 -in "${p12Path}" -clcerts -nokeys -out "${certOutputPath}" -passin pass:""`;
        
        // Comando para extraer clave privada
        const keyCommand = `openssl pkcs12 -in "${p12Path}" -nocerts -nodes -out "${keyOutputPath}" -passin pass:""`;
        
        console.log('📋 Comandos OpenSSL a ejecutar:');
        console.log(`   Certificado: ${certCommand}`);
        console.log(`   Clave: ${keyCommand}`);
        
        console.log('\n⚠️ Si el certificado tiene contraseña, ejecutar manualmente:');
        console.log(`   openssl pkcs12 -in "${p12Path}" -clcerts -nokeys -out "${certOutputPath}"`);
        console.log(`   openssl pkcs12 -in "${p12Path}" -nocerts -nodes -out "${keyOutputPath}"`);
        
        // Intentar sin contraseña primero
        try {
            execSync(certCommand, { stdio: 'inherit' });
            execSync(keyCommand, { stdio: 'inherit' });
            
            console.log('\n✅ Certificados extraídos sin contraseña');
            
        } catch (noPassError) {
            console.log('\n⚠️ Extracción sin contraseña falló (normal si tiene contraseña)');
            console.log('🔧 Ejecutar comandos manualmente con contraseña:');
            console.log(`\n1. Extraer certificado:`);
            console.log(`   openssl pkcs12 -in "${p12Path}" -clcerts -nokeys -out "${certOutputPath}"`);
            console.log(`\n2. Extraer clave privada:`);
            console.log(`   openssl pkcs12 -in "${p12Path}" -nocerts -nodes -out "${keyOutputPath}"`);
            
            return false;
        }
        
        // Verificar archivos generados
        if (fs.existsSync(certOutputPath) && fs.existsSync(keyOutputPath)) {
            console.log('\n✅ Archivos generados:');
            console.log(`   📄 ${certOutputPath}`);
            console.log(`   🔑 ${keyOutputPath}`);
            
            // Verificar contenido
            const certContent = fs.readFileSync(certOutputPath, 'utf8');
            const keyContent = fs.readFileSync(keyOutputPath, 'utf8');
            
            const certValid = certContent.includes('-----BEGIN CERTIFICATE-----');
            const keyValid = keyContent.includes('-----BEGIN PRIVATE KEY-----') || 
                           keyContent.includes('-----BEGIN RSA PRIVATE KEY-----');
            
            console.log(`   📄 Certificado válido: ${certValid ? '✅' : '❌'}`);
            console.log(`   🔑 Clave válida: ${keyValid ? '✅' : '❌'}`);
            
            if (certValid && keyValid) {
                console.log('\n🎉 ¡Certificados regenerados correctamente!');
                console.log('🔧 Reiniciar servidor para usar nuevos certificados');
                return true;
            }
        }
        
        return false;
        
    } catch (error) {
        console.error('\n❌ Error regenerando certificados:', error.message);
        console.error('\n🔧 VERIFICAR:');
        console.error('   - OpenSSL instalado (https://slproweb.com/products/Win32OpenSSL.html)');
        console.error('   - Permisos de escritura en carpeta certificates');
        console.error('   - Archivo P12 no corrupto');
        
        return false;
    }
};

// Script alternativo usando Node.js puro (sin OpenSSL)
export const regenerateUsingNodeForge = async (p12Path, password = '') => {
    console.log('🔄 REGENERANDO CON NODE-FORGE');
    console.log('============================');
    
    try {
        const forge = await import('node-forge');
        
        if (!fs.existsSync(p12Path)) {
            throw new Error(`Archivo P12 no encontrado: ${p12Path}`);
        }
        
        console.log(`📄 Leyendo: ${p12Path}`);
        
        // Leer archivo P12
        const p12Content = fs.readFileSync(p12Path);
        const p12Der = p12Content.toString('binary');
        
        console.log('🔓 Parseando P12...');
        
        // Parsear P12
        const p12Asn1 = forge.default.asn1.fromDer(p12Der);
        const p12Parsed = forge.default.pkcs12.pkcs12FromAsn1(p12Asn1, password);
        
        // Extraer certificado
        console.log('📄 Extrayendo certificado...');
        const certBags = p12Parsed.getBags({ bagType: forge.default.pki.oids.certBag });
        if (!certBags[forge.default.pki.oids.certBag] || certBags[forge.default.pki.oids.certBag].length === 0) {
            throw new Error('No se encontró certificado en el archivo P12');
        }
        
        const certBag = certBags[forge.default.pki.oids.certBag][0];
        const certificate = certBag.cert;
        
        // Extraer clave privada
        console.log('🔑 Extrayendo clave privada...');
        const keyBags = p12Parsed.getBags({ bagType: forge.default.pki.oids.pkcs8ShroudedKeyBag });
        if (!keyBags[forge.default.pki.oids.pkcs8ShroudedKeyBag] || keyBags[forge.default.pki.oids.pkcs8ShroudedKeyBag].length === 0) {
            throw new Error('No se encontró clave privada en el archivo P12');
        }
        
        const keyBag = keyBags[forge.default.pki.oids.pkcs8ShroudedKeyBag][0];
        const privateKey = keyBag.key;
        
        // Convertir a PEM
        console.log('📝 Convirtiendo a formato PEM...');
        const certPem = forge.default.pki.certificateToPem(certificate);
        const keyPem = forge.default.pki.privateKeyToPem(privateKey);
        
        // Guardar archivos
        const certDir = path.dirname(p12Path);
        const certPath = path.join(certDir, 'certificado.crt');
        const keyPath = path.join(certDir, 'private.key');
        
        fs.writeFileSync(certPath, certPem);
        fs.writeFileSync(keyPath, keyPem);
        
        console.log('✅ Archivos guardados:');
        console.log(`   📄 ${certPath}`);
        console.log(`   🔑 ${keyPath}`);
        
        // Verificar correspondencia
        console.log('🔍 Verificando correspondencia...');
        
        // Crear mensaje de prueba
        const testMessage = 'test message';
        const md = forge.default.md.sha256.create();
        md.update(testMessage, 'utf8');
        
        // Firmar con clave privada
        const signature = privateKey.sign(md);
        
        // Verificar con clave pública del certificado
        const publicKey = certificate.publicKey;
        const verified = publicKey.verify(md.digest().bytes(), signature);
        
        console.log(`🔐 Correspondencia: ${verified ? '✅ CORRECTA' : '❌ INCORRECTA'}`);
        
        if (verified) {
            console.log('\n🎉 ¡Certificados regenerados y verificados correctamente!');
            console.log('🔧 Reiniciar servidor Node.js para usar nuevos certificados');
            return true;
        } else {
            throw new Error('La clave privada no corresponde al certificado');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        
        if (error.message.includes('Invalid p12')) {
            console.error('🔧 El archivo P12 podría tener contraseña o estar corrupto');
        }
        
        if (error.message.includes('MAC verify error')) {
            console.error('🔧 Contraseña incorrecta del archivo P12');
        }
        
        return false;
    }
};

// Script principal de ejecución
export const fixCertificates = async () => {
    console.log('🚀 INICIANDO REPARACIÓN DE CERTIFICADOS');
    console.log('=======================================');
    
    const certDir = path.resolve('services');
    
    // Buscar archivos P12
    const files = fs.readdirSync(certDir);
    const p12Files = files.filter(file => 
        file.toLowerCase().endsWith('.p12') || 
        file.toLowerCase().endsWith('.pfx')
    );
    
    if (p12Files.length > 0) {
        const p12Path = path.join(certDir, p12Files[0]);
        console.log(`📄 Archivo P12 encontrado: ${p12Files[0]}`);
        
        // Intentar con contraseña vacía primero
        console.log('🔓 Intentando con contraseña vacía...');
        const success = await regenerateUsingNodeForge(p12Path, '');
        
        if (!success) {
            console.log('\n⚠️ Falló con contraseña vacía');
            console.log('🔧 PRÓXIMOS PASOS:');
            console.log('   1. Si conoces la contraseña, ejecútala así:');
            console.log(`   regenerateUsingNodeForge('${p12Path}', 'TU_CONTRASEÑA')`);
            console.log('   2. O usar OpenSSL manualmente');
        }
        
        return success;
    } else {
        console.log('❌ No se encontraron archivos P12');
        return await regenerateCertificatesFromP12();
    }
};

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
    fixCertificates();
}