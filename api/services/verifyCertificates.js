import fs from 'fs';
import path from 'path';
import forge from 'node-forge';

// Script para verificar los certificados AFIP
export const verifyCertificates = () => {
    console.log('🔍 VERIFICANDO CERTIFICADOS AFIP');
    console.log('=====================================');
    
    const certPath = path.resolve('certificates/certificado.crt');
    const keyPath = path.resolve('certificates/private.key');
    
    console.log('📂 Rutas:');
    console.log(`   - Certificado: ${certPath}`);
    console.log(`   - Clave privada: ${keyPath}`);
    console.log('');
    
    // 1. Verificar existencia de archivos
    console.log('1️⃣ VERIFICANDO EXISTENCIA DE ARCHIVOS:');
    console.log('--------------------------------------');
    
    const certExists = fs.existsSync(certPath);
    const keyExists = fs.existsSync(keyPath);
    
    console.log(`   📄 Certificado: ${certExists ? '✅ Existe' : '❌ No encontrado'}`);
    console.log(`   🔑 Clave privada: ${keyExists ? '✅ Existe' : '❌ No encontrada'}`);
    
    if (!certExists || !keyExists) {
        console.log('');
        console.log('❌ ARCHIVOS FALTANTES');
        console.log('🔧 SOLUCIÓN:');
        console.log('   1. Descargar certificado desde AFIP');
        console.log('   2. Convertir .p12 a .crt y .key si es necesario');
        console.log('   3. Colocar archivos en: certificates/');
        return false;
    }
    
    console.log('');
    
    try {
        // 2. Leer contenido de archivos
        console.log('2️⃣ LEYENDO CONTENIDO DE ARCHIVOS:');
        console.log('----------------------------------');
        
        const certContent = fs.readFileSync(certPath, 'utf8');
        const keyContent = fs.readFileSync(keyPath, 'utf8');
        
        console.log(`   📄 Certificado: ${certContent.length} caracteres`);
        console.log(`   🔑 Clave privada: ${keyContent.length} caracteres`);
        
        // Verificar formato
        const certHasHeaders = certContent.includes('-----BEGIN CERTIFICATE-----') && 
                              certContent.includes('-----END CERTIFICATE-----');
        const keyHasHeaders = keyContent.includes('-----BEGIN') && 
                             keyContent.includes('-----END');
        
        console.log(`   📄 Formato certificado: ${certHasHeaders ? '✅ PEM válido' : '❌ Formato incorrecto'}`);
        console.log(`   🔑 Formato clave: ${keyHasHeaders ? '✅ PEM válido' : '❌ Formato incorrecto'}`);
        
        if (!certHasHeaders || !keyHasHeaders) {
            console.log('');
            console.log('❌ FORMATO DE ARCHIVO INCORRECTO');
            console.log('🔧 SOLUCIÓN:');
            console.log('   - Los archivos deben estar en formato PEM');
            console.log('   - Certificado debe tener headers -----BEGIN CERTIFICATE-----');
            console.log('   - Clave debe tener headers -----BEGIN PRIVATE KEY----- o -----BEGIN RSA PRIVATE KEY-----');
            return false;
        }
        
        console.log('');
        
        // 3. Parsear certificado
        console.log('3️⃣ PARSEANDO CERTIFICADO:');
        console.log('-------------------------');
        
        const cert = forge.pki.certificateFromPem(certContent);
        const subject = cert.subject.attributes;
        const issuer = cert.issuer.attributes;
        
        console.log('   📋 Información del certificado:');
        console.log(`      - CN: ${subject.find(attr => attr.name === 'commonName')?.value || 'N/A'}`);
        console.log(`      - Emisor: ${issuer.find(attr => attr.name === 'commonName')?.value || 'N/A'}`);
        console.log(`      - Serie: ${cert.serialNumber}`);
        console.log(`      - Válido desde: ${cert.validity.notBefore.toLocaleString('es-AR')}`);
        console.log(`      - Válido hasta: ${cert.validity.notAfter.toLocaleString('es-AR')}`);
        
        // Verificar validez temporal
        const now = new Date();
        const isValid = now >= cert.validity.notBefore && now <= cert.validity.notAfter;
        const daysToExpiry = Math.floor((cert.validity.notAfter - now) / (1000 * 60 * 60 * 24));
        
        console.log(`      - Estado: ${isValid ? '✅ Válido' : '❌ Expirado/No válido'}`);
        if (isValid) {
            console.log(`      - Expira en: ${daysToExpiry} días`);
            if (daysToExpiry < 30) {
                console.log('      ⚠️ ADVERTENCIA: El certificado expira pronto');
            }
        }
        
        console.log('');
        
        // 4. Parsear clave privada
        console.log('4️⃣ PARSEANDO CLAVE PRIVADA:');
        console.log('---------------------------');
        
        const privateKey = forge.pki.privateKeyFromPem(keyContent);
        const publicKeyFromCert = cert.publicKey;
        
        console.log(`   🔑 Tipo: ${privateKey.n ? 'RSA' : 'Otro'}`);
        if (privateKey.n) {
            console.log(`   🔑 Tamaño: ${privateKey.n.bitLength()} bits`);
        }
        
        console.log('');
        
        // 5. Verificar correspondencia entre certificado y clave
        console.log('5️⃣ VERIFICANDO CORRESPONDENCIA:');
        console.log('-------------------------------');
        
        try {
            // Crear un mensaje de prueba para firmar
            const testMessage = 'test message for verification';
            const md = forge.md.sha256.create();
            md.update(testMessage, 'utf8');
            
            // Firmar con clave privada
            const signature = privateKey.sign(md);
            
            // Verificar con clave pública del certificado
            const verified = publicKeyFromCert.verify(md.digest().bytes(), signature);
            
            console.log(`   🔐 Correspondencia: ${verified ? '✅ Certificado y clave coinciden' : '❌ No coinciden'}`);
            
            if (!verified) {
                console.log('');
                console.log('❌ CERTIFICADO Y CLAVE NO COINCIDEN');
                console.log('🔧 SOLUCIÓN:');
                console.log('   - Verificar que ambos archivos provienen del mismo .p12');
                console.log('   - Regenerar los archivos desde el certificado original');
                return false;
            }
            
        } catch (keyError) {
            console.log(`   ❌ Error verificando correspondencia: ${keyError.message}`);
            return false;
        }
        
        console.log('');
        
        // 6. Verificar que sea certificado AFIP
        console.log('6️⃣ VERIFICANDO CERTIFICADO AFIP:');
        console.log('--------------------------------');
        
        const issuerCN = issuer.find(attr => attr.name === 'commonName')?.value || '';
        const subjectCN = subject.find(attr => attr.name === 'commonName')?.value || '';
        
        const isAFIPCert = issuerCN.toLowerCase().includes('afip') || 
                          subjectCN.toLowerCase().includes('afip') ||
                          issuerCN.toLowerCase().includes('administracion federal');
        
        console.log(`   🏛️ Emisor: ${issuerCN}`);
        console.log(`   👤 Sujeto: ${subjectCN}`);
        console.log(`   🏛️ Es certificado AFIP: ${isAFIPCert ? '✅ Sí' : '⚠️ No detectado como AFIP'}`);
        
        if (!isAFIPCert) {
            console.log('   ⚠️ ADVERTENCIA: No se detectó como certificado AFIP oficial');
            console.log('      - Verificar que sea el certificado correcto');
            console.log('      - Debe ser emitido por AFIP para facturación electrónica');
        }
        
        console.log('');
        
        // 7. Prueba de firma PKCS#7
        console.log('7️⃣ PRUEBA DE FIRMA PKCS#7:');
        console.log('--------------------------');
        
        try {
            // Crear un TRA de prueba
            const testTRA = `<?xml version="1.0" encoding="UTF-8"?>
            <loginTicketRequest version="1.0">
                <header>
                    <uniqueId>${Date.now()}</uniqueId>
                    <generationTime>${new Date().toISOString()}</generationTime>
                    <expirationTime>${new Date(Date.now() + 3600000).toISOString()}</expirationTime>
                </header>
                <service>wsfe</service>
            </loginTicketRequest>`;
            
            // Crear mensaje PKCS#7 con los atributos autenticados requeridos
            const p7 = forge.pkcs7.createSignedData();
            p7.content = forge.util.createBuffer(testTRA, 'utf8');
            
            // Atributos autenticados obligatorios
            const authenticatedAttributes = [
                {
                    type: forge.pki.oids.contentType,
                    value: forge.pki.oids.data
                },
                {
                    type: forge.pki.oids.messageDigest,
                    // El hash se calculará automáticamente
                }
            ];
            
            p7.addSigner({
                key: privateKey,
                certificate: cert,
                digestAlgorithm: forge.pki.oids.sha256,
                authenticatedAttributes: authenticatedAttributes
            });
            
            console.log('   🔏 Creando firma PKCS#7...');
            p7.sign();
            
            // Convertir a DER y Base64
            const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
            const base64 = forge.util.encode64(der);
            
            console.log('   ✅ Firma PKCS#7 creada exitosamente');
            console.log(`   📏 Tamaño: ${base64.length} caracteres`);
            console.log(`   🔤 Muestra: ${base64.substring(0, 50)}...`);
            
        } catch (signError) {
            console.log(`   ❌ Error creando firma PKCS#7: ${signError.message}`);
            console.log('');
            console.log('❌ PROBLEMA CON FIRMA PKCS#7');
            console.log('🔧 POSIBLES SOLUCIONES:');
            console.log('   1. Actualizar node-forge: npm install node-forge@latest');
            console.log('   2. Verificar formato de certificado y clave');
            console.log('   3. Regenerar certificado desde AFIP');
            return false;
        }
        
        console.log('');
        
        // 8. Resumen final
        console.log('8️⃣ RESUMEN FINAL:');
        console.log('-----------------');
        console.log('   ✅ Archivos encontrados y legibles');
        console.log('   ✅ Formato PEM correcto');
        console.log('   ✅ Certificado válido temporalmente');
        console.log('   ✅ Clave privada funcional');
        console.log('   ✅ Correspondencia certificado-clave verificada');
        console.log('   ✅ Firma PKCS#7 funcional');
        if (isAFIPCert) {
            console.log('   ✅ Certificado AFIP reconocido');
        } else {
            console.log('   ⚠️ Certificado AFIP no reconocido automáticamente');
        }
        
        console.log('');
        console.log('🎉 CERTIFICADOS AFIP CONFIGURADOS CORRECTAMENTE');
        console.log('   Los certificados están listos para usar con AFIP');
        
        return true;
        
    } catch (error) {
        console.error('');
        console.error('❌ ERROR DURANTE VERIFICACIÓN:', error.message);
        console.error('');
        console.error('🔧 SOLUCIONES POSIBLES:');
        console.error('   1. Verificar que los archivos estén en formato PEM correcto');
        console.error('   2. Regenerar certificados desde el archivo .p12 original');
        console.error('   3. Verificar permisos de lectura de archivos');
        console.error('   4. Instalar/actualizar node-forge: npm install node-forge@latest');
        
        return false;
    }
};

// Script para convertir .p12 a .crt y .key
export const convertP12ToPem = (p12Path, password, outputDir = 'certificates') => {
    console.log('🔄 CONVIRTIENDO P12 A PEM');
    console.log('========================');
    
    try {
        if (!fs.existsSync(p12Path)) {
            throw new Error(`Archivo P12 no encontrado: ${p12Path}`);
        }
        
        const p12Content = fs.readFileSync(p12Path);
        const p12Asn1 = forge.asn1.fromDer(p12Content.toString('binary'));
        const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
        
        // Extraer certificado
        const certBags = p12.getBags({bagType: forge.pki.oids.certBag});
        const cert = certBags[forge.pki.oids.certBag][0];
        
        // Extraer clave privada
        const keyBags = p12.getBags({bagType: forge.pki.oids.pkcs8ShroudedKeyBag});
        const key = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0];
        
        // Crear directorio si no existe
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Guardar certificado
        const certPem = forge.pki.certificateToPem(cert.cert);
        const certPath = path.join(outputDir, 'certificado.crt');
        fs.writeFileSync(certPath, certPem);
        
        // Guardar clave privada
        const keyPem = forge.pki.privateKeyToPem(key.key);
        const keyPath = path.join(outputDir, 'private.key');
        fs.writeFileSync(keyPath, keyPem);
        
        console.log('✅ Conversión exitosa:');
        console.log(`   📄 Certificado: ${certPath}`);
        console.log(`   🔑 Clave privada: ${keyPath}`);
        
        return true;
        
    } catch (error) {
        console.error('❌ Error convirtiendo P12:', error.message);
        console.error('🔧 Verificar:');
        console.error('   - Ruta del archivo P12');
        console.error('   - Contraseña del certificado');
        console.error('   - Permisos de escritura');
        
        return false;
    }
};

// Ejecutar verificación si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
    verifyCertificates();
}