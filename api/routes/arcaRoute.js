import express from 'express';
import { generateARCAInvoice, getCompanyConfig, updateCompanyConfig } from '../../api/controller/arcaController.js';
import { downloadPDF, viewPDF } from '../../api/controller/generateInvoicePDF.js';

const ARCARouter = express.Router();

// ✅ Logging middleware específico para ARCA
ARCARouter.use((req, res, next) => {
    console.log(`🏛️ ARCA Route: ${req.method} ${req.path}`, 
        req.method === 'POST' ? { body: req.body } : {}
    );
    next();
});

// Generar factura en ARCA
ARCARouter.post('/generate-invoice', generateARCAInvoice);

// Obtener configuración de la empresa
ARCARouter.get('/company-config', getCompanyConfig);

// Actualizar configuración de la empresa
ARCARouter.put('/company-config', updateCompanyConfig);
// Descargar PDF de factura (fuerza descarga)
ARCARouter.get('/download-pdf/:fileName', downloadPDF);

// Ver PDF de factura en el navegador (vista previa)
ARCARouter.get('/view-pdf/:fileName', viewPDF);

// ✅ Listar facturas 
ARCARouter.get('/invoices', async (req, res) => {
    try {
        console.log('📋 Listando facturas...');
        
        const fs = await import('fs');
        const path = await import('path');
        
        const invoicesDir = path.join(process.cwd(), 'invoices');
        console.log('📂 Directorio invoices:', invoicesDir);

        // Crear directorio si no existe
        if (!fs.existsSync(invoicesDir)) {
            fs.mkdirSync(invoicesDir, { recursive: true });
            console.log('📁 Directorio invoices creado');
        }

        // Leer archivos del directorio
        const files = fs.readdirSync(invoicesDir);
        const pdfFiles = files.filter(file => file.endsWith('.pdf'));
        
        console.log(`📄 PDFs encontrados: ${pdfFiles.length}`);

        // Obtener información de cada archivo
        const invoices = pdfFiles.map(fileName => {
            const filePath = path.join(invoicesDir, fileName);
            const stats = fs.statSync(filePath);
            
            return {
                fileName: fileName,
                createdAt: stats.birthtime,
                modifiedAt: stats.mtime,
                size: stats.size,
                sizeFormatted: formatBytes(stats.size),
                downloadUrl: `/api/arca/download-pdf/${fileName}`,
                viewUrl: `/api/arca/view-pdf/${fileName}`,
                isTest: fileName.includes('TEST'),
                invoiceNumber: extractInvoiceNumber(fileName)
            };
        });

        // Ordenar por fecha de creación (más recientes primero)
        invoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({
            success: true,
            invoices: invoices,
            count: invoices.length,
            directory: invoicesDir
        });

    } catch (error) {
        console.error('❌ Error listando facturas:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

ARCARouter.post('/generate-simple-invoice', async (req, res) => {
  try {
    const { cartItems, paymentMethod = 'No especificado' } = req.body;
    
    // Cliente por defecto para factura simple
    const defaultClient = {
      name: 'Consumidor Final',
      cuit: '',
      typeOfClient: 'CF',
      location: '',
      email: ''
    };

    // Usar la función existente con testing: true
    const result = await generateARCAInvoice({
      body: {
        client: defaultClient,
        cartItems,
        paymentMethod,
        testing: true,
        simple: true
      }
    }, res);

  } catch (error) {
    console.error('Error generando factura simple:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ Funciones helper
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function extractInvoiceNumber(fileName) {
    // Extraer número de factura del nombre del archivo
    const match = fileName.match(/factura_(.+?)_\d+\.pdf$/);
    return match ? match[1] : 'N/A';
}

export default ARCARouter;