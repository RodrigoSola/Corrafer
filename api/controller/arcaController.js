import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Invoice from "../../models/invoiceModel.js";
import AFIPClient from "../services/afipClient.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ CONFIGURACIÓN UNIFICADA DE DIRECTORIO
const PDF_DIR = path.resolve(process.cwd(), "invoices");

const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 Directorio creado: ${dirPath}`);
  }
};

ensureDirectoryExists(PDF_DIR);
console.log("📂 Directorio PDF unificado:", PDF_DIR);

// Configuración de empresa
export const companyConfig = {
  cuit: process.env.COMPANY_CUIT || "20292615834",
  razonSocial: process.env.COMPANY_NAME || "CORRAFER",
  ptoVenta: process.env.PUNTO_VENTA || "0001",

  afip: {
    environment: process.env.AFIP_ENV || "testing", // 'testing' o 'production'
    cuitRepresentante: process.env.AFIP_CUIT_REP,

    // Certificados y claves
    certificatePath:
      process.env.AFIP_CERT_PATH || "../services/certificates/certificate.crt",
    privateKeyPath:
      process.env.AFIP_KEY_PATH || "../services/certificates/private.key",

    // URLs AFIP
    wsaaUrl:
      process.env.AFIP_ENV === "production"
        ? "https://wsaa.afip.gov.ar/ws/services/LoginCms"
        : "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",

    wsfeUrl:
      process.env.AFIP_ENV === "production"
        ? "https://servicios1.afip.gov.ar/wsfev1/service.asmx"
        : "https://wswhomo.afip.gov.ar/wsfev1/service.asmx",
  },

  domicilio: process.env.COMPANY_ADDRESS || "Calle Falsa 123",
  condicionIVA: "Responsable Inscripto",
  fechaInicioActividades: "01/01/2020",
};

// ✅ FUNCIÓN PRINCIPAL CORREGIDA - generateARCAInvoice
export const generateARCAInvoice = async (req, res) => {
  try {
    console.log("🏛️ generateARCAInvoice - MODO REAL iniciado...");
    console.log("📊 Body recibido:", JSON.stringify(req.body, null, 2));

     const isProduction = process.env.AFIP_ENV === 'production';
    const forceTesting = req.body.testing === true;

      if (isProduction && !forceTesting) {
      console.log('🏛️ MODO PRODUCCIÓN: Generando factura OFICIAL REAL');
      console.log('⚠️  ESTA FACTURA TENDRÁ VALIDEZ FISCAL');

         // Validaciones adicionales para producción
      if (!process.env.COMPANY_CUIT || !process.env.AFIP_CERT_PATH) {
        return res.status(500).json({
          success: false,
          error: 'Configuración AFIP incompleta para producción',
          type: 'production_config_error'
        });
      }
    } else if (forceTesting) {
      console.log('🧪 MODO TESTING: Factura de prueba (sin validez fiscal)');
    }
const isRealInvoice = isProduction && !forceTesting;
    // ✅ 1. VALIDAR REQUEST BODY
    if (!req.body || Object.keys(req.body).length === 0) {
      console.log("❌ Request body vacío");
      return res.status(400).json({
        success: false,
        error: "Request body is empty",
        type: "validation_error",
        details: "Se requieren datos de facturación",
      });
    }

    // ✅ 2. EXTRAER Y VALIDAR DATOS CON VALORES POR DEFECTO
    const {
      client,
      cartItems = [],
      paymentMethod = "Efectivo",
      testing = process.env.AFIP_ENV === 'testing' ? true : false,
      // Campos adicionales de compatibilidad
      clientName,
      clientCuit,
      items = cartItems,
    } = req.body;

    // ✅ 3. CREAR OBJETO CLIENTE COMPLETO
    let completeClient;
    if (client) {
      completeClient = client;
    } else if (clientName) {
      // Crear cliente desde campos individuales
      completeClient = {
        name: clientName,
        cuit: clientCuit || "",
        email: "",
        location: "",
        typeOfClient: clientCuit && clientCuit !== "0" ? "RI" : "CF",
      };
    } else {
      // Cliente por defecto
      completeClient = {
        name: "Consumidor Final",
        cuit: "",
        email: "",
        location: "",
        typeOfClient: "CF",
      };
    }

    console.log("👤 Cliente procesado:", completeClient);

    // ✅ 4. VALIDAR ITEMS
    const finalItems = items.length > 0 ? items : cartItems;
    if (!finalItems || finalItems.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No hay productos en la factura",
        type: "validation_error",
        details: "Se requiere al menos un item para facturar",
      });
    }

    console.log("📦 Items procesados:", finalItems.length, "items");

    // ✅ 5. DETERMINAR TIPO DE FACTURA
    const invoiceType = determineInvoiceType(completeClient);
    console.log("📋 Tipo de factura determinado:", invoiceType);

    // ✅ 6. CALCULAR TOTALES
    let subtotal = 0;
    let ivaAmount = 0;
    let total = 0;

    if (invoiceType.type === "A") {
      // Factura A - IVA discriminado
      subtotal = finalItems.reduce((sum, item) => {
        const priceWithoutIVA =
          item.priceWithoutIVA ||
          (item.priceWithIVA || item.unitPrice || 0) / 1.21;
        return sum + priceWithoutIVA * (item.quantity || 0);
      }, 0);
      ivaAmount = subtotal * 0.21;
      total = subtotal + ivaAmount;
    } else {
      // Factura B/C - IVA incluido
      total = finalItems.reduce((sum, item) => {
        const priceWithIVA = item.priceWithIVA || item.unitPrice || 0;
        return sum + priceWithIVA * (item.quantity || 0);
      }, 0);
      subtotal = total / 1.21;
      ivaAmount = total - subtotal;
    }

    console.log("💰 Totales calculados:", { subtotal, ivaAmount, total });

    // ✅ 7. GENERAR CAE - AFIP O TESTING
    let caeData;
    let numeroComprobante;

    if (!testing) {
      console.log("🏛️ Generando factura OFICIAL con AFIP...");
      console.log("🏛️ Iniciando autenticación AFIP...");

      try {
        // ✅ VERIFICAR CERTIFICADO
        const certificatePath = path.resolve(
          companyConfig.afip.certificatePath
        );
        if (!fs.existsSync(certificatePath)) {
          console.log("❌ Certificado AFIP no encontrado:", certificatePath);
          return res.status(500).json({
            success: false,
            error: "AFIP certificate not found",
            type: "certificate_error",
            details: `Certificate file missing at: ${certificatePath}`,
            solution: "Instale el certificado AFIP en la ruta correcta",
          });
        }

        // ✅ CREAR CLIENTE AFIP
        const afipClient = new AFIPClient(companyConfig);

        // ✅ AUTENTICAR CON AFIP
        await afipClient.authenticate();
        console.log("✅ Autenticación AFIP exitosa");

        // ✅ VERIFICAR STATUS DEL SERVIDOR
        const serverStatus = await afipClient.getServerStatus();
        console.log("🖥️ Status servidor AFIP:", serverStatus);

        // ✅ OBTENER PRÓXIMO NÚMERO
        const ultimoNumero = await afipClient.getLastInvoiceNumber(
          invoiceType.code,
          companyConfig.ptoVenta
        );
        numeroComprobante = ultimoNumero + 1;
        console.log("📊 Próximo número de factura:", numeroComprobante);

        // ✅ PREPARAR DATOS PARA AFIP
        const afipInvoiceData = {
          numeroFactura: `${companyConfig.ptoVenta}-${numeroComprobante.toString().padStart(8, "0")}`,
          tipo: invoiceType.type,
          codigo: invoiceType.code,
          numeroComprobante: numeroComprobante,
          fechaEmision: new Date(),
          client: completeClient,
          items: finalItems,
          subtotal: subtotal,
          iva: ivaAmount,
          total: total,
        };

        // ✅ SOLICITAR CAE REAL A AFIP
        caeData = await afipClient.solicitarCAE(afipInvoiceData);
        console.log("✅ CAE obtenido exitosamente:", caeData.cae);
      } catch (afipError) {
        console.error("❌ Error con AFIP:", afipError);

        return res.status(500).json({
          success: false,
          error: `Error AFIP: ${afipError.message}`,
          type: "afip_error",
          details: {
            environment: companyConfig.afip.environment,
            cuit: companyConfig.cuit,
            puntoVenta: companyConfig.ptoVenta,
            tipoFactura: invoiceType.type,
            certificatePath: companyConfig.afip.certificatePath,
          },
        });
      }
    } else {
      // ✅ MODO TESTING
      console.log("🧪 Generando factura de PRUEBA...");
      numeroComprobante = Date.now().toString().slice(-8);
      caeData = {
        cae: `TEST${Math.random().toString().slice(2, 14)}`,
        fechaVencimientoCAE: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
        numeroComprobante: numeroComprobante,
        resultado: "A",
        observaciones: "Factura de prueba",
        fechaProceso: new Date().toISOString().slice(0, 10),
      };
    }

    // ✅ 8. CREAR FACTURA EN BASE DE DATOS
    const numeroFacturaCompleto = `${companyConfig.ptoVenta}-${numeroComprobante.toString().padStart(8, "0")}`;

    const newInvoice = new Invoice({
      numeroFactura: numeroFacturaCompleto,
      tipo: invoiceType.type,
      descripcionTipo: testing
        ? `${invoiceType.description} (Testing)`
        : invoiceType.description,
      cae: caeData.cae,
      fechaVencimientoCAE: new Date(caeData.fechaVencimientoCAE),
      fechaEmision: new Date(),
      cliente: completeClient.name,
      clientData: completeClient,
      items: finalItems,
      subtotal: subtotal,
      iva: ivaAmount,
      total: total,
      metodoPago: paymentMethod,
      testing: testing,
      status: "completed",
      companyConfig: companyConfig,

      // ✅ DATOS AFIP REALES (solo para facturas oficiales)
      afipData: !testing
        ? {
            numeroComprobante: caeData.numeroComprobante,
            codigoTipoComprobante: invoiceType.code,
            resultado: caeData.resultado,
            observaciones: caeData.observaciones,
            fechaProceso: caeData.fechaProceso,
            puntoVenta: companyConfig.ptoVenta,
            tipoComprobante: invoiceType.type,
          }
        : null,
    });

    const savedInvoice = await newInvoice.save();
    console.log("✅ Factura guardada en BD:", savedInvoice.numeroFactura);

    // ✅ 9. GENERAR PDF
    try {
      const invoiceDataForPDF = {
        numeroFactura: savedInvoice.numeroFactura,
        tipo: savedInvoice.tipo,
        descripcionTipo: savedInvoice.descripcionTipo,
        cae: savedInvoice.cae,
        fechaVencimientoCAE: savedInvoice.fechaVencimientoCAE
          ? new Date(savedInvoice.fechaVencimientoCAE).toLocaleDateString(
              "es-AR"
            )
          : null,
        fechaEmision: new Date(savedInvoice.fechaEmision).toLocaleDateString(
          "es-AR"
        ),
        cliente: savedInvoice.cliente,
        clientData: savedInvoice.clientData,
        items: savedInvoice.items,
        subtotal: savedInvoice.subtotal,
        iva: savedInvoice.iva,
        total: savedInvoice.total,
        metodoPago: savedInvoice.metodoPago,
        testing: savedInvoice.testing,
      };

      const pdfResult = await generateInvoicePDF(
        invoiceDataForPDF,
        companyConfig
      );
      savedInvoice.pdfFileName = pdfResult.fileName;
      savedInvoice.pdfPath = pdfResult.filePath;
      await savedInvoice.save();

      console.log("✅ PDF generado:", pdfResult.fileName);

      // ✅ 10. RESPUESTA EXITOSA
      return res.json({
        success: true,
        message: testing
          ? "Factura de prueba generada exitosamente"
          : "Factura OFICIAL generada con AFIP",
        numeroFactura: savedInvoice.numeroFactura,
        cae: savedInvoice.cae,
        fechaVencimientoCAE: savedInvoice.fechaVencimientoCAE,
        tipo: savedInvoice.tipo,
        cliente: savedInvoice.cliente,
        total: savedInvoice.total,
        testing: savedInvoice.testing,
        status: savedInvoice.status,
        pdfFileName: pdfResult.fileName,
        viewUrl: `/api/arca/invoices/${savedInvoice._id}/pdf`,
        downloadUrl: `/api/arca/invoices/${savedInvoice._id}/download`,

        // ✅ DATOS AFIP ADICIONALES
        afipData: savedInvoice.afipData,

        invoice: {
          id: savedInvoice._id,
          numeroFactura: savedInvoice.numeroFactura,
          tipo: savedInvoice.tipo,
          cae: savedInvoice.cae,
          fechaVencimientoCAE: savedInvoice.fechaVencimientoCAE,
          clientData: savedInvoice.clientData,
          items: savedInvoice.items,
          subtotal: savedInvoice.subtotal,
          iva: savedInvoice.iva,
          total: savedInvoice.total,
          testing: savedInvoice.testing,
          status: savedInvoice.status,
          afipData: savedInvoice.afipData,
        },
      });
    } catch (pdfError) {
      console.error("❌ Error generando PDF (factura ya creada):", pdfError);

      // Marcar como completado con error de PDF
      savedInvoice.status = "completed_pdf_error";
      savedInvoice.notes = `Error PDF: ${pdfError.message}`;
      await savedInvoice.save();

      return res.json({
        success: true,
        warning: "Factura creada exitosamente pero PDF no disponible",
        message: "Factura registrada, PDF pendiente de regeneración",
        numeroFactura: savedInvoice.numeroFactura,
        cae: savedInvoice.cae,
        invoice: {
          id: savedInvoice._id,
          numeroFactura: savedInvoice.numeroFactura,
          cae: savedInvoice.cae,
          total: savedInvoice.total,
          status: savedInvoice.status,
          testing: savedInvoice.testing,
        },
      });
    }
  } catch (error) {
    console.error("❌ Error general en generateARCAInvoice:", error);

    // ✅ LOG DE ERROR DETALLADO
    const errorLog = {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      environment: process.env.NODE_ENV || "development",
      endpoint: "/invoices",
      method: "POST",
      testing: req.body?.testing || false,
      clientName: req.body?.client?.name || req.body?.clientName,
      total: req.body?.total,
      success: false,
      error: error.message,
      stack: error.stack,
    };

    console.log("❌ Error en facturación:", errorLog);

    res.status(500).json({
      success: false,
      error: error.message || "Error interno del servidor",
      type: "general_error",
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

// ✅ Función para determinar tipo de factura
const determineInvoiceType = (client) => {
  if (
    !client ||
    !client.cuit ||
    client.cuit === "0" ||
    client.typeOfClient === "CF"
  ) {
    return { type: "C", code: 11, description: "Factura C" };
  }

  switch (client.typeOfClient?.toUpperCase()) {
    case "RI":
    case "RESPONSABLE_INSCRIPTO":
      return { type: "A", code: 1, description: "Factura A" };
    case "EX":
    case "EXENTO":
      return { type: "A", code: 1, description: "Factura A (Exento)" };
    case "MONOTRIBUTO":
      return { type: "B", code: 6, description: "Factura B" };
    default:
      return { type: "C", code: 11, description: "Factura C" };
  }
};

// ✅ GENERAR PDF (función optimizada)
const generateInvoicePDF = async (invoiceData, companyConfig) => {
  console.log("🔧 Generando PDF para:", invoiceData.numeroFactura);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-web-security",
    ],
  });

  try {
    const page = await browser.newPage();

    // Asegurar datos del cliente
    const clientData = invoiceData.clientData || invoiceData.client || {};
    const clientName =
      clientData.name || invoiceData.cliente || "Cliente no especificado";

    // HTML mejorado (usar el HTML completo de tu código existente)
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Factura ${invoiceData.numeroFactura}</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body {
                    font-family: 'Arial', sans-serif;
                    color: #333;
                    background: white;
                    font-size: 12px;
                    line-height: 1.4;
                }
                .page {
                    max-width: 210mm;
                    margin: 0 auto;
                    padding: 20mm;
                    background: white;
                    min-height: 297mm;
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    border-bottom: 3px solid #2196f3;
                    padding-bottom: 20px;
                    margin-bottom: 25px;
                }
                .company-name {
                    font-size: 24px;
                    font-weight: bold;
                    color: #2196f3;
                    margin-bottom: 12px;
                }
                .invoice-type {
                    background: #2196f3;
                    color: white;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-size: 16px;
                    font-weight: bold;
                    margin-bottom: 12px;
                    display: inline-block;
                }
                ${
                  invoiceData.testing
                    ? `
                .testing-banner {
                    background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
                    border: 2px solid #ffc107;
                    border-radius: 10px;
                    padding: 15px;
                    margin-bottom: 25px;
                    text-align: center;
                }
                .testing-text {
                    color: #856404;
                    font-weight: bold;
                    font-size: 16px;
                }
                `
                    : ""
                }
                .items-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 11px;
                    margin-bottom: 20px;
                }
                .items-table th {
                    background: #2196f3;
                    color: white;
                    padding: 12px 8px;
                    text-align: left;
                    font-weight: bold;
                }
                .items-table td {
                    padding: 10px 8px;
                    border-bottom: 1px solid #dee2e6;
                }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .totals-box {
                    background: #f8f9fa;
                    border: 2px solid #2196f3;
                    border-radius: 12px;
                    padding: 20px;
                    min-width: 300px;
                    margin-left: auto;
                }
                .total-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                }
                .total-final {
                    border-top: 2px solid #2196f3;
                    font-weight: bold;
                    font-size: 16px;
                    color: #2196f3;
                }
            </style>
        </head>
        <body>
            <div class="page">
                <div class="header">
                    <div>
                        <div class="company-name">${companyConfig.razonSocial}</div>
                        <div>CUIT: ${companyConfig.cuit}</div>
                        <div>${companyConfig.domicilio}</div>
                    </div>
                    <div>
                        <div class="invoice-type">FACTURA ${invoiceData.tipo}</div>
                        <div><strong>${invoiceData.numeroFactura}</strong></div>
                        <div>Fecha: ${invoiceData.fechaEmision}</div>
                        ${!invoiceData.testing && invoiceData.cae ? `<div>CAE: ${invoiceData.cae}</div>` : ""}
                    </div>
                </div>

                ${
                  invoiceData.testing
                    ? `
                <div class="testing-banner">
                    <div class="testing-text">🧪 FACTURA DE PRUEBA - SIN VALIDEZ FISCAL</div>
                </div>
                `
                    : ""
                }

                <div style="margin-bottom: 25px;">
                    <h3>Cliente: ${clientName}</h3>
                    ${clientData.cuit ? `<div>CUIT: ${clientData.cuit}</div>` : ""}
                    ${clientData.location ? `<div>Domicilio: ${clientData.location}</div>` : ""}
                </div>

                <table class="items-table">
                    <thead>
                        <tr>
                            <th>Descripción</th>
                            <th class="text-center">Cant.</th>
                            <th class="text-right">P. Unit.</th>
                            <th class="text-right">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(invoiceData.items || [])
                          .map((item) => {
                            const unitPrice =
                              invoiceData.tipo === "A"
                                ? item.priceWithoutIVA || 0
                                : item.priceWithIVA || item.unitPrice || 0;
                            const quantity = item.quantity || 0;
                            const subtotal = unitPrice * quantity;

                            return `
                            <tr>
                                <td>${item.name || "Producto"}</td>
                                <td class="text-center">${quantity}</td>
                                <td class="text-right">$${unitPrice.toFixed(2)}</td>
                                <td class="text-right">$${subtotal.toFixed(2)}</td>
                            </tr>
                            `;
                          })
                          .join("")}
                    </tbody>
                </table>

                <div class="totals-box">
                    ${
                      invoiceData.tipo === "A"
                        ? `
                    <div class="total-row">
                        <span>Subtotal:</span>
                        <span>$${(invoiceData.subtotal || 0).toFixed(2)}</span>
                    </div>
                    <div class="total-row">
                        <span>IVA (21%):</span>
                        <span>$${(invoiceData.iva || 0).toFixed(2)}</span>
                    </div>
                    `
                        : ""
                    }
                    <div class="total-row total-final">
                        <span>TOTAL:</span>
                        <span>$${(invoiceData.total || 0).toFixed(2)}</span>
                    </div>
                </div>

                <div style="margin-top: 40px; text-align: center; font-size: 10px; color: #666;">
                    ${
                      invoiceData.testing
                        ? "💡 Factura de prueba - Sin validez fiscal"
                        : "💡 Factura generada oficialmente"
                    }
                    <br>Generado: ${new Date().toLocaleString("es-AR")}
                </div>
            </div>
        </body>
        </html>
        `;

    await page.setContent(htmlContent);

    // Generar PDF
    const timestamp = Date.now();
    const fileName = `factura_${invoiceData.numeroFactura.replace(/[^a-zA-Z0-9]/g, "_")}_${timestamp}.pdf`;
    const filePath = path.join(PDF_DIR, fileName);

    await page.pdf({
      path: filePath,
      format: "A4",
      printBackground: true,
      margin: { top: "15mm", right: "10mm", bottom: "15mm", left: "10mm" },
    });

    // Verificar archivo
    if (!fs.existsSync(filePath)) {
      throw new Error("PDF no fue creado");
    }

    const fileStats = fs.statSync(filePath);
    if (fileStats.size === 0) {
      throw new Error("PDF está vacío");
    }

    console.log("✅ PDF generado exitosamente:", fileName);

    return {
      fileName: fileName,
      filePath: filePath,
      size: fileStats.size,
      relativePath: `/invoices/${fileName}`,
      viewUrl: `/invoices/${fileName}`,
      downloadUrl: `/invoices/download/${fileName}`,
    };
  } finally {
    await browser.close();
  }
};

// ✅ EXPORTAR TODAS LAS FUNCIONES EXISTENTES
export const getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("🔍 Obteniendo factura ID:", id);

    const invoice = await Invoice.findById(id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: "Factura no encontrada",
      });
    }

    // Preparar datos completos
    const clientData = invoice.clientData ||
      invoice.client || {
        name: invoice.cliente || "Cliente no especificado",
        cuit: "",
        email: invoice.clientEmail || "",
        location: "",
        typeOfClient: "CF",
      };

    const response = {
      success: true,
      invoice: {
        id: invoice._id,
        numeroFactura: invoice.numeroFactura,
        tipo: invoice.tipo,
        descripcionTipo: invoice.descripcionTipo,
        cae: invoice.cae,
        fechaVencimientoCAE: invoice.fechaVencimientoCAE,
        fechaEmision: invoice.fechaEmision,
        cliente: invoice.cliente,
        clientData: clientData,
        items: invoice.items || [],
        subtotal: invoice.subtotal || 0,
        iva: invoice.iva || 0,
        total: invoice.total || 0,
        metodoPago: invoice.metodoPago || "Efectivo",
        testing: invoice.testing || false,
        status: invoice.status,
        pdfFileName: invoice.pdfFileName,
        viewUrl: invoice.pdfFileName
          ? `/api/arca/invoices/${invoice._id}/pdf`
          : null,
        downloadUrl: invoice.pdfFileName
          ? `/api/arca/invoices/${invoice._id}/download`
          : null,
        companyConfig: invoice.companyConfig || companyConfig,
        afipData: invoice.afipData,
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt,
      },
    };

    console.log("✅ Factura obtenida exitosamente");
    res.json(response);
  } catch (error) {
    console.error("❌ Error obteniendo factura:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const getInvoicePDF = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("📄 Sirviendo PDF para factura ID:", id);

    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: "Factura no encontrada",
      });
    }

    // Verificar si existe el PDF
    const pdfPath = invoice.pdfFileName
      ? path.join(PDF_DIR, invoice.pdfFileName)
      : null;

    if (!invoice.pdfFileName || !fs.existsSync(pdfPath)) {
      console.log("🔧 Regenerando PDF...");

      // Datos para regenerar PDF
      const invoiceDataForPDF = {
        numeroFactura: invoice.numeroFactura,
        tipo: invoice.tipo,
        descripcionTipo: invoice.descripcionTipo,
        cae: invoice.cae,
        fechaVencimientoCAE: invoice.fechaVencimientoCAE
          ? new Date(invoice.fechaVencimientoCAE).toLocaleDateString("es-AR")
          : null,
        fechaEmision: new Date(invoice.fechaEmision).toLocaleDateString(
          "es-AR"
        ),
        cliente: invoice.cliente,
        clientData: invoice.clientData ||
          invoice.client || { name: invoice.cliente },
        items: invoice.items || [],
        subtotal: invoice.subtotal || 0,
        iva: invoice.iva || 0,
        total: invoice.total || 0,
        metodoPago: invoice.metodoPago || "Efectivo",
        testing: invoice.testing || false,
      };

      try {
        const pdfResult = await generateInvoicePDF(
          invoiceDataForPDF,
          invoice.companyConfig || companyConfig
        );

        // Actualizar BD
        invoice.pdfFileName = pdfResult.fileName;
        invoice.pdfPath = pdfResult.filePath;
        invoice.status = "completed";
        await invoice.save();

        console.log("✅ PDF regenerado exitosamente");

        // Servir PDF recién generado
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `inline; filename="${pdfResult.fileName}"`
        );

        const fileStream = fs.createReadStream(pdfResult.filePath);
        fileStream.pipe(res);
        return;
      } catch (pdfError) {
        console.error("❌ Error regenerando PDF:", pdfError);
        return res.status(500).json({
          success: false,
          error: "Error regenerando PDF: " + pdfError.message,
        });
      }
    }

    // Servir PDF existente
    console.log("✅ Sirviendo PDF existente:", pdfPath);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${invoice.pdfFileName}"`
    );
    res.setHeader("Cache-Control", "public, max-age=3600");

    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("❌ Error sirviendo PDF:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const getInvoices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = "fechaEmision",
      order = "desc",
      testing,
      status,
      cliente,
    } = req.query;

    console.log("📊 getInvoices - Parámetros:", req.query);

    // Construir filtro
    const filter = {};
    if (testing !== undefined && testing !== "") {
      filter.testing = testing === "true";
    }
    if (status && status !== "") {
      filter.status = status;
    }
    if (cliente && cliente.trim() !== "") {
      filter.cliente = { $regex: cliente.trim(), $options: "i" };
    }

    // Configurar ordenamiento
    const sortOptions = {};
    sortOptions[sortBy] = order === "desc" ? -1 : 1;

    // Ejecutar consulta con paginación
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .select("-__v")
        .lean(),
      Invoice.countDocuments(filter),
    ]);

    console.log(`✅ Encontradas ${invoices.length} facturas de ${total} total`);

    // Formatear respuesta
    const formattedInvoices = invoices.map((invoice) => ({
      id: invoice._id,
      numeroFactura: invoice.numeroFactura,
      tipo: invoice.tipo,
      descripcionTipo: invoice.descripcionTipo,
      cae: invoice.cae,
      cliente: invoice.clientData?.cliente, // Use clientData.cliente instead of invoice.cliente
      clientData: invoice.clientData || invoice.client,
      subtotal: invoice.subtotal,
      iva: invoice.iva,
      total: invoice.total,
      items: invoice.items,
      metodoPago: invoice.metodoPago,
      fechaEmision: invoice.fechaEmision,
      fechaEmisionFormatted: new Date(invoice.fechaEmision).toLocaleDateString(
        "es-AR"
      ),
      testing: invoice.testing,
      status: invoice.status,
      pdfFileName: invoice.pdfFileName,
      viewUrl: invoice.pdfFileName
        ? `/api/arca/invoices/${invoice._id}/pdf`
        : null,
      downloadUrl: invoice.pdfFileName
        ? `/api/arca/invoices/${invoice._id}/download`
        : null,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    }));

    const response = {
      success: true,
      message: `${total} facturas encontradas`,
      invoices: formattedInvoices,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalInvoices: total,
        hasNext: skip + parseInt(limit) < total,
        hasPrev: parseInt(page) > 1,
        limit: parseInt(limit),
      },
    };

    res.json(response);
  } catch (error) {
    console.error("❌ Error obteniendo facturas:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const getCompanyConfig = async (req, res) => {
  try {
    const config = { ...companyConfig };
    // No enviar datos sensibles
    delete config.password;
    if (config.afip) {
      delete config.afip.privateKeyPath;
    }

    res.json({
      success: true,
      config: config,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const updateCompanyConfig = async (req, res) => {
  try {
    const {
      cuit,
      razonSocial,
      ptoVenta,
      domicilio,
      condicionIVA,
      afipEnvironment,
    } = req.body;

    // Actualizar configuración
    if (cuit) companyConfig.cuit = cuit;
    if (razonSocial) companyConfig.razonSocial = razonSocial;
    if (ptoVenta) companyConfig.ptoVenta = ptoVenta;
    if (domicilio) companyConfig.domicilio = domicilio;
    if (condicionIVA) companyConfig.condicionIVA = condicionIVA;
    if (afipEnvironment && companyConfig.afip) {
      companyConfig.afip.environment = afipEnvironment;
    }

    console.log("⚙️ Configuración actualizada");

    res.json({
      success: true,
      message: "Configuración actualizada correctamente",
      config: {
        cuit: companyConfig.cuit,
        razonSocial: companyConfig.razonSocial,
        ptoVenta: companyConfig.ptoVenta,
        domicilio: companyConfig.domicilio,
        condicionIVA: companyConfig.condicionIVA,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: "Factura no encontrada",
      });
    }

    // Si es factura oficial, solo marcar como cancelada
    if (!invoice.testing) {
      invoice.status = "cancelled";
      await invoice.save();

      return res.json({
        success: true,
        message: "Factura oficial marcada como cancelada",
      });
    }

    // Para facturas de prueba, eliminar completamente
    if (invoice.pdfFileName) {
      const pdfPath = path.join(PDF_DIR, invoice.pdfFileName);
      try {
        if (fs.existsSync(pdfPath)) {
          fs.unlinkSync(pdfPath);
          console.log("🗑️ PDF eliminado:", pdfPath);
        }
      } catch (error) {
        console.warn("⚠️ Error eliminando PDF:", error.message);
      }
    }

    await Invoice.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Factura de prueba eliminada correctamente",
    });
  } catch (error) {
    console.error("❌ Error eliminando factura:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ✅ FUNCIÓN PARA DESCARGAR PDF
export const downloadInvoicePDF = async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: "Factura no encontrada",
      });
    }

    if (!invoice.pdfFileName) {
      return res.status(404).json({
        success: false,
        error: "PDF no disponible para esta factura",
      });
    }

    const pdfPath = path.join(PDF_DIR, invoice.pdfFileName);

    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({
        success: false,
        error: "Archivo PDF no encontrado",
      });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${invoice.pdfFileName}"`
    );

    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("❌ Error descargando PDF:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ✅ FUNCIÓN PARA OBTENER ESTADÍSTICAS
export const getInvoiceStats = async (req, res) => {
  try {
    const stats = await Invoice.aggregate([
      {
        $group: {
          _id: null,
          totalInvoices: { $sum: 1 },
          totalAmount: { $sum: "$total" },
          officialCount: {
            $sum: { $cond: [{ $eq: ["$testing", false] }, 1, 0] },
          },
          testingCount: {
            $sum: { $cond: [{ $eq: ["$testing", true] }, 1, 0] },
          },
          completedCount: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          avgAmount: { $avg: "$total" },
        },
      },
    ]);

    const monthlyStats = await Invoice.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$fechaEmision" },
            month: { $month: "$fechaEmision" },
          },
          count: { $sum: 1 },
          total: { $sum: "$total" },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $limit: 12 },
    ]);

    res.json({
      success: true,
      stats: stats[0] || {
        totalInvoices: 0,
        totalAmount: 0,
        officialCount: 0,
        testingCount: 0,
        completedCount: 0,
        avgAmount: 0,
      },
      monthlyStats: monthlyStats,
    });
  } catch (error) {
    console.error("❌ Error obteniendo estadísticas:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
