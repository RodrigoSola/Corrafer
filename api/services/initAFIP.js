// initAFIP-fixed.js - Versión CORREGIDA para CORRAFER
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// ✅ CARGAR .ENV MANUALMENTE (más confiable)
function loadEnvFile() {
    const envPaths = ['.env', '../.env', '../../.env'];
    let envVars = {};
    
    for (const envPath of envPaths) {
        try {
            if (fs.existsSync(envPath)) {
                console.log(`📄 Cargando .env desde: ${path.resolve(envPath)}`);
                const envContent = fs.readFileSync(envPath, 'utf8');
                
                envContent.split('\n').forEach(line => {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                        const [key, ...valueParts] = trimmed.split('=');
                        const value = valueParts.join('=').replace(/^["']|["']$/g, '').trim();
                        envVars[key.trim()] = value;
                        // También asignar a process.env
                        process.env[key.trim()] = value;
                    }
                });
                break;
            }
        } catch (error) {
            console.log(`⚠️ Error cargando ${envPath}:`, error.message);
        }
    }
    
    return envVars;
}

// Cargar variables de entorno
const envVars = loadEnvFile();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colores para la consola
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

const log = (message, color = 'reset') => {
    console.log(colors[color] + message + colors.reset);
};

class AFIPInitializerFixed {
    constructor() {
        // ✅ Configuración con fallbacks
        this.config = {
            cuit: process.env.COMPANY_CUIT || envVars.COMPANY_CUIT || '20292615834',
            razonSocial: process.env.COMPANY_NAME || envVars.COMPANY_NAME || 'CORRAFER',
            ptoVenta: process.env.PUNTO_VENTA || envVars.PUNTO_VENTA || '0001',
            environment: process.env.AFIP_ENV || envVars.AFIP_ENV || 'testing',
            certPath: process.env.AFIP_CERT_PATH || envVars.AFIP_CERT_PATH,
            keyPath: process.env.AFIP_KEY_PATH || envVars.AFIP_KEY_PATH,
            address: process.env.COMPANY_ADDRESS || envVars.COMPANY_ADDRESS || 'AVENIDA SAVIO 1940-SAN NICOLAS-BUENOS AIRES'
        };
        
        this.certDir = './certificates';
        this.backupDir = './backups';
    }

    // ✅ 1. VERIFICAR DEPENDENCIAS
    async checkDependencies() {
        log('\n🔍 1. Verificando dependencias...', 'blue');
        
        // Buscar package.json en múltiples ubicaciones
        const packagePaths = ['./package.json', '../package.json', '../../package.json'];
        let packageJson = null;
        
        for (const pkgPath of packagePaths) {
            try {
                if (fs.existsSync(pkgPath)) {
                    packageJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                    log(`✅ package.json encontrado en: ${path.resolve(pkgPath)}`, 'green');
                    break;
                }
            } catch (error) {
                log(`❌ Error leyendo ${pkgPath}: ${error.message}`, 'red');
            }
        }
        
        if (!packageJson) {
            log('❌ No se encontró package.json en ninguna ubicación', 'red');
            return false;
        }
        
        const requiredPackages = ['soap', 'xml2js', 'node-forge'];
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
        const missing = [];
        
        for (const pkg of requiredPackages) {
            if (!dependencies[pkg]) {
                missing.push(pkg);
                log(`❌ Falta: ${pkg}`, 'red');
            } else {
                log(`✅ ${pkg}: ${dependencies[pkg]}`, 'green');
            }
        }
        
        // Verificar OpenSSL
        try {
            execSync('openssl version', { stdio: 'pipe' });
            log('✅ OpenSSL disponible', 'green');
        } catch (e) {
            log('❌ OpenSSL no encontrado', 'red');
            missing.push('openssl');
        }
        
        if (missing.length > 0) {
            log('\n📦 Instalar dependencias faltantes:', 'yellow');
            const npmPackages = missing.filter(pkg => pkg !== 'openssl');
            if (npmPackages.length > 0) {
                log(`  npm install ${npmPackages.join(' ')}`, 'yellow');
            }
            return false;
        }
        
        return true;
    }

    // ✅ 2. VERIFICAR CONFIGURACIÓN
    checkConfiguration() {
        log('\n⚙️ 2. Verificando configuración...', 'blue');
        
        log(`📄 Variables cargadas del .env:`, 'cyan');
        Object.entries(envVars).forEach(([key, value]) => {
            if (['COMPANY_CUIT', 'COMPANY_NAME', 'PUNTO_VENTA', 'AFIP_ENV', 'COMPANY_ADDRESS'].includes(key)) {
                log(`  ${key}: ${value}`, 'cyan');
            }
        });
        
        const requiredEnvVars = [
            { key: 'COMPANY_CUIT', value: this.config.cuit, validation: /^\d{11}$/ },
            { key: 'COMPANY_NAME', value: this.config.razonSocial },
            { key: 'PUNTO_VENTA', value: this.config.ptoVenta, validation: /^\d{4}$/ },
            { key: 'COMPANY_ADDRESS', value: this.config.address }
        ];
        
        let allValid = true;
        
        for (const envVar of requiredEnvVars) {
            if (!envVar.value) {
                log(`❌ ${envVar.key}: NO CONFIGURADO`, 'red');
                allValid = false;
            } else if (envVar.validation && !envVar.validation.test(envVar.value)) {
                log(`❌ ${envVar.key}: FORMATO INVÁLIDO (${envVar.value})`, 'red');
                allValid = false;
            } else {
                log(`✅ ${envVar.key}: ${envVar.value}`, 'green');
            }
        }
        
        // Verificar ambiente
        if (!['testing', 'production'].includes(this.config.environment)) {
            log(`⚠️ AFIP_ENV: ${this.config.environment} (usando testing)`, 'yellow');
            this.config.environment = 'testing';
        } else {
            log(`✅ AFIP_ENV: ${this.config.environment}`, 'green');
        }
        
        return allValid;
    }

    // ✅ 3. CONFIGURAR DIRECTORIOS
    setupDirectories() {
        log('\n📁 3. Configurando directorios...', 'blue');
        
        const dirs = [this.certDir, this.backupDir, './invoices'];
        
        for (const dir of dirs) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                log(`✅ Directorio creado: ${dir}`, 'green');
            } else {
                log(`✅ Directorio existe: ${dir}`, 'green');
            }
        }
        
        return true;
    }

    // ✅ 4. VERIFICAR CERTIFICADOS
    checkCertificates() {
        log('\n🔐 4. Verificando certificados...', 'blue');
        
        // Buscar certificados en múltiples ubicaciones
        const certSearchPaths = [
            './certificates',
            '../certificates',
            '../../certificates',
            './api/services/certificates',
            './services/certificates'
        ];
        
        let foundCerts = false;
        let certPath, keyPath;
        
        for (const searchPath of certSearchPaths) {
            const testCertPath = path.join(searchPath, 'certificado.crt');
            const testKeyPath = path.join(searchPath, 'private.key');
            
            if (fs.existsSync(testCertPath) && fs.existsSync(testKeyPath)) {
                certPath = testCertPath;
                keyPath = testKeyPath;
                foundCerts = true;
                log(`✅ Certificados encontrados en: ${path.resolve(searchPath)}`, 'green');
                break;
            }
        }
        
        if (!foundCerts) {
            log(`❌ Certificados no encontrados`, 'red');
            log(`💡 Certificado necesario: BL5909368296111`, 'yellow');
            
            log('\n🔧 Para configurar certificado BL5909368296111:', 'yellow');
            log('1. Descargar desde ARCA: BL5909368296111.p12', 'yellow');
            log('2. Convertir:', 'yellow');
            log('   openssl pkcs12 -in BL5909368296111.p12 -out certificado.crt -clcerts -nokeys', 'yellow');
            log('   openssl pkcs12 -in BL5909368296111.p12 -out private.key -nocerts -nodes', 'yellow');
            log('3. Mover a ./certificates/', 'yellow');
            
            return false;
        }
        
        // Verificar contenido de certificados
        try {
            const certContent = fs.readFileSync(certPath, 'utf8');
            const keyContent = fs.readFileSync(keyPath, 'utf8');
            
            const isCertValid = certContent.includes('BEGIN CERTIFICATE') && certContent.includes('END CERTIFICATE');
            const isKeyValid = keyContent.includes('BEGIN PRIVATE KEY') || keyContent.includes('BEGIN RSA PRIVATE KEY');
            
            log(`  - Certificado: ${isCertValid ? '✅ Válido' : '❌ Inválido'}`, isCertValid ? 'green' : 'red');
            log(`  - Clave privada: ${isKeyValid ? '✅ Válida' : '❌ Inválida'}`, isKeyValid ? 'green' : 'red');
            
            return isCertValid && isKeyValid;
            
        } catch (error) {
            log(`❌ Error verificando certificados: ${error.message}`, 'red');
            return false;
        }
    }

    // ✅ 5. CREAR ARCHIVOS DE PRUEBA
    createTestFiles() {
        log('\n📝 5. Creando archivos de prueba...', 'blue');
        
        // Crear test de factura corregido
        const testScript = `// testInvoice.js - Test CORRAFER
import dotenv from 'dotenv';
dotenv.config();

const testInvoiceData = {
    client: {
        name: 'Cliente Test CORRAFER',
        typeOfClient: 'CF'
    },
    cartItems: [
        {
            name: 'Producto Test',
            quantity: 1,
            priceWithIVA: 100.00,
            priceWithoutIVA: 82.64
        }
    ],
    paymentMethod: 'Efectivo',
    testing: true
};

console.log('🧪 Test CORRAFER - Facturación AFIP');
console.log('URL:', 'http://localhost:3000/api/arca/generate-invoice');
console.log('Datos:', JSON.stringify(testInvoiceData, null, 2));

// Comando curl para prueba:
const curlCommand = \`curl -X POST http://localhost:3000/api/arca/generate-invoice -H "Content-Type: application/json" -d '\${JSON.stringify(testInvoiceData)}'\`;
console.log('\\nComando curl:');
console.log(curlCommand);
`;
        
        try {
            fs.writeFileSync('testInvoice.js', testScript);
            log('✅ testInvoice.js creado', 'green');
        } catch (error) {
            log(`❌ Error creando testInvoice.js: ${error.message}`, 'red');
            return false;
        }
        
        return true;
    }

    // ✅ 6. GENERAR RESUMEN
    generateSummary(results) {
        log('\n📋 RESUMEN INICIALIZACIÓN AFIP - CORRAFER', 'bright');
        log('='.repeat(60), 'blue');
        
        const allPassed = Object.values(results).every(r => r === true);
        
        Object.entries(results).forEach(([step, result]) => {
            const icon = result ? '✅' : '❌';
            const color = result ? 'green' : 'red';
            log(`${icon} ${step}`, color);
        });
        
        log('\n' + '='.repeat(60), 'blue');
        
        if (allPassed) {
            log('🎉 ¡INICIALIZACIÓN COMPLETADA EXITOSAMENTE!', 'bright');
            log('\n🚀 CORRAFER - Próximos pasos:', 'blue');
            log('1. Iniciar servidor: npm start', 'cyan');
            log('2. Probar factura: node testInvoice.js', 'cyan');
            log('3. Test manual: POST /api/arca/generate-invoice', 'cyan');
            
            if (this.config.environment === 'testing') {
                log('\n⚠️ AMBIENTE DE TESTING', 'yellow');
                log('- Facturas serán de prueba', 'yellow');
                log('- Cambiar AFIP_ENV=production para facturas reales', 'yellow');
            } else {
                log('\n🏛️ AMBIENTE DE PRODUCCIÓN', 'red');
                log('- ⚠️ FACTURAS SERÁN REALES Y OFICIALES', 'red');
                log('- Verificar todo antes de continuar', 'red');
            }
            
        } else {
            log('❌ HAY PROBLEMAS EN LA CONFIGURACIÓN', 'red');
            log('\n🔧 Solucionar y ejecutar nuevamente', 'yellow');
        }
        
        // Información CORRAFER
        log('\n🏢 INFORMACIÓN CORRAFER:', 'blue');
        log(`- CUIT: ${this.config.cuit}`, 'cyan');
        log(`- Razón Social: ${this.config.razonSocial}`, 'cyan');
        log(`- Punto de Venta: ${this.config.ptoVenta}`, 'cyan');
        log(`- Ambiente: ${this.config.environment.toUpperCase()}`, 'cyan');
        log(`- Certificado: BL5909368296111`, 'cyan');
        
        return allPassed;
    }

    // ✅ EJECUTAR TODOS LOS PASOS
    async run() {
        log('🏛️ INICIALIZADOR AFIP CORRAFER v2.0', 'bright');
        log('Sistema de facturación electrónica\n', 'cyan');
        
        const results = {};
        
        try {
            results['Dependencias'] = await this.checkDependencies();
            results['Configuración'] = this.checkConfiguration();
            results['Directorios'] = this.setupDirectories();
            results['Certificados'] = this.checkCertificates();
            results['Archivos de prueba'] = this.createTestFiles();
            
            return this.generateSummary(results);
            
        } catch (error) {
            log(`\n💥 Error durante inicialización: ${error.message}`, 'red');
            console.error(error.stack);
            return false;
        }
    }
}

// ✅ EJECUTAR
const currentFile = fileURLToPath(import.meta.url);
const isMainScript = process.argv[1] === currentFile;

if (isMainScript) {
    console.log('🚀 Iniciando configuración AFIP CORRAFER...\n');
    const initializer = new AFIPInitializerFixed();
    
    initializer.run().then(success => {
        console.log('\n' + '='.repeat(60));
        console.log(success ? '✅ CORRAFER AFIP - Configuración exitosa!' : '❌ Configuración con errores');
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('\n💥 Error fatal:', error.message);
        process.exit(1);
    });
}

export default AFIPInitializerFixed;