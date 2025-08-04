import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Asegurar que existe el directorio para PDFs
const PDF_DIR = path.join(__dirname, '../invoices');
if (!fs.existsSync(PDF_DIR)) {
    fs.mkdirSync(PDF_DIR, { recursive: true });
}

// Configuración de tu empresa (guarda esto en una base de datos o archivo de configuración)
let companyConfig = {
    cuit: "20123456789", // TU CUIT REAL
    razonSocial: "MI EMPRESA S.A.S",
    ptoVenta: "0001",
    // Credenciales ARCA/AFIP
    usuario: "tu_usuario_afip",
    password: "tu_password_afip",
    // Configuración adicional
    domicilio: "Calle Falsa 123",
    condicionIVA: "Responsable Inscripto",
    fechaInicioActividades: "01/01/2020"
};

// Determinar tipo de factura según cliente
const determineInvoiceType = (client) => {
    if (!client || !client.cuit || client.cuit === "0" || client.typeOfClient === 'CF') {
        return { type: 'C', code: '011', description: 'Factura C' };
    }

    switch (client.typeOfClient?.toUpperCase()) {
        case 'RI':
        case 'RESPONSABLE_INSCRIPTO':
            return { type: 'A', code: '001', description: 'Factura A' };
        case 'EX':
        case 'EXENTO':
            return { type: 'A', code: '001', description: 'Factura A (Exento)' };
        case 'MONOTRIBUTO':
            return { type: 'B', code: '006', description: 'Factura B' };
          
        default:
            return { type: 'C', code: '011', description: 'Factura C' };
    }
};



export const generateTestInvoice = async (client, cartItems, paymentMethod) => {
    try {
        // Determinar tipo de factura
        const invoiceType = determineInvoiceType(client);
        
        // Calcular totales
        const subtotal = cartItems.reduce((total, item) => {
            const price = invoiceType.type === 'A' ? item.priceWithoutIVA : item.priceWithIVA;
            return total + (price * item.quantity);
        }, 0);

        const ivaAmount = invoiceType.type === 'C' ? 0 : subtotal * 0.21;
        const total = invoiceType.type === 'A' ? subtotal + ivaAmount : subtotal;

        // Generar datos de factura simulada
        const invoiceData = {
            numeroFactura: `TEST-${String(Math.floor(Math.random() * 10000)).padStart(8, '0')}`,
            cae: `TEST${String(Math.floor(Math.random() * 100000000000000)).padStart(14, '0')}`,
            fechaVencimientoCAE: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            tipo: invoiceType.type,
            descripcionTipo: invoiceType.description,
            cliente: client.name,
            client: client,
            total: total,
            subtotal: subtotal,
            iva: ivaAmount,
            fechaEmision: new Date().toLocaleDateString('es-AR'),
            metodoPago: paymentMethod,
            items: cartItems,
            testing: true
        };

        // ✅ GENERAR PDF
        const pdfResult = await generateInvoicePDF(invoiceData, companyConfig);
        
        return {
            ...invoiceData,
            pdfPath: pdfResult.relativePath,
            pdfFileName: pdfResult.fileName,
            downloadUrl: `/api/arca/download-pdf/${pdfResult.fileName}`,
            viewUrl: `/api/arca/view-pdf/${pdfResult.fileName}`
        };

    } catch (error) {
        console.error('Error generando factura de prueba:', error);
        throw error;
    }
};


// Función principal para generar factura en ARCA

export const generateARCAInvoice = async (req, res) => {
  try {
    console.log('🏛️ generateARCAInvoice - Body recibido:', req.body);
    
    const { client, cartItems, paymentMethod, testing = false } = req.body;

    // ✅ Validaciones básicas
    if (!cartItems || cartItems.length === 0) {
      console.error('❌ No hay productos en el carrito');
      return res.status(400).json({ 
        success: false, 
        error: 'No hay productos en el carrito' 
      });
    }

    if (!client || !client.name) {
      console.error('❌ Datos del cliente incompletos');
      return res.status(400).json({ 
        success: false, 
        error: 'Datos del cliente incompletos' 
      });
    }

    console.log('🧪 Modo testing:', testing);
    
    // ✅ TESTING MODE - Generar datos simulados
    if (testing) {
      console.log('🧪 Generando factura de prueba...');
      
      const numeroFactura = `TEST-${String(Math.floor(Math.random() * 10000)).padStart(8, '0')}`;
      const total = cartItems.reduce((sum, item) => sum + (item.priceWithIVA * item.quantity), 0);
      const subtotal = cartItems.reduce((sum, item) => sum + (item.priceWithoutIVA * item.quantity), 0);
      const iva = total - subtotal;
      
      const testResult = {
        success: true,
        numeroFactura: numeroFactura,
        cae: `TEST${String(Math.floor(Math.random() * 100000000000000)).padStart(14, '0')}`,
        fechaVencimientoCAE: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        tipo: 'C', // Simplificado para testing
        descripcionTipo: 'Factura C (Testing)',
        cliente: client.name,
        total: total,
        subtotal: subtotal,
        iva: iva,
        fechaEmision: new Date().toLocaleDateString('es-AR'),
        metodoPago: paymentMethod,
        testing: true,
        // ✅ TODO: Generar PDF real aquí si es necesario
        pdfPath: `/test/invoices/factura_${numeroFactura}.pdf`,
        pdfFileName: `factura_${numeroFactura}.pdf`,
        downloadUrl: `#test-download`,
        viewUrl: `#test-view`
      };
      
      console.log('✅ Factura de prueba generada:', testResult);
      return res.json(testResult);
    }

    // ✅ PRODUCTION MODE - Llamar ARCA real
    // ... resto del código para producción

  } catch (error) {
    console.error('❌ Error en generateARCAInvoice:', error);
    console.error('❌ Stack trace:', error.stack);
    
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack // Solo para debugging
    });
  }
};

// ✅ PASO 5: Comandos para debugging inmediato:

// 1. Ver logs del servidor:
console.log('🔍 Servidor iniciado en puerto 3000');

// 2. Probar endpoint manualmente:
fetch('http://localhost:3000/api/arca/generate-invoice', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client: { name: 'Test Client', typeOfClient: 'CF' },
    cartItems: [{ name: 'Test Item', priceWithIVA: 100, priceWithoutIVA: 82.64, quantity: 1 }],
    paymentMethod: 'Efectivo',
    testing: true
  })
}).then(r => r.json()).then(console.log).catch(console.error);

// Automatizar ARCA usando Puppeteer
export const automateARCAInvoice = async (invoiceData) => {
    const browser = await puppeteer.launch({ 
        headless: false, // Cambiar a true en producción
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // 1. Ir a ARCA
        await page.goto('https://serviciosweb.afip.gob.ar/genericos/comprobantes/');
        
        // 2. Login con CUIT y Clave Fiscal
        await page.waitForSelector('#F1\\:username');
        await page.type('#F1\\:username', companyConfig.cuit);
        await page.type('#F1\\:password', companyConfig.password);
        await page.click('#F1\\:btnSiguiente');
        
        // Esperar a que cargue la página principal
        await page.waitForNavigation();
        await page.waitForTimeout(2000);
        
        // 3. Seleccionar "Comprobantes en línea"
        await page.waitForSelector('a[href*="comprobantes"]');
        await page.click('a[href*="comprobantes"]');
        
        // 4. Seleccionar tipo de comprobante
        await page.waitForSelector('#idTipoComprobante');
        await page.select('#idTipoComprobante', invoiceData.invoiceType.code);
        
        // 5. Punto de venta
        await page.waitForSelector('#idPuntoVenta');
        await page.select('#idPuntoVenta', companyConfig.ptoVenta);
        
        // 6. Datos del cliente
        if (invoiceData.client.cuit && invoiceData.invoiceType.type !== 'C') {
            await page.select('#idTipoDocumento', '80'); // CUIT
            await page.type('#nroDocumento', invoiceData.client.cuit.replace(/-/g, ''));
        } else {
            await page.select('#idTipoDocumento', '96'); // DNI
            await page.type('#nroDocumento', '0');
        }
        
        await page.type('#denominacion', invoiceData.client.name);
        
        if (invoiceData.client.location) {
            await page.type('#domicilio', invoiceData.client.location);
        }
        
        // 7. Agregar productos/servicios
        for (let i = 0; i < invoiceData.cartItems.length; i++) {
            const item = invoiceData.cartItems[i];
            
            // Si no es el primer item, agregar nueva fila
            if (i > 0) {
                await page.click('#btnAgregarDetalle');
                await page.waitForTimeout(1000);
            }
            
            // Llenar datos del item
            const itemPrice = invoiceData.invoiceType.type === 'A' ? 
                item.priceWithoutIVA : item.priceWithIVA;
            
            await page.type(`#detalle_descripcion_${i}`, item.name);
            await page.type(`#detalle_cantidad_${i}`, item.quantity.toString());
            await page.type(`#detalle_precio_${i}`, itemPrice.toFixed(2));
            
            // Alícuota IVA (solo para Factura A)
            if (invoiceData.invoiceType.type === 'A') {
                await page.select(`#detalle_alicuota_${i}`, '5'); // 21%
            }
        }
        
        // 8. Confirmar y generar
        await page.click('#btnConfirmar');
        await page.waitForTimeout(3000);
        
        // 9. Obtener datos de la factura generada
        await page.waitForSelector('#numeroComprobante');
        const numeroFactura = await page.$eval('#numeroComprobante', el => el.textContent);
        
        await page.waitForSelector('#cae');
        const cae = await page.$eval('#cae', el => el.textContent);
        
        await page.waitForSelector('#fechaVencimientoCAE');
        const fechaVencimientoCAE = await page.$eval('#fechaVencimientoCAE', el => el.textContent);
        
        // 10. Descargar PDF si está disponible
        let pdfPath = null;
        try {
            await page.waitForSelector('#btnDescargarPDF', { timeout: 5000 });
            await page.click('#btnDescargarPDF');
            // Aquí podrías manejar la descarga del PDF
            pdfPath = `./invoices/factura_${numeroFactura}.pdf`;
        } catch (error) {
            console.log('PDF no disponible inmediatamente');
        }
        
        return {
            numeroFactura: numeroFactura,
            cae: cae,
            fechaVencimientoCAE: fechaVencimientoCAE,
            tipo: invoiceData.invoiceType.type,
            descripcionTipo: invoiceData.invoiceType.description,
            cliente: invoiceData.client.name,
            total: invoiceData.total,
            subtotal: invoiceData.subtotal,
            iva: invoiceData.ivaAmount,
            fechaEmision: new Date().toLocaleDateString('es-AR'),
            metodoPago: invoiceData.paymentMethod,
            pdfPath: pdfPath
        };
        
    } finally {
        await browser.close();
    }
};

// Obtener configuración de la empresa
export const getCompanyConfig = async (req, res) => {
    try {
        // No enviar la password por seguridad
        const config = { ...companyConfig };
        delete config.password;
        
        res.json({
            success: true,
            config: config
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Actualizar configuración de la empresa
export const updateCompanyConfig = async (req, res) => {
    try {
        const { cuit, razonSocial, ptoVenta, usuario, password, domicilio, condicionIVA } = req.body;
        
        // Actualizar configuración
        companyConfig = {
            ...companyConfig,
            cuit: cuit || companyConfig.cuit,
            razonSocial: razonSocial || companyConfig.razonSocial,
            ptoVenta: ptoVenta || companyConfig.ptoVenta,
            usuario: usuario || companyConfig.usuario,
            password: password || companyConfig.password,
            domicilio: domicilio || companyConfig.domicilio,
            condicionIVA: condicionIVA || companyConfig.condicionIVA
        };
        
        // Aquí podrías guardar en base de datos o archivo
        // await saveConfigToDatabase(companyConfig);
        
        res.json({
            success: true,
            message: 'Configuración actualizada correctamente'
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

export const generateInvoicePDF = async (invoiceData, companyConfig) => {
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
    });

    try {
        const page = await browser.newPage();

        // HTML de la factura (tu código existente)
        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Factura ${invoiceData.numeroFactura}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                    color: #333;
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    border-bottom: 3px solid #2196f3;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                .company-info {
                    flex: 1;
                }
                .invoice-info {
                    text-align: right;
                    flex: 1;
                }
                .company-name {
                    font-size: 24px;
                    font-weight: bold;
                    color: #2196f3;
                    margin-bottom: 10px;
                }
                .invoice-title {
                    font-size: 28px;
                    font-weight: bold;
                    color: #333;
                    margin-bottom: 10px;
                }
                .invoice-number {
                    font-size: 20px;
                    color: #666;
                    margin-bottom: 5px;
                }
                ${invoiceData.testing ? `
                .testing-banner {
                    background-color: #e3f2fd;
                    border: 2px solid #2196f3;
                    border-radius: 8px;
                    padding: 15px;
                    margin-bottom: 20px;
                    text-align: center;
                }
                .testing-text {
                    color: #1976d2;
                    font-weight: bold;
                    font-size: 16px;
                }
                ` : ''}
                .info-section {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 30px;
                }
                .info-box {
                    background: #f8f9fa;
                    padding: 15px;
                    border-radius: 8px;
                    flex: 1;
                    margin: 0 10px;
                }
                .info-box h3 {
                    margin-top: 0;
                    color: #2196f3;
                    border-bottom: 1px solid #ddd;
                    padding-bottom: 5px;
                }
                .items-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 30px;
                }
                .items-table th,
                .items-table td {
                    border: 1px solid #ddd;
                    padding: 12px;
                    text-align: left;
                }
                .items-table th {
                    background-color: #2196f3;
                    color: white;
                    font-weight: bold;
                }
                .items-table tr:nth-child(even) {
                    background-color: #f8f9fa;
                }
                .totals {
                    float: right;
                    width: 300px;
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 8px;
                    border: 2px solid #2196f3;
                }
                .total-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 10px;
                    padding: 5px 0;
                }
                .total-final {
                    border-top: 2px solid #2196f3;
                    padding-top: 10px;
                    font-weight: bold;
                    font-size: 18px;
                    color: #2196f3;
                }
                .footer {
                    clear: both;
                    margin-top: 50px;
                    padding-top: 20px;
                    border-top: 1px solid #ddd;
                    text-align: center;
                    color: #666;
                    font-size: 12px;
                }
                .text-right { text-align: right; }
                .text-center { text-align: center; }
            </style>
        </head>
        <body>
            <!-- Header -->
            <div class="header">
                <div class="company-info">
                    <div class="company-name">${companyConfig.razonSocial}</div>
                    <div>CUIT: ${companyConfig.cuit}</div>
                    <div>${companyConfig.domicilio || ''}</div>
                    <div>Condición IVA: ${companyConfig.condicionIVA}</div>
                </div>
                <div class="invoice-info">
                    <div class="invoice-title">FACTURA ${invoiceData.tipo}</div>
                    <div class="invoice-number">N° ${invoiceData.numeroFactura}</div>
                    <div>Fecha: ${invoiceData.fechaEmision}</div>
                    ${!invoiceData.testing ? `<div>CAE: ${invoiceData.cae}</div>` : ''}
                </div>
            </div>

            ${invoiceData.testing ? `
            <!-- Testing Banner -->
            <div class="testing-banner">
                <div class="testing-text">🧪 FACTURA DE PRUEBA - SIN VALIDEZ FISCAL</div>
            </div>
            ` : ''}

            <!-- Client and Invoice Info -->
            <div class="info-section">
                <div class="info-box">
                    <h3>Datos del Cliente</h3>
                    <div><strong>Razón Social:</strong> ${invoiceData.client.name}</div>
                    ${invoiceData.client.cuit ? `<div><strong>CUIT:</strong> ${invoiceData.client.cuit}</div>` : ''}
                    ${invoiceData.client.location ? `<div><strong>Domicilio:</strong> ${invoiceData.client.location}</div>` : ''}
                    ${invoiceData.client.email ? `<div><strong>Email:</strong> ${invoiceData.client.email}</div>` : ''}
                    <div><strong>Condición IVA:</strong> ${invoiceData.client.typeOfClient || 'Consumidor Final'}</div>
                </div>
                <div class="info-box">
                    <h3>Datos de la Factura</h3>
                    <div><strong>Tipo:</strong> Factura ${invoiceData.tipo}</div>
                    <div><strong>Punto de Venta:</strong> ${companyConfig.ptoVenta}</div>
                    <div><strong>Fecha de Emisión:</strong> ${invoiceData.fechaEmision}</div>
                    ${!invoiceData.testing ? `
                    <div><strong>CAE:</strong> ${invoiceData.cae}</div>
                    <div><strong>Vto. CAE:</strong> ${invoiceData.fechaVencimientoCAE}</div>
                    ` : ''}
                    <div><strong>Forma de Pago:</strong> ${invoiceData.metodoPago}</div>
                </div>
            </div>

            <!-- Items Table -->
            <table class="items-table">
                <thead>
                    <tr>
                        <th>Descripción</th>
                        <th class="text-center">Cantidad</th>
                        <th class="text-right">Precio Unit.</th>
                        ${invoiceData.tipo === 'A' ? '<th class="text-right">IVA</th>' : ''}
                        <th class="text-right">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${invoiceData.items.map(item => {
                        const unitPrice = invoiceData.tipo === 'A' ? item.priceWithoutIVA : item.priceWithIVA;
                        const subtotal = unitPrice * item.quantity;
                        const ivaAmount = invoiceData.tipo === 'A' ? (item.priceWithIVA - item.priceWithoutIVA) * item.quantity : 0;
                        
                        return `
                        <tr>
                            <td>${item.name}</td>
                            <td class="text-center">${item.quantity}</td>
                            <td class="text-right">$${unitPrice.toFixed(2)}</td>
                            ${invoiceData.tipo === 'A' ? `<td class="text-right">$${ivaAmount.toFixed(2)}</td>` : ''}
                            <td class="text-right">$${subtotal.toFixed(2)}</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>

            <!-- Totals -->
            <div class="totals">
                ${invoiceData.tipo === 'A' ? `
                <div class="total-row">
                    <span>Subtotal:</span>
                    <span>$${invoiceData.subtotal.toFixed(2)}</span>
                </div>
                <div class="total-row">
                    <span>IVA (21%):</span>
                    <span>$${invoiceData.iva.toFixed(2)}</span>
                </div>
                ` : ''}
                <div class="total-row total-final">
                    <span>TOTAL:</span>
                    <span>$${invoiceData.total.toFixed(2)}</span>
                </div>
            </div>

            <!-- Footer -->
            <div class="footer">
                ${invoiceData.testing 
                    ? '💡 Esta es una factura de prueba generada para testing del sistema'
                    : '💡 Esta factura ha sido generada y registrada oficialmente en AFIP'
                }
                <br>
                Generado el ${new Date().toLocaleString('es-AR')}
            </div>
        </body>
        </html>
        `;

        await page.setContent(htmlContent);
        
        // Configurar el PDF
        const pdfOptions = {
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20px',
                right: '20px',
                bottom: '20px',
                left: '20px'
            }
        };

        // Generar nombre del archivo
        const fileName = `factura_${invoiceData.numeroFactura}_${Date.now()}.pdf`;
        const filePath = path.join('./invoices', fileName);

        // Generar PDF
        await page.pdf({
            path: filePath,
            ...pdfOptions
        });

        console.log('✅ PDF generado:', filePath);

        return {
            fileName: fileName,
            filePath: filePath,
            relativePath: `/invoices/${fileName}`
        };

    } finally {
        await browser.close();
    }
};


   
       
       

      