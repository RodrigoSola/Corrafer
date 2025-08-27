// testAFIPEndpoints.js - Endpoints adicionales para testing AFIP
import AFIPClient from '../services/afipClient.js';

// ✅ ENDPOINT PARA PROBAR CONEXIÓN AFIP
export const testAFIPConnection = async (req, res) => {
    try {
        console.log('🧪 Testing AFIP connection...');
        
        const config = {
            cuit: process.env.COMPANY_CUIT,
            razonSocial: process.env.COMPANY_NAME,
            ptoVenta: process.env.PUNTO_VENTA,
            afip: {
                environment: process.env.AFIP_ENV || 'testing',
                certificatePath: process.env.AFIP_CERT_PATH,
                privateKeyPath: process.env.AFIP_KEY_PATH
            }
        };

        const client = new AFIPClient(config);
        const testResults = {};
        
        // Test 1: Validar certificados
        console.log('1️⃣ Validando certificados...');
        try {
            const fs = await import('fs');
            
            if (!fs.existsSync(config.afip.certificatePath)) {
                throw new Error('Certificado no encontrado: ' + config.afip.certificatePath);
            }
            if (!fs.existsSync(config.afip.privateKeyPath)) {
                throw new Error('Clave privada no encontrada: ' + config.afip.privateKeyPath);
            }
            
            testResults.certificates = {
                status: 'OK',
                certPath: config.afip.certificatePath,
                keyPath: config.afip.privateKeyPath
            };
            
        } catch (certError) {
            testResults.certificates = {
                status: 'ERROR',
                error: certError.message
            };
            
            return res.json({
                success: false,
                error: 'Error en certificados',
                results: testResults
            });
        }
        
        // Test 2: Autenticación
        console.log('2️⃣ Probando autenticación...');
        try {
            await client.authenticate();
            testResults.authentication = {
                status: 'OK',
                token: client.token ? 'Obtenido' : 'No disponible',
                tokenExpiration: client.tokenExpiration?.toISOString()
            };
        } catch (authError) {
            testResults.authentication = {
                status: 'ERROR',
                error: authError.message
            };
        }
        
        // Test 3: Status del servidor
        console.log('3️⃣ Verificando status del servidor...');
        try {
            const status = await client.getServerStatus();
            testResults.serverStatus = {
                status: 'OK',
                ...status
            };
        } catch (statusError) {
            testResults.serverStatus = {
                status: 'ERROR',
                error: statusError.message
            };
        }
        
        // Test 4: Último número de comprobante
        console.log('4️⃣ Obteniendo último número...');
        try {
            const ultimoNumC = await client.getLastInvoiceNumber('C', config.ptoVenta);
            const ultimoNumA = await client.getLastInvoiceNumber('A', config.ptoVenta);
            const ultimoNumB = await client.getLastInvoiceNumber('B', config.ptoVenta);
            
            testResults.lastNumbers = {
                status: 'OK',
                facturaC: ultimoNumC,
                facturaA: ultimoNumA,
                facturaB: ultimoNumB
            };
        } catch (numError) {
            testResults.lastNumbers = {
                status: 'ERROR',
                error: numError.message
            };
        }
        
        // Test 5: CAE de prueba (solo si todo anterior funciona)
        if (testResults.authentication.status === 'OK' && 
            testResults.serverStatus.status === 'OK') {
            
            console.log('5️⃣ Generando CAE de prueba...');
            try {
                const facturaTest = {
                    tipo: 'C',
                    fechaEmision: new Date(),
                    client: {
                        name: 'Cliente de Prueba AFIP',
                        typeOfClient: 'CF',
                        cuit: '0'
                    },
                    subtotal: 100,
                    iva: 0,
                    total: 100
                };
                
                const cae = await client.solicitarCAE(facturaTest);
                testResults.testCAE = {
                    status: 'OK',
                    cae: cae.cae,
                    fechaVencimiento: cae.fechaVencimientoCAE,
                    numeroComprobante: cae.numeroComprobante
                };
                
            } catch (caeError) {
                testResults.testCAE = {
                    status: 'ERROR',
                    error: caeError.message
                };
            }
        }
        
        // Resumen final
        const allTestsPassed = Object.values(testResults).every(test => test.status === 'OK');
        
        console.log(allTestsPassed ? '✅ Todos los tests exitosos' : '❌ Algunos tests fallaron');
        
        res.json({
            success: allTestsPassed,
            message: allTestsPassed 
                ? 'AFIP configurado correctamente - Listo para facturación' 
                : 'Hay problemas en la configuración AFIP',
            environment: config.afip.environment,
            cuit: config.cuit,
            puntoVenta: config.ptoVenta,
            timestamp: new Date().toISOString(),
            results: testResults
        });
        
    } catch (error) {
        console.error('❌ Error en test AFIP:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// ✅ ENDPOINT PARA OBTENER INFO DEL CONTRIBUYENTE
export const getContribuyenteInfo = async (req, res) => {
    try {
        const { cuit } = req.params;
        
        if (!cuit || cuit.length !== 11) {
            return res.status(400).json({
                success: false,
                error: 'CUIT debe tener 11 dígitos'
            });
        }
        
        const config = {
            cuit: process.env.COMPANY_CUIT,
            afip: {
                environment: process.env.AFIP_ENV || 'testing',
                certificatePath: process.env.AFIP_CERT_PATH,
                privateKeyPath: process.env.AFIP_KEY_PATH
            }
        };
        
        const client = new AFIPClient(config);
        await client.authenticate();
        
        const contribuyente = await client.getContribuyenteData(cuit);
        
        res.json({
            success: true,
            cuit: cuit,
            contribuyente: contribuyente
        });
        
    } catch (error) {
        console.error('❌ Error obteniendo contribuyente:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ✅ ENDPOINT PARA VALIDAR CONFIGURACIÓN
export const validateAFIPConfig = async (req, res) => {
    try {
        const config = {
            cuit: process.env.COMPANY_CUIT,
            razonSocial: process.env.COMPANY_NAME,
            ptoVenta: process.env.PUNTO_VENTA,
            environment: process.env.AFIP_ENV,
            certPath: process.env.AFIP_CERT_PATH,
            keyPath: process.env.AFIP_KEY_PATH
        };
        
        const validation = {
            configComplete: true,
            errors: [],
            warnings: []
        };
        
        // Validar variables obligatorias
        if (!config.cuit) {
            validation.errors.push('COMPANY_CUIT no configurado');
        } else if (!/^\d{11}$/.test(config.cuit)) {
            validation.errors.push('COMPANY_CUIT debe tener 11 dígitos');
        }
        
        if (!config.razonSocial) {
            validation.errors.push('COMPANY_NAME no configurado');
        }
        
        if (!config.ptoVenta) {
            validation.errors.push('PUNTO_VENTA no configurado');
        } else if (!/^\d{4}$/.test(config.ptoVenta)) {
            validation.errors.push('PUNTO_VENTA debe tener 4 dígitos (ej: 0001)');
        }
        
        if (!config.environment) {
            validation.warnings.push('AFIP_ENV no configurado, usando "testing" por defecto');
            config.environment = 'testing';
        } else if (!['testing', 'production'].includes(config.environment)) {
            validation.errors.push('AFIP_ENV debe ser "testing" o "production"');
        }
        
        if (!config.certPath) {
            validation.errors.push('AFIP_CERT_PATH no configurado');
        }
        
        if (!config.keyPath) {
            validation.errors.push('AFIP_KEY_PATH no configurado');
        }
        
        // Validar archivos de certificados
        const fs = await import('fs');
        
        if (config.certPath && !fs.existsSync(config.certPath)) {
            validation.errors.push(`Certificado no encontrado: ${config.certPath}`);
        }
        
        if (config.keyPath && !fs.existsSync(config.keyPath)) {
            validation.errors.push(`Clave privada no encontrada: ${config.keyPath}`);
        }
        
        // Validar ambiente vs certificados
        if (config.environment === 'production') {
            validation.warnings.push('⚠️ Ambiente PRODUCCIÓN - Verificar que los certificados sean de producción');
        }
        
        validation.configComplete = validation.errors.length === 0;
        
        res.json({
            success: validation.configComplete,
            message: validation.configComplete 
                ? 'Configuración AFIP válida' 
                : 'Hay errores en la configuración',
            config: {
                cuit: config.cuit,
                razonSocial: config.razonSocial,
                ptoVenta: config.ptoVenta,
                environment: config.environment,
                certPath: config.certPath,
                keyPath: config.keyPath
            },
            validation: validation
        });
        
    } catch (error) {
        console.error('❌ Error validando configuración:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ✅ ENDPOINT PARA GENERAR CERTIFICADOS CSR
export const generateCSR = async (req, res) => {
    try {
        const { razonSocial, cuit } = req.body;
        
        if (!razonSocial || !cuit) {
            return res.status(400).json({
                success: false,
                error: 'razonSocial y cuit son obligatorios'
            });
        }
        
        const { execSync } = await import('child_process');
        const fs = await import('fs');
        const path = await import('path');
        
        // Crear directorio de certificados si no existe
        const certDir = './certificates';
        if (!fs.existsSync(certDir)) {
            fs.mkdirSync(certDir, { recursive: true });
        }
        
        const keyPath = path.join(certDir, 'private.key');
        const csrPath = path.join(certDir, 'certificado.csr');
        
        // Generar clave privada
        console.log('🔐 Generando clave privada...');
        execSync(`openssl genrsa -out "${keyPath}" 2048`);
        
        // Generar CSR
        console.log('📋 Generando CSR...');
        const subject = `/C=AR/O=${razonSocial}/CN=${razonSocial}/serialNumber=CUIT ${cuit}`;
        execSync(`openssl req -new -key "${keyPath}" -subj "${subject}" -out "${csrPath}"`);
        
        // Leer CSR generado
        const csrContent = fs.readFileSync(csrPath, 'utf8');
        
        res.json({
            success: true,
            message: 'CSR generado exitosamente',
            files: {
                privateKey: keyPath,
                csr: csrPath
            },
            csrContent: csrContent,
            instructions: [
                '1. Guardar el archivo private.key en lugar seguro',
                '2. Subir el contenido del CSR a AFIP (Administrador de Relaciones)',
                '3. Descargar el certificado .crt cuando esté listo',
                '4. Configurar AFIP_CERT_PATH y AFIP_KEY_PATH en .env'
            ]
        });
        
    } catch (error) {
        console.error('❌ Error generando CSR:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            note: 'Verificar que OpenSSL esté instalado en el sistema'
        });
    }
};

// ✅ ENDPOINT PARA ESTADÍSTICAS AFIP
export const getAFIPStats = async (req, res) => {
    try {
        // Importar modelo de Invoice
        const Invoice = (await import('../models/invoiceModel.js')).default;
        
        const stats = await Invoice.aggregate([
            {
                $group: {
                    _id: null,
                    totalFacturas: { $sum: 1 },
                    facturasReales: { 
                        $sum: { 
                            $cond: [{ $eq: ['$testing', false] }, 1, 0] 
                        } 
                    },
                    facturasPrueba: { 
                        $sum: { 
                            $cond: [{ $eq: ['$testing', true] }, 1, 0] 
                        } 
                    },
                    montoTotal: { $sum: '$total' },
                    montoReal: {
                        $sum: {
                            $cond: [
                                { $eq: ['$testing', false] },
                                '$total',
                                0
                            ]
                        }
                    },
                    facturasCompletadas: {
                        $sum: {
                            $cond: [
                                { $eq: ['$status', 'completed'] },
                                1,
                                0
                            ]
                        }
                    },
                    facturasConCAE: {
                        $sum: {
                            $cond: [
                                { $and: [{ $ne: ['$cae', null] }, { $ne: ['$testing', true] }] },
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ]);
        
        // Estadísticas por tipo de factura
        const tiposStats = await Invoice.aggregate([
            { $match: { testing: false } },
            {
                $group: {
                    _id: '$tipo',
                    cantidad: { $sum: 1 },
                    montoTotal: { $sum: '$total' }
                }
            },
            { $sort: { _id: 1 } }
        ]);
        
        // Últimas facturas reales
        const ultimasFacturas = await Invoice.find({ testing: false })
            .sort({ createdAt: -1 })
            .limit(10)
            .select('numeroFactura tipo cliente total cae createdAt')
            .lean();
        
        res.json({
            success: true,
            environment: process.env.AFIP_ENV || 'testing',
            cuit: process.env.COMPANY_CUIT,
            puntoVenta: process.env.PUNTO_VENTA,
            estadisticas: stats[0] || {
                totalFacturas: 0,
                facturasReales: 0,
                facturasPrueba: 0,
                montoTotal: 0,
                montoReal: 0,
                facturasCompletadas: 0,
                facturasConCAE: 0
            },
            tiposFactura: tiposStats,
            ultimasFacturas: ultimasFacturas,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error obteniendo estadísticas AFIP:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ✅ ENDPOINT PARA LIMPIAR FACTURAS DE PRUEBA
export const cleanTestInvoices = async (req, res) => {
    try {
        const Invoice = (await import('../models/invoiceModel.js')).default;
        const fs = await import('fs');
        const path = await import('path');
        
        // Obtener facturas de prueba
        const testInvoices = await Invoice.find({ testing: true });
        
        let deletedFiles = 0;
        let deletedRecords = 0;
        
        // Eliminar PDFs de facturas de prueba
        const invoicesDir = path.resolve(process.cwd(), 'invoices');
        
        for (const invoice of testInvoices) {
            if (invoice.pdfFileName) {
                const pdfPath = path.join(invoicesDir, invoice.pdfFileName);
                
                try {
                    if (fs.existsSync(pdfPath)) {
                        fs.unlinkSync(pdfPath);
                        deletedFiles++;
                        console.log('🗑️ PDF eliminado:', invoice.pdfFileName);
                    }
                } catch (fileError) {
                    console.warn('⚠️ Error eliminando PDF:', fileError.message);
                }
            }
        }
        
        // Eliminar registros de BD
        const deleteResult = await Invoice.deleteMany({ testing: true });
        deletedRecords = deleteResult.deletedCount;
        
        console.log(`✅ Limpieza completada: ${deletedRecords} registros, ${deletedFiles} archivos`);
        
        res.json({
            success: true,
            message: 'Facturas de prueba eliminadas',
            deletedRecords: deletedRecords,
            deletedFiles: deletedFiles,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error limpiando facturas de prueba:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ✅ ENDPOINT PARA REGENERAR PDF DE FACTURA
export const regenerateInvoicePDF = async (req, res) => {
    try {
        const { id } = req.params;
        const Invoice = (await import('../models/invoiceModel.js')).default;
        const { generateInvoicePDF } = await import('../controller/generateInvoicePDF.js');
        
        const invoice = await Invoice.findById(id);
        if (!invoice) {
            return res.status(404).json({
                success: false,
                error: 'Factura no encontrada'
            });
        }
        
        // Configuración de empresa
        const companyConfig = {
            cuit: process.env.COMPANY_CUIT,
            razonSocial: process.env.COMPANY_NAME,
            ptoVenta: process.env.PUNTO_VENTA,
            domicilio: process.env.COMPANY_ADDRESS,
            condicionIVA: "Responsable Inscripto",
            fechaInicioActividades: "01/01/2020"
        };
        
        // Preparar datos para PDF
        const invoiceDataForPDF = {
            numeroFactura: invoice.numeroFactura,
            tipo: invoice.tipo,
            cae: invoice.cae,
            fechaVencimientoCAE: invoice.fechaVencimientoCAE ? 
                new Date(invoice.fechaVencimientoCAE).toLocaleDateString('es-AR') : null,
            fechaEmision: new Date(invoice.fechaEmision).toLocaleDateString('es-AR'),
            cliente: invoice.cliente,
            clientData: invoice.clientData || invoice.client,
            client: invoice.clientData || invoice.client,
            items: invoice.items,
            subtotal: invoice.subtotal,
            iva: invoice.iva,
            total: invoice.total,
            metodoPago: invoice.metodoPago,
            testing: invoice.testing
        };
        
        // Regenerar PDF
        const pdfResult = await generateInvoicePDF(invoiceDataForPDF, companyConfig);
        
        // Actualizar BD
        invoice.pdfFileName = pdfResult.fileName;
        invoice.pdfPath = pdfResult.filePath;
        invoice.status = 'completed';
        invoice.updatedAt = new Date();
        
        await invoice.save();
        
        res.json({
            success: true,
            message: 'PDF regenerado exitosamente',
            invoice: {
                id: invoice._id,
                numeroFactura: invoice.numeroFactura,
                pdfFileName: pdfResult.fileName,
                viewUrl: `/api/arca/invoices/${invoice._id}/pdf`,
                downloadUrl: `/api/arca/invoices/${invoice._id}/download`
            }
        });
        
    } catch (error) {
        console.error('❌ Error regenerando PDF:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ✅ MIDDLEWARE DE VALIDACIÓN AFIP
export const validateAFIPEnvironment = (req, res, next) => {
    const environment = process.env.AFIP_ENV;
    const isProduction = environment === 'production';
    const { testing = false } = req.body;
    
    // Si estamos en producción y se solicita testing, advertir
    if (isProduction && testing) {
        console.warn('⚠️ Factura de prueba solicitada en ambiente de producción');
    }
    
    // Si estamos en testing y se solicita factura real, advertir
    if (!isProduction && !testing) {
        console.warn('⚠️ Factura real solicitada en ambiente de testing');
        
        // Opcional: forzar testing en ambiente de homologación
        // req.body.testing = true;
    }
    
    // Agregar info del ambiente al request
    req.afipEnvironment = {
        environment: environment || 'testing',
        isProduction: isProduction,
        requestedTesting: testing
    };
    
    next();
};

// ✅ MIDDLEWARE DE LOGGING AFIP
export const logAFIPTransaction = (req, res, next) => {
    // Solo para endpoints de facturación
    if (!req.path.includes('/generate-invoice')) {
        return next();
    }
    
    const originalSend = res.send;
    
    res.send = function(data) {
        const responseData = typeof data === 'string' ? JSON.parse(data) : data;
        
        // Log transacciones importantes
        const logData = {
            timestamp: new Date().toISOString(),
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            environment: process.env.AFIP_ENV,
            endpoint: req.path,
            method: req.method,
            testing: req.body?.testing || false,
            clientName: req.body?.client?.name,
            total: req.body?.cartItems?.reduce((sum, item) => 
                sum + (item.priceWithIVA * item.quantity), 0
            ),
            success: responseData?.success,
            numeroFactura: responseData?.numeroFactura,
            cae: responseData?.cae
        };
        
        // Log diferenciado según tipo
        if (!req.body?.testing && responseData?.success) {
            console.log('🏛️ FACTURA REAL AFIP GENERADA:', JSON.stringify(logData, null, 2));
        } else if (req.body?.testing && responseData?.success) {
            console.log('🧪 Factura de prueba generada:', logData);
        } else if (!responseData?.success) {
            console.error('❌ Error en facturación:', logData);
        }
        
        originalSend.call(this, data);
    };
    
    next();
};

// ✅ FUNCIÓN PARA BACKUP AUTOMÁTICO
export const backupAFIPData = async () => {
    try {
        const fs = await import('fs');
        const path = await import('path');
        const Invoice = (await import('../models/invoiceModel.js')).default;
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = `./backups/afip_${timestamp}`;
        
        // Crear directorio de backup
        if (!fs.existsSync('./backups')) {
            fs.mkdirSync('./backups', { recursive: true });
        }
        fs.mkdirSync(backupDir, { recursive: true });
        
        // Backup certificados
        if (process.env.AFIP_CERT_PATH && fs.existsSync(process.env.AFIP_CERT_PATH)) {
            fs.copyFileSync(
                process.env.AFIP_CERT_PATH, 
                path.join(backupDir, 'certificado.crt')
            );
        }
        
        if (process.env.AFIP_KEY_PATH && fs.existsSync(process.env.AFIP_KEY_PATH)) {
            fs.copyFileSync(
                process.env.AFIP_KEY_PATH, 
                path.join(backupDir, 'private.key')
            );
        }
        
        // Backup facturas reales (solo datos, no PDFs)
        const facturasReales = await Invoice.find({ 
            testing: false,
            cae: { $exists: true }
        }).lean();
        
        fs.writeFileSync(
            path.join(backupDir, 'facturas_reales.json'),
            JSON.stringify(facturasReales, null, 2)
        );
        
        // Backup configuración
        const config = {
            cuit: process.env.COMPANY_CUIT,
            razonSocial: process.env.COMPANY_NAME,
            puntoVenta: process.env.PUNTO_VENTA,
            environment: process.env.AFIP_ENV,
            backupDate: new Date().toISOString()
        };
        
        fs.writeFileSync(
            path.join(backupDir, 'config.json'),
            JSON.stringify(config, null, 2)
        );
        
        console.log('💾 Backup AFIP completado en:', backupDir);
        
        return {
            success: true,
            backupDir: backupDir,
            files: {
                certificados: fs.existsSync(path.join(backupDir, 'certificado.crt')),
                clavePrivada: fs.existsSync(path.join(backupDir, 'private.key')),
                facturasReales: facturasReales.length,
                configuracion: true
            }
        };
        
    } catch (error) {
        console.error('❌ Error en backup AFIP:', error);
        throw new Error(`Error en backup: ${error.message}`);
    }
};

// ✅ ENDPOINT PARA EJECUTAR BACKUP MANUAL
export const executeBackup = async (req, res) => {
    try {
        const result = await backupAFIPData();
        
        res.json({
            success: true,
            message: 'Backup ejecutado exitosamente',
            ...result,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error ejecutando backup:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};