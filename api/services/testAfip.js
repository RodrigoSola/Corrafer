// Agregar esta ruta a tu archivo de rutas (routes/arcaRoutes.js)
import AFIPClient from '../services/afipClient.js';

// ✅ RUTA PARA PROBAR CONEXIÓN AFIP
export const testAFIPConnection = async (req, res) => {
    try {
        console.log('🧪 Iniciando test de conexión AFIP...');
        
        // Configuración desde variables de entorno
        const config = {
            cuit: process.env.COMPANY_CUIT || "20292615834",
            razonSocial: process.env.COMPANY_NAME || "CORRAFER",
            ptoVenta: process.env.PUNTO_VENTA || "0001",
            
            afip: {
                environment: process.env.AFIP_ENV || 'testing',
                cuitRepresentante: process.env.AFIP_CUIT_REP,
                certificatePath: process.env.AFIP_CERT_PATH || './certificates/certificado.crt',
                privateKeyPath: process.env.AFIP_KEY_PATH || './certificates/private.key',
                
                wsaaUrl: process.env.AFIP_ENV === 'production' 
                    ? 'https://wsaa.afip.gov.ar/ws/services/LoginCms'
                    : 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
                    
                wsfeUrl: process.env.AFIP_ENV === 'production'
                    ? 'https://servicios1.afip.gov.ar/wsfev1/service.asmx'
                    : 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx'
            }
        };
        
        console.log('📋 Configuración AFIP:', {
            environment: config.afip.environment,
            cuit: config.cuit,
            ptoVenta: config.ptoVenta,
            certificatePath: config.afip.certificatePath
        });
        
        const client = new AFIPClient(config);
        const results = {};
        
        // Test 1: Autenticación
        try {
            console.log('1️⃣ Probando autenticación...');
            const authResult = await client.authenticate();
            
            results.authentication = {
                success: true,
                token: authResult.token ? authResult.token.substring(0, 20) + '...' : null,
                sign: authResult.sign ? authResult.sign.substring(0, 20) + '...' : null,
                message: 'Autenticación exitosa'
            };
            
            console.log('✅ Autenticación exitosa');
            
        } catch (authError) {
            console.error('❌ Error autenticación:', authError.message);
            results.authentication = {
                success: false,
                error: authError.message,
                details: authError.stack
            };
            
            // Si falla la autenticación, no continuar con otros tests
            return res.json({
                success: false,
                message: 'Test AFIP completado con errores',
                environment: config.afip.environment,
                config: {
                    cuit: config.cuit,
                    ptoVenta: config.ptoVenta,
                    certificatePath: config.afip.certificatePath
                },
                results: results,
                recommendation: 'Verificar certificados y configuración antes de continuar'
            });
        }
        
        // Test 2: Status del servidor
        try {
            console.log('2️⃣ Verificando status del servidor...');
            const status = await client.getServerStatus();
            
            results.serverStatus = {
                success: true,
                ...status,
                message: 'Servidor AFIP respondiendo correctamente'
            };
            
            console.log('✅ Servidor AFIP:', status);
            
        } catch (statusError) {
            console.error('❌ Error status servidor:', statusError.message);
            results.serverStatus = {
                success: false,
                error: statusError.message
            };
        }
        
        // Test 3: Último número de comprobante
        try {
            console.log('3️⃣ Obteniendo último número...');
            const ultimoNum = await client.getLastInvoiceNumber(11, config.ptoVenta); // Tipo C
            
            results.lastInvoiceNumber = {
                success: true,
                lastNumber: ultimoNum,
                nextNumber: ultimoNum + 1,
                invoiceType: 'C (Consumidor Final)',
                pointOfSale: config.ptoVenta,
                message: 'Número obtenido correctamente'
            };
            
            console.log('✅ Último número:', ultimoNum);
            
        } catch (numberError) {
            console.error('❌ Error último número:', numberError.message);
            results.lastInvoiceNumber = {
                success: false,
                error: numberError.message
            };
        }
        
        // Test 4: Prueba de CAE (solo si todo anterior funciona)
        if (results.authentication.success && results.serverStatus.success) {
            try {
                console.log('4️⃣ Generando CAE de prueba...');
                
                const testInvoiceData = {
                    numeroFactura: `${config.ptoVenta}-${Date.now().toString().slice(-8)}`,
                    tipo: 'C',
                    codigo: 11, // Factura C
                    numeroComprobante: results.lastInvoiceNumber.success ? 
                        results.lastInvoiceNumber.nextNumber : 
                        Date.now().toString().slice(-8),
                    fechaEmision: new Date(),
                    client: {
                        name: 'Cliente de Prueba TEST AFIP',
                        cuit: '', // Sin CUIT para factura C
                        typeOfClient: 'CF'
                    },
                    items: [{
                        name: 'Producto de Prueba AFIP',
                        quantity: 1,
                        priceWithIVA: 100
                    }],
                    subtotal: 82.64, // 100 / 1.21
                    iva: 17.36, // 82.64 * 0.21
                    total: 100
                };
                
                const cae = await client.solicitarCAE(testInvoiceData);
                
                results.caeGeneration = {
                    success: true,
                    cae: cae.cae,
                    expirationDate: cae.fechaVencimientoCAE,
                    invoiceNumber: testInvoiceData.numeroComprobante,
                    result: cae.resultado,
                    observations: cae.observaciones,
                    message: 'CAE de prueba generado exitosamente'
                };
                
                console.log('✅ CAE de prueba obtenido:', cae.cae);
                
            } catch (caeError) {
                console.error('❌ Error CAE prueba:', caeError.message);
                results.caeGeneration = {
                    success: false,
                    error: caeError.message,
                    details: 'Error generando CAE de prueba'
                };
            }
        } else {
            results.caeGeneration = {
                success: false,
                error: 'No se ejecutó debido a errores previos',
                skipped: true
            };
        }
        
        // Determinar estado general
        const allTestsSuccess = Object.values(results).every(test => 
            test.skipped || test.success
        );
        
        const successCount = Object.values(results).filter(test => test.success).length;
        const totalTests = Object.keys(results).length;
        
        console.log(`\n📊 Resumen: ${successCount}/${totalTests} pruebas exitosas`);
        
        if (allTestsSuccess) {
            console.log('🎉 ¡Todas las pruebas exitosas! AFIP configurado correctamente.');
        } else {
            console.log('⚠️ Algunas pruebas fallaron. Revisar configuración.');
        }
        
        res.json({
            success: allTestsSuccess,
            message: allTestsSuccess ? 
                '¡AFIP configurado correctamente! Listo para facturación.' :
                'Configuración AFIP con problemas. Revisar errores.',
            environment: config.afip.environment,
            timestamp: new Date().toISOString(),
            config: {
                cuit: config.cuit,
                razonSocial: config.razonSocial,
                ptoVenta: config.ptoVenta,
                environment: config.afip.environment,
                certificatePath: config.afip.certificatePath
            },
            summary: {
                totalTests: totalTests,
                successfulTests: successCount,
                failedTests: totalTests - successCount,
                successRate: `${Math.round(successCount / totalTests * 100)}%`
            },
            results: results,
            recommendations: allTestsSuccess ? [
                'AFIP configurado correctamente',
                'Puedes proceder con facturación real',
                'Recuerda cambiar a ambiente production cuando esté listo'
            ] : [
                'Verificar certificados AFIP',
                'Confirmar variables de entorno',
                'Revisar conectividad con servidores AFIP',
                'Contactar soporte AFIP si los problemas persisten'
            ]
        });
        
    } catch (error) {
        console.error('❌ Error general en test AFIP:', error);
        
        res.status(500).json({
            success: false,
            message: 'Error ejecutando test AFIP',
            error: error.message,
            timestamp: new Date().toISOString(),
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            recommendations: [
                'Verificar que el servidor esté iniciado correctamente',
                'Confirmar que las dependencias estén instaladas',
                'Revisar logs del servidor para más detalles',
                'Verificar configuración de certificados AFIP'
            ]
        });
    }
};

// ✅ RUTA PARA REGENERAR CERTIFICADOS
export const regenerateCertificates = async (req, res) => {
    try {
        console.log('🔄 Iniciando regeneración de certificados...');
        
        // Importar dinámicamente el módulo de regeneración
        const { fixCertificates } = await import('../services/verifyCertificates.js');
        
        const result = await fixCertificates();
        
        if (result) {
            res.json({
                success: true,
                message: 'Certificados regenerados correctamente',
                recommendation: 'Reiniciar servidor para aplicar cambios'
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'No se pudieron regenerar los certificados',
                recommendation: 'Verificar archivo P12 y contraseña'
            });
        }
        
    } catch (error) {
        console.error('❌ Error regenerando certificados:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            recommendation: 'Verificar archivos y permisos'
        });
    }
};

// ✅ AGREGAR ESTAS RUTAS A TU ROUTER PRINCIPAL
// En tu archivo de rutas (por ejemplo, routes/arcaRoutes.js):
/*
import express from 'express';
import { testAFIPConnection, regenerateCertificates } from '../controller/afipTestController.js';

const router = express.Router();

// Rutas de prueba AFIP
router.get('/test-afip', testAFIPConnection);
router.post('/regenerate-certificates', regenerateCertificates);

export default router;
*/

// ✅ O agregar directamente a tu app principal:
/*
app.get('/api/arca/test-afip', testAFIPConnection);
app.post('/api/arca/regenerate-certificates', regenerateCertificates);
*/