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
import ARCARouter from "../api/routes/arcaRoute.js"
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express()
 
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
    resave : false,// evita que se vuelva a guardar la session si no hay datos
    saveUninitialized : false, //evita que la sesion se guarde si no fue inicializada
    cookie: {
        secure: false, // Cambiar a true si usas HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}))

app.use((req, res, next) => {
       res.status(404).json({ success: false, error: 'Ruta no encontrada' });
   });

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`)
    if (req.method === 'POST' && req.path.includes('arca')) {
        console.log('📊 Body:', JSON.stringify(req.body, null, 2))
    }
    next()
})



app.use(bodyParser.urlencoded({ extended: true }))

connectDB()

app.use("/api/products", ProductRouter)
app.use("/api/categories", CategoryRoute)
app.use("/api/users", userRouter)
app.use("/api/dumpsters", dumpsterRouter)
app.use("/api/clients", ClientRouter)
app.use("/api/arca", ARCARouter)


const invoicesDir = path.join(__dirname, './invoices')
if (!fs.existsSync(invoicesDir)) {
    fs.mkdirSync(invoicesDir, { recursive: true })
    console.log('📁 Directorio invoices creado:', invoicesDir)
}

app.get('/api/invoices/view/:fileName', (req, res) => {
    const fileName = req.params.fileName;
    const filePath = path.join(invoicesDir, fileName);
    
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ success: false, error: 'Factura no encontrada' });
    }
});
// ✅ Ruta de prueba
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'API funcionando correctamente',
        timestamp: new Date().toISOString(),
        invoicesDir: path.join(__dirname, '../invoices')
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    })
})


// ✅ Endpoint para verificar directorio de invoices
app.get('/api/debug/invoices-dir', (req, res) => {
    try {
        const exists = fs.existsSync(invoicesDir)
        const files = exists ? fs.readdirSync(invoicesDir) : []
        const pdfFiles = files.filter(file => file.endsWith('.pdf'))
        
        // ✅ Verificar permisos sin usar fs.constants (ES6 compatible)
        let canRead = false
        let canWrite = false
        
        try {
            fs.accessSync(invoicesDir, fs.constants.R_OK)
            canRead = true
        } catch (e) {
            canRead = false
        }
        
        try {
            fs.accessSync(invoicesDir, fs.constants.W_OK)
            canWrite = true
        } catch (e) {
            canWrite = false
        }
        
        res.json({
            success: true,
            directory: invoicesDir,
            exists: exists,
            totalFiles: files.length,
            pdfFiles: pdfFiles.length,
            files: files,
            permissions: {
                readable: canRead,
                writable: canWrite
            },
            stats: {
                __dirname: __dirname,
                cwd: process.cwd(),
                nodeVersion: process.version
            }
        })
    } catch (error) {
        console.error('Error verificando directorio:', error)
        res.status(500).json({
            success: false,
            error: error.message,
            directory: invoicesDir,
            stack: error.stack
        })
    }
})
// ✅ Endpoint específico para debug de ARCA
app.get('/api/debug/arca-status', (req, res) => {
    res.json({
        success: true,
        arcaEndpoints: {
            'POST /api/arca/generate-invoice': 'Generar factura ARCA',
            'POST /api/arca/generate-simple-invoice': 'Generar factura simple',
            'GET /api/arca/invoices': 'Listar facturas',
            'GET /api/arca/download-pdf/:fileName': 'Descargar PDF',
            'GET /api/arca/view-pdf/:fileName': 'Ver PDF'
        },
        staticFiles: `/invoices/* -> ${invoicesDir}`,
        timestamp: new Date().toISOString()
    })
})

// ✅ Middleware para manejar errores 404
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint no encontrado',
        path: req.originalUrl
    });
});


// ✅ Manejar cierre graceful del servidor
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM recibido, cerrando servidor...')
    process.exit(0)
})

process.on('SIGINT', () => {
    console.log('🛑 SIGINT recibido, cerrando servidor...')
    process.exit(0)
})

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

// ✅ Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`📋 API ARCA disponible en: http://localhost:${PORT}/api/arca`);
    console.log(`📄 PDFs disponibles en: http://localhost:${PORT}/api/invoices/view`);
    console.log(`🧪 Ruta de prueba: http://localhost:${PORT}/api/test`);
});
