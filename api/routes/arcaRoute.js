// arcaRoute.js - RUTAS CORREGIDAS CON ENDPOINTS FALTANTES
import express from 'express';
import { 
    generateARCAInvoice, 
    getCompanyConfig, 
    updateCompanyConfig,
    getInvoiceById,
    deleteInvoice,
    getInvoices,
    getInvoicePDF
} from '../controller/arcaController.js';

// ✅ NUEVOS IMPORTS AFIP
import {
    testAFIPConnection,
    getContribuyenteInfo,
    validateAFIPConfig,
    generateCSR,
    getAFIPStats,
    cleanTestInvoices,
    regenerateInvoicePDF,
    validateAFIPEnvironment,
    logAFIPTransaction,
    executeBackup
} from '../services/testAFIPEndpoints.js';

const ARCARouter = express.Router();

// ✅ Middleware global para rutas ARCA con logging mejorado
ARCARouter.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`🏛️ [${timestamp}] ARCA Route: ${req.method} ${req.path}`);
    if (req.method === 'POST') {
        console.log('📦 Request Body Keys:', Object.keys(req.body || {}));
        console.log('📊 CartItems length:', req.body?.cartItems?.length || 0);
    }
    next();
});

// ✅ RUTAS DE TESTING Y VALIDACIÓN AFIP
ARCARouter.get('/afip/test-connection', testAFIPConnection);
ARCARouter.get('/afip/validate-config', validateAFIPConfig);
ARCARouter.get('/afip/stats', getAFIPStats);
ARCARouter.get('/afip/contribuyente/:cuit', getContribuyenteInfo);
ARCARouter.post('/afip/generate-csr', generateCSR);
ARCARouter.post('/afip/backup', executeBackup);
ARCARouter.delete('/afip/clean-test-invoices', cleanTestInvoices);


const validateProductionMode = (req, res, next) => {
  const isProduction = process.env.AFIP_ENV === 'production';
  
  if (isProduction) {
    console.log('🏛️ PRODUCCIÓN: Validando facturas reales');
    
    // Verificar certificados
    if (!process.env.COMPANY_CUIT || !process.env.AFIP_CERT_PATH) {
      return res.status(500).json({
        success: false,
        error: 'Configuración AFIP incompleta para producción',
        missing: {
          cuit: !process.env.COMPANY_CUIT,
          certificate: !process.env.AFIP_CERT_PATH
        }
      });
    }
    
    // Log crítico para auditoría
    console.log(`🏛️ FACTURA REAL - CUIT: ${process.env.COMPANY_CUIT} - Timestamp: ${new Date().toISOString()}`);
  }
  
  next();
};
// ✅ RUTAS PRINCIPALES DE FACTURAS
ARCARouter.post('/invoices', 
     validateProductionMode, 
  async (req, res) => {
    const isProduction = process.env.AFIP_ENV === 'production';
    
    if (isProduction) {
      // Forzar modo real en producción
      req.body.testing = false;
      console.log('🏛️ FORZANDO FACTURA REAL - Ambiente de producción');
    }
    
    return await generateARCAInvoice(req, res);
  }
);
// Endpoint específico para factura simple (el que está faltando)
ARCARouter.post('/generate-simple-invoice', 
    validateAFIPEnvironment,
    logAFIPTransaction,
    async (req, res) => {
        try {
            console.log('📄 Generando factura simple...');
            console.log('📦 Datos recibidos:', {
                cartItemsLength: req.body?.cartItems?.length,
                paymentMethod: req.body?.paymentMethod,
                simple: req.body?.simple,
                metadata: req.body?.metadata
            });

            // Llamar al controlador principal pero marcando como simple
            req.body.simple = true;
            req.body.testing = true; // Las facturas simples son de prueba
            
            return await generateARCAInvoice(req, res);
            
        } catch (error) {
            console.error('❌ Error en generate-simple-invoice:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                details: 'Error en endpoint generate-simple-invoice'
            });
        }
    }
);

// ✅ RUTAS DE GESTIÓN DE FACTURAS
ARCARouter.get('/invoices', getInvoices);
ARCARouter.get('/invoices/:id', getInvoiceById);
ARCARouter.get('/invoices/:id/pdf', getInvoicePDF);
ARCARouter.post('/invoices/:id/regenerate-pdf', regenerateInvoicePDF);
ARCARouter.delete('/invoices/:id', deleteInvoice);

// ✅ CONFIGURACIÓN DE EMPRESA
ARCARouter.get('/company-config', getCompanyConfig);
ARCARouter.put('/company-config', updateCompanyConfig);

// ✅ ENDPOINT DE DEBUG PARA VERIFICAR MONGODB
ARCARouter.get('/debug/mongodb', async (req, res) => {
    try {
        const Invoice = (await import('../models/invoiceModel.js')).default;
        
        // Contar documentos
        const totalInvoices = await Invoice.countDocuments();
        const testingInvoices = await Invoice.countDocuments({ testing: true });
        const officialInvoices = await Invoice.countDocuments({ testing: false });
        
        // Últimas facturas
        const recentInvoices = await Invoice.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select('numeroFactura cliente total testing createdAt')
            .lean();

        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            database: {
                connected: true,
                collectionExists: true
            },
            stats: {
                total: totalInvoices,
                testing: testingInvoices,
                official: officialInvoices
            },
            recentInvoices: recentInvoices,
            mongodb: {
                uri: process.env.MONGODB_URI ? 'Configurado' : 'No configurado',
                database: process.env.DB_NAME || 'No especificado'
            }
        });
        
    } catch (error) {
        console.error('❌ Error verificando MongoDB:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            database: {
                connected: false,
                error: 'Error conectando a MongoDB'
            }
        });
    }
});

// ✅ RUTAS DE INFORMACIÓN Y DEBUG
ARCARouter.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'ARCA API con AFIP funcionando correctamente',
        version: '4.1-FIXED',
        timestamp: new Date().toISOString(),
        afip: {
            environment: process.env.AFIP_ENV || 'testing',
            configured: !!(process.env.COMPANY_CUIT && process.env.AFIP_CERT_PATH),
            cuit: process.env.COMPANY_CUIT,
            puntoVenta: process.env.PUNTO_VENTA
        },
        endpoints: {
            // Facturas CORREGIDO
            'POST /generate-simple-invoice': '📄 Generar factura simple (NUEVO)',
            'POST /invoices': '🏛️ Generar factura ARCA/AFIP oficial',
            'GET /invoices': '📋 Listar facturas con paginación',
            'GET /invoices/:id': '👁️ Obtener factura específica',
            'GET /invoices/:id/pdf': '📑 Ver PDF de factura',
            'POST /invoices/:id/regenerate-pdf': '🔄 Regenerar PDF',
            'DELETE /invoices/:id': '🗑️ Eliminar factura',
            
            // Debug NUEVO
            'GET /debug/mongodb': '🔍 Verificar estado MongoDB',
            'GET /debug/afip-status': '🏛️ Estado configuración AFIP',
            
            // AFIP Testing
            'GET /afip/test-connection': '🔌 Probar conexión completa a AFIP',
            'GET /afip/validate-config': '✅ Validar configuración AFIP',
            'GET /afip/stats': '📊 Estadísticas de facturas AFIP',
            'GET /afip/contribuyente/:cuit': 'ℹ️ Info de contribuyente',
            'POST /afip/generate-csr': '🔐 Generar CSR para certificado',
            'POST /afip/backup': '💾 Backup de datos AFIP',
            'DELETE /afip/clean-test-invoices': '🧹 Limpiar facturas de prueba',
            
            // Configuración
            'GET /company-config': '🏢 Obtener configuración empresa',
            'PUT /company-config': '✏️ Actualizar configuración'
        }
    });
});

// ✅ ENDPOINT MEJORADO PARA VERIFICAR ESTADO COMPLETO
ARCARouter.get('/debug/full-status', async (req, res) => {
    try {
        const Invoice = (await import('../models/invoiceModel.js')).default;
        
        // MongoDB Status
        let mongoStatus = { connected: false, stats: null };
        try {
            const totalInvoices = await Invoice.countDocuments();
            mongoStatus = {
                connected: true,
                stats: {
                    total: totalInvoices,
                    testing: await Invoice.countDocuments({ testing: true }),
                    official: await Invoice.countDocuments({ testing: false }),
                    completed: await Invoice.countDocuments({ status: 'completed' }),
                    withPDF: await Invoice.countDocuments({ pdfFileName: { $exists: true, $ne: null } })
                }
            };
        } catch (e) {
            mongoStatus.error = e.message;
        }

        // File System Status
        const fs = await import('fs');
        const path = await import('path');
        const INVOICES_DIR = path.resolve(process.cwd(), 'invoices');
        
        let fileSystemStatus = {
            invoicesDir: {
                exists: fs.existsSync(INVOICES_DIR),
                path: INVOICES_DIR,
                files: 0
            }
        };

        if (fileSystemStatus.invoicesDir.exists) {
            try {
                const files = fs.readdirSync(INVOICES_DIR);
                fileSystemStatus.invoicesDir.files = files.filter(f => f.endsWith('.pdf')).length;
            } catch (e) {
                fileSystemStatus.invoicesDir.error = e.message;
            }
        }

        // AFIP Status
        let afipStatus = {
            configured: false,
            environment: process.env.AFIP_ENV || 'testing',
            certificates: {
                cert: process.env.AFIP_CERT_PATH ? fs.existsSync(process.env.AFIP_CERT_PATH) : false,
                key: process.env.AFIP_KEY_PATH ? fs.existsSync(process.env.AFIP_KEY_PATH) : false
            }
        };
        
        afipStatus.configured = afipStatus.certificates.cert && afipStatus.certificates.key && process.env.COMPANY_CUIT;

        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            version: '4.1-FIXED',
            mongodb: mongoStatus,
            filesystem: fileSystemStatus,
            afip: afipStatus,
            environment: {
                nodeEnv: process.env.NODE_ENV,
                port: process.env.PORT,
                mongodbUri: process.env.MONGODB_URI ? 'Configurado' : 'No configurado',
                companyCuit: process.env.COMPANY_CUIT || 'No configurado'
            },
            recommendations: [
                ...(mongoStatus.connected ? [] : ['❌ Verificar conexión MongoDB']),
                ...(fileSystemStatus.invoicesDir.exists ? [] : ['❌ Crear directorio /invoices']),
                ...(afipStatus.configured ? ['✅ AFIP configurado correctamente'] : ['❌ Completar configuración AFIP']),
                mongoStatus.stats?.total === 0 ? '⚠️ No hay facturas en la base de datos' : `✅ ${mongoStatus.stats?.total} facturas en DB`
            ]
        });

    } catch (error) {
        console.error('❌ Error en full-status:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

ARCARouter.get('/debug/afip-status', (req, res) => {
     const isProduction = process.env.AFIP_ENV === 'production';
    const fs = require('fs');
    
    const status = {
        success: true,
        timestamp: new Date().toISOString(),
        environment: process.env.AFIP_ENV || 'testing',
        configuration: {
            cuit: process.env.COMPANY_CUIT || '20292615834',
            companyName: process.env.COMPANY_NAME || 'CORRAFER',
            puntoVenta: process.env.PUNTO_VENTA || '0001',
            certPath: process.env.AFIP_CERT_PATH || 'certificates/certificado.crt',
            keyPath: process.env.AFIP_KEY_PATH || 'certificates/private.key'
        },
        certificates: {
            certExists: process.env.AFIP_CERT_PATH ? fs.existsSync(process.env.AFIP_CERT_PATH) : false,
            keyExists: process.env.AFIP_KEY_PATH ? fs.existsSync(process.env.AFIP_KEY_PATH) : false
        },
        urls: {
            wsaa: process.env.AFIP_ENV === 'production' 
                ? 'https://wsaa.afip.gov.ar/ws/services/LoginCms'
                : 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
            wsfe: process.env.AFIP_ENV === 'production'
                ? 'https://servicios1.afip.gov.ar/wsfev1/service.asmx'
                : 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx'
        },
        recommendations: []
    };
    
    // Generar recomendaciones
    if (!process.env.COMPANY_CUIT) {
        status.recommendations.push('Configurar COMPANY_CUIT en .env');
    }
    
    if (!process.env.AFIP_CERT_PATH || !status.certificates.certExists) {
        status.recommendations.push('Configurar y verificar AFIP_CERT_PATH');
    }
    
    if (!process.env.AFIP_KEY_PATH || !status.certificates.keyExists) {
        status.recommendations.push('Configurar y verificar AFIP_KEY_PATH');
    }
    
    if (process.env.AFIP_ENV === 'production') {
        status.recommendations.push('⚠️ AMBIENTE DE PRODUCCIÓN - Verificar certificados');
    } else {
        status.recommendations.push('Ambiente de testing - Usar /afip/test-connection para probar');
    }
    
    status.ready = status.certificates.certExists && 
                   status.certificates.keyExists && 
                   process.env.COMPANY_CUIT;
    
    res.json(status);
});

// ✅ ENDPOINT AVANZADO DE ESTADÍSTICAS
ARCARouter.get('/stats/advanced', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const Invoice = (await import('../models/invoiceModel.js')).default;
        
        // Filtro de fechas
        let dateFilter = {};
        if (startDate || endDate) {
            dateFilter.createdAt = {};
            if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
            if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
        }
        
        // Estadísticas generales
        const generalStats = await Invoice.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    reales: { $sum: { $cond: [{ $eq: ['$testing', false] }, 1, 0] } },
                    prueba: { $sum: { $cond: [{ $eq: ['$testing', true] }, 1, 0] } },
                    montoTotal: { $sum: '$total' },
                    montoReales: {
                        $sum: { $cond: [{ $eq: ['$testing', false] }, '$total', 0] }
                    },
                    promedioMonto: { $avg: '$total' },
                    completadas: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                    conError: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } }
                }
            }
        ]);
        
        // Por tipo de factura
        const tipoStats = await Invoice.aggregate([
            { $match: { ...dateFilter, testing: false } },
            {
                $group: {
                    _id: '$tipo',
                    cantidad: { $sum: 1 },
                    monto: { $sum: '$total' },
                    promedio: { $avg: '$total' }
                }
            },
            { $sort: { _id: 1 } }
        ]);
        
        // Por mes (últimos 6 meses)
        const monthlyStats = await Invoice.aggregate([
            {
                $match: {
                    createdAt: { $gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000) },
                    testing: false
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    cantidad: { $sum: 1 },
                    monto: { $sum: '$total' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);
        
        // Top clientes
        const topClientes = await Invoice.aggregate([
            { $match: { ...dateFilter, testing: false } },
            {
                $group: {
                    _id: '$cliente',
                    cantidad: { $sum: 1 },
                    montoTotal: { $sum: '$total' }
                }
            },
            { $sort: { montoTotal: -1 } },
            { $limit: 10 }
        ]);
        
        res.json({
            success: true,
            period: {
                startDate: startDate || 'desde el inicio',
                endDate: endDate || 'hasta ahora'
            },
            general: generalStats[0] || {
                total: 0, reales: 0, prueba: 0, 
                montoTotal: 0, montoReales: 0, 
                promedioMonto: 0, completadas: 0, conError: 0
            },
            porTipo: tipoStats,
            porMes: monthlyStats,
            topClientes: topClientes,
            environment: process.env.AFIP_ENV,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error en estadísticas avanzadas:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ✅ ENDPOINT PARA MONITOREO DE SALUD AFIP
ARCARouter.get('/health/afip', async (req, res) => {
    try {
        const config = {
            cuit: process.env.COMPANY_CUIT,
            afip: {
                environment: process.env.AFIP_ENV || 'testing',
                certificatePath: process.env.AFIP_CERT_PATH,
                privateKeyPath: process.env.AFIP_KEY_PATH
            }
        };
        
        const health = {
            timestamp: new Date().toISOString(),
            environment: config.afip.environment,
            status: 'unknown',
            checks: {}
        };
        
        // Check 1: Configuración
        try {
            health.checks.configuration = {
                status: 'ok',
                cuit: !!config.cuit,
                certificates: !!(config.afip.certificatePath && config.afip.privateKeyPath)
            };
        } catch (e) {
            health.checks.configuration = { status: 'error', error: e.message };
        }
        
        // Check 2: Certificados
        try {
            const fs = await import('fs');
            health.checks.certificates = {
                status: 'ok',
                certExists: fs.existsSync(config.afip.certificatePath),
                keyExists: fs.existsSync(config.afip.privateKeyPath)
            };
        } catch (e) {
            health.checks.certificates = { status: 'error', error: e.message };
        }
        
        // Check 3: Conectividad AFIP (solo si configuración OK)
        if (health.checks.configuration.status === 'ok' && 
            health.checks.certificates.status === 'ok') {
            
            try {
                const AFIPClient = (await import('../services/afipClient.js')).default;
                const client = new AFIPClient(config);
                
                // Test rápido de autenticación
                await client.authenticate();
                health.checks.afipConnection = {
                    status: 'ok',
                    authenticated: true,
                    tokenExpires: client.tokenExpiration?.toISOString()
                };
                
            } catch (e) {
                health.checks.afipConnection = {
                    status: 'error',
                    authenticated: false,
                    error: e.message
                };
            }
        }
        
        // Status general
        const allChecksOk = Object.values(health.checks).every(check => check.status === 'ok');
        health.status = allChecksOk ? 'healthy' : 'unhealthy';
        
        res.status(allChecksOk ? 200 : 503).json(health);
        
    } catch (error) {
        console.error('❌ Error en health check:', error);
        res.status(500).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

ARCARouter.post('/test-quick-invoice', async (req, res) => {
    try {
        const Invoice = (await import('../models/invoiceModel.js')).default;
        
        const testInvoice = new Invoice({
            numeroFactura: `QUICK-${Date.now()}`,
            tipo: 'C',
            cliente: 'Test Cliente',
            total: 100,
            testing: true,
            status: 'completed',
            fechaEmision: new Date()
        });
        
        const saved = await testInvoice.save();
        console.log('✅ Quick test saved:', saved._id);
        
        res.json({ success: true, id: saved._id });
    } catch (error) {
        console.error('❌ Quick test failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ✅ Middleware de manejo de errores específico para AFIP con logging mejorado
ARCARouter.use((error, req, res, next) => {
    console.error('💥 Error en ruta ARCA/AFIP:', {
        message: error.message,
        path: req.path,
        method: req.method,
        body: req.method === 'POST' ? Object.keys(req.body || {}) : null,
        stack: error.stack
    });
    
    // Identificar tipo de error
    let errorType = 'general_error';
    let statusCode = 500;
    
    if (error.message.includes('AFIP') || error.message.includes('CAE')) {
        errorType = 'afip_error';
    } else if (error.message.includes('certificado') || error.message.includes('certificate')) {
        errorType = 'certificate_error';
    } else if (error.message.includes('PDF')) {
        errorType = 'pdf_error';
        statusCode = 422; // Error procesable
    } else if (error.message.includes('database') || error.message.includes('MongoDB')) {
        errorType = 'database_error';
    } else if (error.message.includes('validation')) {
        errorType = 'validation_error';
        statusCode = 400;
    }
    
    res.status(statusCode).json({
        success: false,
        error: error.message,
        errorType: errorType,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString(),
        environment: process.env.AFIP_ENV,
        ...(process.env.NODE_ENV === 'development' && {
            stack: error.stack,
            bodyKeys: req.method === 'POST' ? Object.keys(req.body || {}) : null
        })
    });
});

export default ARCARouter;