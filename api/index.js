import bodyParser from "body-parser"
import express from "express"
import { PORT } from "../config.js"
import cors from "cors"
import { connectDB } from "../db/db.js"
import ProductRouter from "../api/routes/productRoute.js"
import { CategoryRoute } from "../api/routes/categoryRoute.js"
import userRouter from "../api/routes/userRoute.js"
import dumpsterRouter from "../api/routes/dumpsterRoute.js"
import cookieParser from "cookie-parser"
import session from "express-session"
import ClientRouter from "../api/routes/clientsRoute.js"
import ARCARouter from "./routes/arcaRoute.js"
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import Invoice from '../models/invoiceModel.js';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express()

// ✅ CONFIGURACIÓN UNIFICADA DEL DIRECTORIO DE INVOICES
const INVOICES_DIR = path.resolve(process.cwd(), 'invoices');
console.log('📁 Directorio de invoices unificado:', INVOICES_DIR);

// Crear directorio si no existe
if (!fs.existsSync(INVOICES_DIR)) {
    fs.mkdirSync(INVOICES_DIR, { recursive: true });
    console.log('📁 Directorio invoices creado:', INVOICES_DIR);
} else {
    console.log('📁 Directorio invoices existente:', INVOICES_DIR);
}

// Verificar permisos
try {
    fs.accessSync(INVOICES_DIR, fs.constants.R_OK | fs.constants.W_OK);
    console.log('✅ Permisos de lectura/escritura confirmados');
} catch (error) {
    console.error('❌ Error de permisos en directorio invoices:', error.message);
}
 
app.use(cors({
    origin: "*",
    methods: [ "GET", "PUT", "POST", "DELETE", "OPTIONS"],
    credentials: true,
    optionsSuccessStatus: 200
}))

app.use(express.json({ limit: '50mb' }));
app.use(bodyParser.json({ limit: '50mb' }))
app.use(bodyParser.urlencoded({ extended: true }))
app.use(cookieParser())

app.use(session({
    secret : "secret",
    resave : false,
    saveUninitialized : false,
    cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
    }
}))

// ✅ Middleware de logging mejorado
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`)
    if (req.method === 'POST' && req.path.includes('arca')) {
        console.log('📊 Body:', JSON.stringify(req.body, null, 2))
    }
    next()
})

// ✅ Conectar a la base de datos
connectDB()


console.log('📂 Archivos estáticos configurados en /invoices -> ', INVOICES_DIR);

// ✅ RUTAS API - ORDEN CORRECTO Y SIN DUPLICADOS
app.use("/api/products", ProductRouter)
app.use("/api/categories", CategoryRoute)
app.use("/api/users", userRouter)
app.use("/api/dumpsters", dumpsterRouter)
app.use("/api/clients", ClientRouter)

// ✅ ARCA ROUTER - DEBE IR ANTES QUE CUALQUIER ENDPOINT ESPECÍFICO
app.use("/api/arca", ARCARouter)


// ✅ SERVIR ARCHIVOS ESTÁTICOS DE INVOICES (ANTES de las rutas API)
app.use('/invoices', express.static(INVOICES_DIR, {
    setHeaders: (res, path) => {
        if (path.endsWith('.pdf')) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

// ✅ FUNCIÓN PARA CONVERTIR HTML A PDF
const htmlToPdf = async (htmlContent) => {
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '10mm',
                right: '10mm',
                bottom: '10mm',
                left: '10mm'
            }
        });
        
        return pdfBuffer;
    } finally {
        await browser.close();
    }
};

// ✅ FUNCIÓN PARA GENERAR HTML DE FACTURA
const generateInvoiceHTML = async (invoice, companyConfig) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Factura ${invoice.numeroFactura}</title>
        <style>
            * { box-sizing: border-box; }
            body {
                font-family: 'Arial', sans-serif;
                margin: 0;
                padding: 15px;
                color: #333;
                font-size: 12px;
            }
            .page {
                max-width: 210mm;
                margin: 0 auto;
                background: white;
                padding: 20px;
            }
            .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                border-bottom: 3px solid #2196f3;
                padding-bottom: 20px;
                margin-bottom: 20px;
            }
            .company-info {
                flex: 1;
                padding-right: 20px;
            }
            .company-name {
                font-size: 20px;
                font-weight: bold;
                color: #2196f3;
                margin-bottom: 8px;
            }
            .company-details {
                font-size: 11px;
                line-height: 1.4;
                color: #666;
            }
            .invoice-info {
                flex: 1;
                text-align: right;
                border: 2px solid #2196f3;
                padding: 15px;
                border-radius: 8px;
                background: #f8f9fa;
            }
            .invoice-title {
                font-size: 18px;
                font-weight: bold;
                color: #2196f3;
                margin-bottom: 8px;
            }
            .invoice-number {
                font-size: 16px;
                font-weight: bold;
                margin-bottom: 10px;
            }
            .invoice-details {
                font-size: 11px;
                line-height: 1.4;
            }
            ${invoice.testing ? `
            .testing-banner {
                background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
                border: 2px solid #2196f3;
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 20px;
                text-align: center;
            }
            .testing-text {
                color: #1976d2;
                font-weight: bold;
                font-size: 14px;
            }
            ` : ''}
            .items-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
                font-size: 11px;
            }
            .items-table th,
            .items-table td {
                border: 1px solid #ddd;
                padding: 8px;
                text-align: left;
            }
            .items-table th {
                background-color: #2196f3;
                color: white;
                font-weight: bold;
                font-size: 10px;
                text-transform: uppercase;
            }
            .items-table tr:nth-child(even) {
                background-color: #f9f9f9;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .totals-section {
                display: flex;
                justify-content: flex-end;
                margin-bottom: 30px;
            }
            .totals {
                width: 280px;
                background: #f8f9fa;
                padding: 15px;
                border-radius: 8px;
                border: 2px solid #2196f3;
            }
            .total-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
                padding: 3px 0;
                font-size: 11px;
            }
            .total-final {
                border-top: 2px solid #2196f3;
                padding-top: 8px;
                font-weight: bold;
                font-size: 13px;
                color: #2196f3;
            }
            .footer {
                margin-top: 40px;
                padding-top: 15px;
                border-top: 1px solid #ddd;
                text-align: center;
                color: #666;
                font-size: 10px;
                line-height: 1.4;
            }
        </style>
    </head>
    <body>
        <div class="page">
            <!-- Header -->
            <div class="header">
                <div class="company-info">
                    <div class="company-name">${companyConfig.razonSocial}</div>
                    <div class="company-details">
                        <div><strong>CUIT:</strong> ${companyConfig.cuit}</div>
                        <div><strong>Domicilio:</strong> ${companyConfig.domicilio}</div>
                    </div>
                </div>
                <div class="invoice-info">
                    <div class="invoice-title">FACTURA ${invoice.tipo}</div>
                    <div class="invoice-number">${invoice.numeroFactura}</div>
                    <div class="invoice-details">
                        <div><strong>Fecha:</strong> ${new Date(invoice.fechaEmision).toLocaleDateString('es-AR')}</div>
                        ${!invoice.testing && invoice.cae ? `
                        <div><strong>CAE:</strong> ${invoice.cae}</div>
                        <div><strong>Vto. CAE:</strong> ${invoice.fechaVencimientoCAE}</div>
                        ` : ''}
                    </div>
                </div>
            </div>

            ${invoice.testing ? `
            <!-- Testing Banner -->
            <div class="testing-banner">
                <div class="testing-text">🧪 FACTURA DE PRUEBA - SIN VALIDEZ FISCAL</div>
            </div>
            ` : ''}

            <!-- Cliente -->
            <div style="margin-bottom: 25px; background: #f8f9fa; padding: 15px; border-radius: 6px;">
                <h3>📋 Cliente: ${invoice.client?.name || invoice.cliente}</h3>
                ${invoice.client?.cuit ? `<div>CUIT: ${invoice.client.cuit}</div>` : ''}
                ${invoice.client?.location ? `<div>Domicilio: ${invoice.client.location}</div>` : ''}
            </div>

            <!-- Items Table -->
            <table class="items-table">
                <thead>
                    <tr>
                        <th style="width: 50%">Descripción</th>
                        <th class="text-center" style="width: 10%">Cant.</th>
                        <th class="text-right" style="width: 15%">Precio Unit.</th>
                        <th class="text-right" style="width: 15%">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${invoice.items?.map(item => {
                        const unitPrice = invoice.tipo === 'A' ? item.priceWithoutIVA : item.priceWithIVA || item.unitPrice;
                        const subtotal = unitPrice * item.quantity;
                        
                        return `
                        <tr>
                            <td>${item.name}</td>
                            <td class="text-center">${item.quantity}</td>
                            <td class="text-right">$${unitPrice.toFixed(2)}</td>
                            <td class="text-right">$${subtotal.toFixed(2)}</td>
                        </tr>
                        `;
                    }).join('') || '<tr><td colspan="4">No hay items</td></tr>'}
                </tbody>
            </table>

            <!-- Totals -->
            <div class="totals-section">
                <div class="totals">
                    ${invoice.tipo === 'A' ? `
                    <div class="total-row">
                        <span>Subtotal:</span>
                        <span>$${(invoice.subtotal || 0).toFixed(2)}</span>
                    </div>
                    <div class="total-row">
                        <span>IVA (21%):</span>
                        <span>$${(invoice.iva || 0).toFixed(2)}</span>
                    </div>
                    ` : ''}
                    <div class="total-row total-final">
                        <span>TOTAL:</span>
                        <span>$${(invoice.total || 0).toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="footer">
                ${invoice.testing 
                    ? '💡 Factura de prueba generada para testing del sistema.'
                    : '💡 Factura generada oficialmente.'
                }
                <br><br>
                <strong>Generado el:</strong> ${new Date().toLocaleString('es-AR')}
            </div>
        </div>
    </body>
    </html>
    `;
};

// ✅ RUTAS ESTÁTICAS PARA PDFs (mantener como backup)
app.get('/invoices/:fileName', (req, res) => {
    const fileName = req.params.fileName;
    const filePath = path.join(INVOICES_DIR, fileName);
    
    console.log('👁️ Solicitud de PDF para vista:', fileName);
    console.log('📂 Ruta completa:', filePath);
    
    if (fs.existsSync(filePath)) {
        try {
            const fileStats = fs.statSync(filePath);
            console.log('📊 Tamaño del archivo:', fileStats.size, 'bytes');
            
            if (fileStats.size === 0) {
                console.error('❌ Archivo PDF vacío:', fileName);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Archivo PDF corrupto (tamaño 0 bytes)' 
                });
            }
            
            // ✅ Verificar que es un PDF válido
            const buffer = fs.readFileSync(filePath);
            const pdfHeader = buffer.slice(0, 5).toString();
            
            if (!pdfHeader.startsWith('%PDF')) {
                console.error('❌ Archivo no es un PDF válido:', fileName, 'Header:', pdfHeader);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Archivo no es un PDF válido',
                    header: pdfHeader
                });
            }
            
            console.log('✅ PDF válido, enviando archivo:', fileName);
            
            // ✅ Configurar headers para vista en navegador
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
            res.setHeader('Content-Length', fileStats.size);
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Accept-Ranges', 'bytes');
            
            // ✅ Enviar archivo como stream
            const readStream = fs.createReadStream(filePath);
            readStream.pipe(res);
            
            readStream.on('error', (error) => {
                console.error('❌ Error leyendo PDF:', error);
                if (!res.headersSent) {
                    res.status(500).json({ success: false, error: 'Error leyendo PDF' });
                }
            });
            
            readStream.on('end', () => {
                console.log('✅ PDF enviado correctamente:', fileName);
            });
            
        } catch (error) {
            console.error('❌ Error procesando PDF:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Error procesando PDF',
                details: error.message
            });
        }
    } else {
        console.error('❌ Archivo no encontrado:', filePath);
        
        // Debug: listar archivos disponibles
        try {
            const availableFiles = fs.readdirSync(INVOICES_DIR);
            console.log('📁 Archivos disponibles:', availableFiles);
        } catch (e) {
            console.error('❌ Error listando archivos:', e.message);
        }
        
        res.status(404).json({ 
            success: false, 
            error: 'Factura no encontrada',
            fileName: fileName,
            searchPath: filePath
        });
    }
});

// ✅ RUTA DE DESCARGA
app.get('/invoices/download/:fileName', (req, res) => {
    const fileName = req.params.fileName;
    const filePath = path.join(INVOICES_DIR, fileName);
    
    console.log('💾 Solicitud de descarga de PDF:', fileName);
    
    if (fs.existsSync(filePath)) {
        try {
            const fileStats = fs.statSync(filePath);
            
            if (fileStats.size === 0) {
                console.error('❌ Archivo PDF vacío para descarga:', fileName);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Archivo PDF corrupto' 
                });
            }
            
            // ✅ Headers para forzar descarga
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            res.setHeader('Content-Length', fileStats.size);
            res.setHeader('Cache-Control', 'no-cache');
            
            const readStream = fs.createReadStream(filePath);
            readStream.pipe(res);
            
            readStream.on('error', (error) => {
                console.error('❌ Error descargando PDF:', error);
                if (!res.headersSent) {
                    res.status(500).json({ success: false, error: 'Error descargando PDF' });
                }
            });
            
            readStream.on('end', () => {
                console.log('✅ PDF descargado correctamente:', fileName);
            });
            
        } catch (error) {
            console.error('❌ Error procesando descarga:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Error procesando descarga',
                details: error.message
            });
        }
    } else {
        res.status(404).json({ 
            success: false, 
            error: 'Archivo no encontrado para descarga',
            fileName: fileName
        });
    }
});

// ✅ RUTAS DE PRUEBA Y DEBUG
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'API funcionando correctamente',
        version: '3.2-FIXED',
        database: 'MongoDB integrado',
        timestamp: new Date().toISOString(),
        invoicesDir: INVOICES_DIR,
        invoicesDirExists: fs.existsSync(INVOICES_DIR),
        endpoints: {
            generateInvoice: 'POST /api/arca/generate-invoice',
            viewPDF: 'GET /api/arca/invoices/:id/pdf',
            downloadPDF: 'GET /api/arca/invoices/:id/download',
            arcaTest: 'GET /api/arca/test'
        }
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        version: '3.2-FIXED',
        database: 'MongoDB',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    })
})

// ✅ ENDPOINT PARA VERIFICAR ARCA ESPECÍFICAMENTE
app.get('/api/debug/arca-routes', (req, res) => {
    res.json({
        success: true,
        message: 'Rutas ARCA configuradas correctamente',
        availableRoutes: [
            'GET /api/arca/test',
            'POST /api/arca/generate-invoice',
            'POST /api/arca/generate-simple-invoice',
            'GET /api/arca/invoices',
            'GET /api/arca/invoices/:id',
            'GET /api/arca/invoices/:id/pdf',
            'GET /api/arca/invoices/:id/download',
            'GET /api/arca/debug/full-status',
            'GET /api/arca/debug/mongodb',
            'GET /api/arca/debug/afip-status'
        ],
        timestamp: new Date().toISOString()
    });
});

// ✅ Middleware para manejar errores 404 - DEBE ESTAR AL FINAL
app.use('*', (req, res) => {
    console.log('❌ 404 - Ruta no encontrada:', req.originalUrl)
    res.status(404).json({
        success: false,
        error: 'Endpoint no encontrado',
        path: req.originalUrl,
        method: req.method,
        suggestion: req.originalUrl.includes('arca') ? 'Verificar rutas ARCA en /api/debug/arca-routes' : null,
        availableRoutes: {
            generateInvoice: 'POST /api/arca/generate-invoice',
            arcaTest: 'GET /api/arca/test',
            api: '/api/*',
            invoices: '/invoices/:fileName',
            download: '/invoices/download/:fileName'
        }
    });
});

// ✅ Middleware de manejo de errores
app.use((error, req, res, next) => {
    console.error('💥 Error no manejado:', error)
    console.error('📍 Stack trace:', error.stack)
    
    res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? {
            stack: error.stack,
            path: req.path,
            method: req.method
        } : undefined
    })
})

// ✅ Manejar cierre graceful
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM recibido, cerrando servidor...')
    process.exit(0)
})

process.on('SIGINT', () => {
    console.log('🛑 SIGINT recibido, cerrando servidor...')
    process.exit(0)
})

// ✅ Iniciar servidor
app.listen(PORT, () => {
    console.log(`\n🚀 ===== SERVIDOR INICIADO ===== 🚀`);
    console.log(`📡 Puerto: ${PORT}`);
    console.log(`💾 Base de datos: MongoDB`);
    console.log(`📁 Directorio invoices: ${INVOICES_DIR}`);
    console.log(`🔗 Endpoints principales:`);
    console.log(`   - POST /api/arca/generate-invoice`);
    console.log(`   - GET /api/arca/invoices/:id/pdf`);
    console.log(`   - GET /api/arca/test`);
    console.log(`   - GET /api/debug/arca-routes`);
    console.log(`✅ Servidor listo para recibir requests`);
    console.log(`\n🏛️ ===== CONFIGURACIÓN AFIP ===== 🏛️`);
    console.log(`   Environment: ${process.env.AFIP_ENV || 'testing'}`);
    console.log(`   CUIT: ${process.env.COMPANY_CUIT}`);
    console.log(`   Punto de Venta: ${process.env.PUNTO_VENTA || '0001'}`);
    console.log(`   Certificado: ${process.env.AFIP_CERT_PATH ? '✅ Configurado' : '❌ Faltante'}`);
});