// generateARCAInvoice - Correcciones para producción real


const determineInvoiceType = (client) => {
  console.log('🔍 Determinando tipo de factura para cliente:', client);
  
  if (!client || !client.cuit || client.cuit === "0" || client.typeOfClient === 'CF') {
    return { 
      type: 'C', 
      description: 'C (Consumidor Final)',
      code: 11 // Código AFIP para Factura C
    };
  }

  switch (client.typeOfClient?.toUpperCase()) {
    case 'RI':
    case 'RESPONSABLE_INSCRIPTO':
      return { 
        type: 'A', 
        description: 'A (Discrimina IVA)',
        code: 1 // Código AFIP para Factura A
      };
    case 'EX':
    case 'EXENTO':
      return { 
        type: 'A', 
        description: 'A (Exento)',
        code: 1 // Código AFIP para Factura A
      };
    case 'MONOTRIBUTO':
      return { 
        type: 'B', 
        description: 'B (No discrimina IVA)',
        code: 6 // Código AFIP para Factura B
      };
    default:
      return { 
        type: 'C', 
        description: 'C (Consumidor Final)',
        code: 11 // Código AFIP para Factura C
      };
  }
};

// ✅ FUNCIÓN PARA VALIDAR Y FORMATEAR FECHAS
const validateAndFormatDate = (date, fieldName = 'fecha') => {
  if (!date) {
    console.warn(`⚠️ ${fieldName} is null or undefined`);
    return null;
  }

  // Si ya es un objeto Date válido
  if (date instanceof Date && !isNaN(date.getTime())) {
    return date.toISOString();
  }

  // Si es un string, intentar parsearlo
  if (typeof date === 'string') {
    const parsedDate = new Date(date);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString();
    }
  }

  // Si es un timestamp numérico
  if (typeof date === 'number' && !isNaN(date)) {
    return new Date(date).toISOString();
  }

  console.error(`❌ Invalid date format for ${fieldName}:`, date, typeof date);
  return null;
};
export const generateARCAInvoice = async (req, res) => {
    try {
        console.log('🏛️ generateARCAInvoice - Iniciando...');
        console.log('📊 Body recibido:', JSON.stringify(req.body, null, 2));
        
        // ✅ 1. VALIDACIONES BÁSICAS
        if (!req.body || Object.keys(req.body).length === 0) {
            console.log('❌ Request body vacío');
            return res.status(400).json({
                success: false,
                error: 'Request body is empty',
                type: 'validation_error'
            });
        }

        const {
            client,
            cartItems = [],
            paymentMethod = 'Efectivo',
            testing = false,
            clientName,
            clientCuit,
            items = cartItems
        } = req.body;

        // ✅ 2. OBTENER CONFIGURACIÓN DE LA EMPRESA
        let companyConfig;
        try {
            companyConfig = await getCompanyConfig(); // Debes implementar esta función
            console.log('✅ Configuración de empresa obtenida');
        } catch (configError) {
            console.error('❌ Error obteniendo configuración de empresa:', configError);
            return res.status(500).json({
                success: false,
                error: 'Error de configuración de empresa',
                details: configError.message,
                type: 'config_error'
            });
        }

        // ✅ 3. PROCESAR CLIENTE
        let completeClient;
        if (client && client.name) {
            completeClient = client;
        } else if (clientName) {
            completeClient = {
                name: clientName,
                cuit: clientCuit || '',
                typeOfClient: clientCuit && clientCuit !== '0' ? 'RI' : 'CF'
            };
        } else {
            completeClient = {
                name: 'Consumidor Final',
                cuit: '',
                typeOfClient: 'CF'
            };
        }

        console.log('👤 Cliente procesado:', completeClient);

        // ✅ 4. VALIDAR ITEMS
        const finalItems = items.length > 0 ? items : cartItems;
        if (!finalItems || finalItems.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No hay productos en la factura',
                type: 'validation_error'
            });
        }

        console.log('📦 Items a facturar:', finalItems.length);

        // ✅ 5. DETERMINAR TIPO DE FACTURA (ahora sí está definida)
        const invoiceType = determineInvoiceType(completeClient);
        console.log('📋 Tipo de factura determinado:', invoiceType);

        // ✅ 6. CALCULAR TOTALES
        let subtotal = 0;
        let ivaAmount = 0;
        let total = 0;

        try {
            if (invoiceType.type === 'A') {
                // Factura A: discrimina IVA
                subtotal = finalItems.reduce((sum, item) => {
                    const priceWithoutIVA = item.priceWithoutIVA || (item.priceWithIVA || item.unitPrice || 0) / 1.21;
                    return sum + (priceWithoutIVA * (item.quantity || 0));
                }, 0);
                ivaAmount = subtotal * 0.21;
                total = subtotal + ivaAmount;
            } else {
                // Factura B y C: no discriminan IVA
                total = finalItems.reduce((sum, item) => {
                    const priceWithIVA = item.priceWithIVA || item.unitPrice || 0;
                    return sum + (priceWithIVA * (item.quantity || 0));
                }, 0);
                subtotal = total / 1.21;
                ivaAmount = total - subtotal;
            }

            // Redondear a 2 decimales
            subtotal = Math.round(subtotal * 100) / 100;
            ivaAmount = Math.round(ivaAmount * 100) / 100;
            total = Math.round(total * 100) / 100;

            console.log('💰 Totales calculados:', { subtotal, ivaAmount, total });
        } catch (calculationError) {
            console.error('❌ Error calculando totales:', calculationError);
            return res.status(400).json({
                success: false,
                error: 'Error en cálculo de totales',
                details: calculationError.message,
                type: 'calculation_error'
            });
        }

        // ✅ 7. GENERAR FACTURA (REAL O TESTING)
        let caeData;
        let numeroComprobante;

        if (!testing && companyConfig.afip && companyConfig.afip.environment === 'production') {
            console.log('🏛️ Generando factura OFICIAL con AFIP...');
            
            try {
                // Crear cliente AFIP
                const afipClient = new AFIPClient(companyConfig);
                
                // Autenticar
                await afipClient.authenticate();
                console.log('✅ Autenticación AFIP exitosa');

                // Obtener próximo número
                const ultimoNumero = await afipClient.getLastInvoiceNumber(
                    invoiceType.code, 
                    companyConfig.ptoVenta
                );
                numeroComprobante = ultimoNumero + 1;
                console.log('📊 Próximo número de factura:', numeroComprobante);

                // Preparar datos para AFIP
                const afipInvoiceData = {
                    numeroFactura: `${companyConfig.ptoVenta}-${numeroComprobante.toString().padStart(8, '0')}`,
                    tipo: invoiceType.type,
                    codigo: invoiceType.code,
                    numeroComprobante: numeroComprobante,
                    fechaEmision: new Date(),
                    client: completeClient,
                    items: finalItems,
                    subtotal: subtotal,
                    iva: ivaAmount,
                    total: total
                };

                // Solicitar CAE
                caeData = await afipClient.solicitarCAE(afipInvoiceData);
                console.log('✅ CAE obtenido exitosamente:', caeData.cae);

            } catch (afipError) {
                console.error('❌ Error con AFIP:', afipError);
                
                return res.status(500).json({
                    success: false,
                    error: `Error AFIP: ${afipError.message}`,
                    type: 'afip_error',
                    details: {
                        environment: companyConfig.afip?.environment || 'not_configured',
                        cuit: companyConfig.cuit,
                        puntoVenta: companyConfig.ptoVenta,
                        tipoFactura: invoiceType.type,
                        timestamp: new Date().toISOString()
                    }
                });
            }
        } else {
            // ✅ MODO TESTING
            console.log('🧪 Generando factura de PRUEBA...');
            numeroComprobante = Date.now().toString().slice(-8);
            caeData = {
                cae: `TEST${Math.random().toString().slice(2, 14)}`,
                fechaVencimientoCAE: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                numeroComprobante: numeroComprobante,
                resultado: 'A',
                observaciones: 'Factura de prueba - No válida fiscalmente',
                fechaProceso: new Date().toISOString().slice(0, 10)
            };
        }

        // ✅ 8. CREAR FACTURA EN BASE DE DATOS
        const numeroFacturaCompleto = `${companyConfig.ptoVenta || '0001'}-${numeroComprobante.toString().padStart(8, '0')}`;
        
        try {
            const newInvoice = new Invoice({
                numeroFactura: numeroFacturaCompleto,
                tipo: invoiceType.type,
                descripcionTipo: testing ? `${invoiceType.description} (Testing)` : invoiceType.description,
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
                status: 'completed',
                companyConfig: companyConfig,
                
                // Datos AFIP (solo si es producción)
                afipData: !testing ? {
                    numeroComprobante: caeData.numeroComprobante,
                    codigoTipoComprobante: invoiceType.code,
                    resultado: caeData.resultado,
                    observaciones: caeData.observaciones,
                    fechaProceso: caeData.fechaProceso,
                    puntoVenta: companyConfig.ptoVenta,
                    tipoComprobante: invoiceType.type,
                    environment: companyConfig.afip?.environment || 'testing'
                } : null
            });

            const savedInvoice = await newInvoice.save();
            console.log('✅ Factura guardada en BD:', savedInvoice.numeroFactura);

            // ✅ 9. GENERAR PDF
            let pdfResult = null;
            try {
                const invoiceDataForPDF = {
                    numeroFactura: savedInvoice.numeroFactura,
                    tipo: savedInvoice.tipo,
                    descripcionTipo: savedInvoice.descripcionTipo,
                    cae: savedInvoice.cae,
                    fechaVencimientoCAE: savedInvoice.fechaVencimientoCAE ? 
                        new Date(savedInvoice.fechaVencimientoCAE).toLocaleDateString('es-AR') : null,
                    fechaEmision: new Date(savedInvoice.fechaEmision).toLocaleDateString('es-AR'),
                    cliente: savedInvoice.cliente,
                    clientData: savedInvoice.clientData,
                    items: savedInvoice.items,
                    subtotal: savedInvoice.subtotal,
                    iva: savedInvoice.iva,
                    total: savedInvoice.total,
                    metodoPago: savedInvoice.metodoPago,
                    testing: savedInvoice.testing
                };

                pdfResult = await generateInvoicePDF(invoiceDataForPDF, companyConfig);
                savedInvoice.pdfFileName = pdfResult.fileName;
                savedInvoice.pdfPath = pdfResult.filePath;
                await savedInvoice.save();
                
                console.log('✅ PDF generado:', pdfResult.fileName);
            } catch (pdfError) {
                console.error('⚠️ Error generando PDF (factura creada exitosamente):', pdfError);
                savedInvoice.status = 'completed_pdf_error';
                savedInvoice.notes = `Error PDF: ${pdfError.message}`;
                await savedInvoice.save();
            }

            // ✅ 10. RESPUESTA EXITOSA
            return res.json({
                success: true,
                message: testing ? 'Factura de prueba generada exitosamente' : 'Factura OFICIAL generada con AFIP',
                numeroFactura: savedInvoice.numeroFactura,
                cae: savedInvoice.cae,
                fechaVencimientoCAE: validateAndFormatDate(savedInvoice.fechaVencimientoCAE, 'fechaVencimientoCAE'),
                fechaEmision: validateAndFormatDate(savedInvoice.fechaEmision, 'fechaEmision'),
                tipo: savedInvoice.tipo,
                descripcionTipo: savedInvoice.descripcionTipo,
                cliente: savedInvoice.cliente,
                clientData: savedInvoice.clientData,
                items: savedInvoice.items,
                subtotal: savedInvoice.subtotal,
                iva: savedInvoice.iva,
                total: savedInvoice.total,
                metodoPago: savedInvoice.metodoPago,
                testing: savedInvoice.testing,
                status: savedInvoice.status,
                pdfFileName: pdfResult?.fileName || null,
                pdfPath: pdfResult?.filePath || null,
                viewUrl: `/api/arca/invoices/${savedInvoice._id}/pdf`,
                downloadUrl: `/api/arca/invoices/${savedInvoice._id}/download`,
                
                // Datos para el frontend
                invoice: {
                    _id: savedInvoice._id,
                    numeroFactura: savedInvoice.numeroFactura,
                    tipo: savedInvoice.tipo,
                    descripcionTipo: savedInvoice.descripcionTipo,
                    cae: savedInvoice.cae,
                    fechaVencimientoCAE: savedInvoice.fechaVencimientoCAE,
                    fechaEmision: savedInvoice.fechaEmision,
                    cliente: savedInvoice.cliente,
                    clientData: savedInvoice.clientData,
                    items: savedInvoice.items,
                    subtotal: savedInvoice.subtotal,
                    iva: savedInvoice.iva,
                    total: savedInvoice.total,
                    metodoPago: savedInvoice.metodoPago,
                    testing: savedInvoice.testing,
                    status: savedInvoice.status,
                    afipData: savedInvoice.afipData,
                    pdfFileName: pdfResult?.fileName
                }
            });

        } catch (dbError) {
            console.error('❌ Error guardando en base de datos:', dbError);
            return res.status(500).json({
                success: false,
                error: 'Error guardando factura en base de datos',
                details: dbError.message,
                type: 'database_error'
            });
        }

    } catch (error) {
        console.error('❌ Error general en generateARCAInvoice:', error);
        
        res.status(500).json({
            success: false,
            error: error.message || 'Error interno del servidor',
            type: 'general_error',
            timestamp: new Date().toISOString(),
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// ✅ FUNCIÓN AUXILIAR PARA OBTENER CONFIGURACIÓN DE EMPRESA (ejemplo)
// Debes implementar esto según tu estructura de base de datos
async function getCompanyConfig() {
    // Implementa según donde tengas guardada la configuración
    // Puede ser en una colección de MongoDB, variables de entorno, etc.
    
    return {
        cuit: process.env.COMPANY_CUIT || '20123456789',
        razonSocial: process.env.COMPANY_NAME || 'Mi Empresa SRL',
        ptoVenta: parseInt(process.env.AFIP_PTO_VENTA) || 1,
        afip: {
            environment: process.env.NODE_ENV === 'production' ? 'production' : 'testing',
            certificatePath: process.env.AFIP_CERT_PATH || './certificates/cert.pem',
            keyPath: process.env.AFIP_KEY_PATH || './certificates/key.key',
            wsfeUrl: process.env.NODE_ENV === 'production' 
                ? 'https://servicios1.afip.gov.ar/wsfev1/service.asmx?WSDL'
                : 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx?WSDL'
        }
    };
}