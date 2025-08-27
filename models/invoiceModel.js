import mongoose, { model } from 'mongoose';

const invoiceSchema = new mongoose.Schema({
    numeroFactura: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    tipo: {
        type: String,
        enum: ['A', 'B', 'C'],
        required: true
    },
    descripcionTipo: {
        type: String,
        default: null
    },
    cae: {
        type: String,
        default: null
    },
    fechaEmision: {
        type: Date,
        required: true,
        default: Date.now
    },
    fechaVencimientoCAE: {
        type: Date,
        default: null
    },
    client: {
        type: String,
        required: true
    },
    clientEmail: {
        type: String,
        default: null
    },
    
    // ✅ CAMPO PRINCIPAL PARA DATOS DEL CLIENTE
    clientData: {
        name: { type: String, required: true },
        cuit: { type: String, default: '' },
        email: { type: String, default: '' },
        location: { type: String, default: '' },
        typeOfClient: { type: String, default: 'CF' }
    },
    
    // ✅ CAMPO DE COMPATIBILIDAD
    client: {
        _id: { type: String },
        name: { type: String },
        cuit: { type: String },
        email: { type: String },
        location: { type: String },
        typeOfClient: { type: String }
    },
    
    items: [{
        name: { type: String, required: true },
        description: { type: String, default: '' },
        quantity: { type: Number, required: true },
        priceWithoutIVA: { type: Number, required: true },
        priceWithIVA: { type: Number, required: true }
    }],
    subtotal: {
        type: Number,
        required: true,
        default: 0
    },
    iva: {
        type: Number,
        required: true,
        default: 0
    },
    total: {
        type: Number,
        required: true
    },
    metodoPago: {
        type: String,
        default: 'Efectivo'
    },
    testing: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'error', 'cancelled'],
        default: 'pending' // ✅ Por defecto pending hasta que se genere el PDF
    },
    pdfFileName: {
        type: String,
        default: null
    },
    pdfPath: {
        type: String,
        default: null
    },
    downloadUrl: {
        type: String,
        default: null
    },
    viewUrl: {
        type: String,
        default: null
    },
    emailSent: {
        type: Boolean,
        default: false
    },
    emailSentAt: {
        type: Date,
        default: null
    },
    emailRecipient: {
        type: String,
        default: null
    },
    companyConfig: {
        type: Object,
        default: null
    },
    notes: {
        type: String,
        default: null
    }
}, {
    timestamps: true // Agrega createdAt y updatedAt automáticamente
});

// Índices para mejorar el rendimiento
invoiceSchema.index({ numeroFactura: 1 });
invoiceSchema.index({ fechaEmision: -1 });
invoiceSchema.index({ cliente: 1 });
invoiceSchema.index({ testing: 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ 'clientData.email': 1 });

// ✅ MÉTODO PARA MARCAR EMAIL COMO ENVIADO
invoiceSchema.methods.markEmailSent = function(recipientEmail) {
    this.emailSent = true;
    this.emailSentAt = new Date();
    this.emailRecipient = recipientEmail;
    return this.save();
};

// ✅ MÉTODO PARA OBTENER DATOS DEL CLIENTE (COMPATIBILIDAD)
invoiceSchema.methods.getClientData = function() {
    return this.clientData || this.client || {
        name: this.cliente || 'Cliente no especificado',
        cuit: '',
        email: this.clientEmail || '',
        location: '',
        typeOfClient: 'CF'
    };
};

// ✅ MÉTODO PARA GENERAR URLs DEL PDF
invoiceSchema.methods.getPDFUrls = function() {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    
    if (this.pdfFileName) {
        return {
            viewUrl: `${baseUrl}/api/arca/invoices/${this._id}/pdf`,
            downloadUrl: `${baseUrl}/api/arca/invoices/${this._id}/download`,
            staticUrl: `${baseUrl}/invoices/${this.pdfFileName}`
        };
    }
    
    return {
        viewUrl: null,
        downloadUrl: null,
        staticUrl: null
    };
};

// ✅ MÉTODO JSON PERSONALIZADO
invoiceSchema.methods.toJSON = function() {
    const invoice = this.toObject();
    
    // Formatear fechas
    if (invoice.fechaEmision) {
        invoice.fechaEmisionFormatted = new Date(invoice.fechaEmision).toLocaleDateString('es-AR');
    }
    
    if (invoice.fechaVencimientoCAE) {
        invoice.fechaVencimientoCAEFormatted = new Date(invoice.fechaVencimientoCAE).toLocaleDateString('es-AR');
    }
    
    // Asegurar compatibilidad de datos del cliente
    if (!invoice.clientData && invoice.client) {
        invoice.clientData = invoice.client;
    }
    
    if (!invoice.client && invoice.clientData) {
        invoice.client = invoice.clientData;
    }
    
    // Generar URLs del PDF si existe
    const pdfUrls = this.getPDFUrls();
    invoice.viewUrl = pdfUrls.viewUrl;
    invoice.downloadUrl = pdfUrls.downloadUrl;
    invoice.staticUrl = pdfUrls.staticUrl;
    
    return invoice;
};

// ✅ MÉTODO ESTÁTICO PARA ESTADÍSTICAS - CORREGIDO
invoiceSchema.statics.getStats = async function(filter = {}) {
    const pipeline = [
        { $match: filter },
        {
            $group: {
                _id: null,
                totalInvoices: { $sum: 1 },
                totalAmount: { $sum: '$total' },
                officialCount: { 
                    $sum: { $cond: [{ $eq: ['$testing', false] }, 1, 0] } 
                },
                testingCount: { 
                    $sum: { $cond: [{ $eq: ['$testing', true] }, 1, 0] } 
                },
                completedCount: { 
                    $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } 
                },
                pendingCount: { 
                    $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } 
                },
                errorCount: { 
                    $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } 
                },
                avgAmount: { $avg: '$total' },
                maxAmount: { $max: '$total' },
                minAmount: { $min: '$total' }
            }
        }
    ];
    
    const result = await this.aggregate(pipeline);
    
    return result[0] || {
        totalInvoices: 0,
        totalAmount: 0,
        officialCount: 0,
        testingCount: 0,
        completedCount: 0,
        pendingCount: 0,
        errorCount: 0,
        avgAmount: 0,
        maxAmount: 0,
        minAmount: 0
    };
};

// ✅ MÉTODO ESTÁTICO PARA ESTADÍSTICAS POR TIPO
invoiceSchema.statics.getStatsByType = async function() {
    const pipeline = [
        {
            $group: {
                _id: '$tipo',
                count: { $sum: 1 },
                totalAmount: { $sum: '$total' },
                avgAmount: { $avg: '$total' }
            }
        },
        { $sort: { _id: 1 } }
    ];
    
    const result = await this.aggregate(pipeline);
    return result;
};

// ✅ MÉTODO ESTÁTICO PARA ESTADÍSTICAS MENSUALES
invoiceSchema.statics.getMonthlyStats = async function(months = 12) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    
    const pipeline = [
        {
            $match: {
                fechaEmision: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: '$fechaEmision' },
                    month: { $month: '$fechaEmision' }
                },
                count: { $sum: 1 },
                totalAmount: { $sum: '$total' },
                officialCount: { 
                    $sum: { $cond: [{ $eq: ['$testing', false] }, 1, 0] } 
                },
                testingCount: { 
                    $sum: { $cond: [{ $eq: ['$testing', true] }, 1, 0] } 
                }
            }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
    ];
    
    const result = await this.aggregate(pipeline);
    return result;
};

// ✅ PRE-SAVE MIDDLEWARE
invoiceSchema.pre('save', function(next) {
    // Asegurar que el número de factura esté presente
    if (!this.numeroFactura) {
        const timestamp = Date.now();
        this.numeroFactura = this.testing 
            ? `TEST-${timestamp.toString().slice(-8)}`
            : `001-${timestamp.toString().slice(-8)}`;
    }
    
    // Asegurar compatibilidad entre client y clientData
    if (this.clientData && !this.client) {
        this.client = {
            name: this.clientData.name,
            cuit: this.clientData.cuit,
            email: this.clientData.email,
            location: this.clientData.location,
            typeOfClient: this.clientData.typeOfClient
        };
    }
    
    if (this.client && !this.clientData) {
        this.clientData = {
            name: this.client.name || this.cliente,
            cuit: this.client.cuit || '',
            email: this.client.email || this.clientEmail || '',
            location: this.client.location || '',
            typeOfClient: this.client.typeOfClient || 'CF'
        };
    }
    
    // Asegurar que cliente tenga el nombre correcto
    if (this.clientData && this.clientData.name && !this.cliente) {
        this.cliente = this.clientData.name;
    }
    
    // Calcular totales si faltan y hay items
    if (this.items && this.items.length > 0 && (!this.total || this.total === 0)) {
        this.subtotal = this.items.reduce((sum, item) => {
            const price = this.tipo === 'A' ? (item.priceWithoutIVA || 0) : (item.priceWithIVA || 0);
            return sum + (price * (item.quantity || 0));
        }, 0);
        
        this.iva = this.tipo === 'C' ? 0 : this.subtotal * 0.21;
        this.total = this.tipo === 'A' ? this.subtotal + this.iva : this.subtotal;
    }
    
    // Asegurar que el status sea válido
    if (!this.status || !['pending', 'completed', 'error', 'cancelled'].includes(this.status)) {
        this.status = 'pending';
    }
    
    next();
});

// ✅ POST-SAVE MIDDLEWARE
invoiceSchema.post('save', function(doc) {
    console.log(`💾 Factura guardada: ${doc.numeroFactura} - Status: ${doc.status}`);
});

// ✅ MÉTODO VIRTUAL PARA OBTENER EL TIPO DE FACTURA DESCRIPTIVO
invoiceSchema.virtual('tipoDescriptivo').get(function() {
    const tipos = {
        'A': 'Factura A - Responsable Inscripto',
        'B': 'Factura B - Monotributo',
        'C': 'Factura C - Consumidor Final'
    };
    return tipos[this.tipo] || `Factura ${this.tipo}`;
});

// ✅ MÉTODO VIRTUAL PARA OBTENER EL STATUS DESCRIPTIVO
invoiceSchema.virtual('statusDescriptivo').get(function() {
    const statuses = {
        'pending': 'Pendiente de procesar',
        'completed': 'Completada exitosamente',
        'error': 'Error en el procesamiento',
        'cancelled': 'Cancelada'
    };
    return statuses[this.status] || this.status;
});

// ✅ MÉTODO VIRTUAL PARA OBTENER LA ANTIGÜEDAD
invoiceSchema.virtual('antiguedad').get(function() {
    const now = new Date();
    const created = this.createdAt || this.fechaEmision;
    const diffMs = now - created;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `${diffDays} días`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} semanas`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} meses`;
    return `${Math.floor(diffDays / 365)} años`;
});

// ✅ MÉTODO ESTÁTICO PARA BUSCAR POR CLIENTE
invoiceSchema.statics.findByClient = function(clientName, options = {}) {
    const query = {
        $or: [
            { cliente: { $regex: clientName, $options: 'i' } },
            { 'clientData.name': { $regex: clientName, $options: 'i' } },
            { 'client.name': { $regex: clientName, $options: 'i' } }
        ]
    };
    
    if (options.testing !== undefined) {
        query.testing = options.testing;
    }
    
    if (options.status) {
        query.status = options.status;
    }
    
    return this.find(query);
};

// ✅ MÉTODO ESTÁTICO PARA BUSCAR POR EMAIL
invoiceSchema.statics.findByEmail = function(email) {
    return this.find({
        $or: [
            { clientEmail: email },
            { 'clientData.email': email },
            { 'client.email': email },
            { emailRecipient: email }
        ]
    });
};

// ✅ MÉTODO ESTÁTICO PARA OBTENER FACTURAS RECIENTES
invoiceSchema.statics.getRecent = function(limit = 10) {
    return this.find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('numeroFactura cliente total fechaEmision testing status pdfFileName');
};

// ✅ MÉTODO ESTÁTICO PARA OBTENER FACTURAS PENDIENTES
invoiceSchema.statics.getPending = function() {
    return this.find({ 
        status: { $in: ['pending', 'error'] } 
    }).sort({ createdAt: -1 });
};

// ✅ MÉTODO PARA REGENERAR PDF (marcar como pendiente)
invoiceSchema.methods.regeneratePDF = function() {
    this.status = 'pending';
    this.pdfFileName = null;
    this.pdfPath = null;
    this.downloadUrl = null;
    this.viewUrl = null;
    return this.save();
};

// ✅ MÉTODO PARA VALIDAR DATOS ANTES DE GENERAR PDF
invoiceSchema.methods.validateForPDF = function() {
    const errors = [];
    
    if (!this.cliente && (!this.clientData || !this.clientData.name)) {
        errors.push('Nombre del cliente requerido');
    }
    
    if (!this.items || this.items.length === 0) {
        errors.push('Al menos un item es requerido');
    }
    
    if (!this.total || this.total <= 0) {
        errors.push('Total debe ser mayor a 0');
    }
    
    if (!this.numeroFactura) {
        errors.push('Número de factura requerido');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
};

// ✅ MÉTODO PARA OBTENER UN RESUMEN COMPLETO DE LA FACTURA
invoiceSchema.methods.getFullSummary = function() {
    return {
        // Información básica
        id: this._id,
        numeroFactura: this.numeroFactura,
        tipo: this.tipo,
        descripcionTipo: this.descripcionTipo,
        tipoDescriptivo: this.tipoDescriptivo,
        
        // Fechas
        fechaEmision: this.fechaEmision,
        fechaEmisionFormatted: this.fechaEmision ? new Date(this.fechaEmision).toLocaleDateString('es-AR') : null,
        fechaVencimientoCAE: this.fechaVencimientoCAE,
        fechaVencimientoCAEFormatted: this.fechaVencimientoCAE ? new Date(this.fechaVencimientoCAE).toLocaleDateString('es-AR') : null,
        
        // Cliente
        cliente: this.cliente,
        clientData: this.getClientData(),
        
        // Monetarios
        subtotal: this.subtotal || 0,
        iva: this.iva || 0,
        total: this.total || 0,
        items: this.items || [],
        metodoPago: this.metodoPago,
        
        // Estado y procesamiento
        testing: this.testing,
        status: this.status,
        statusDescriptivo: this.statusDescriptivo,
        
        // AFIP
        cae: this.cae,
        
        // PDF y archivos
        pdfFileName: this.pdfFileName,
        pdfPath: this.pdfPath,
        pdfUrls: this.getPDFUrls(),
        
        // Email
        emailSent: this.emailSent,
        emailSentAt: this.emailSentAt,
        emailRecipient: this.emailRecipient,
        
        // Metadatos
        companyConfig: this.companyConfig,
        notes: this.notes,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
        antiguedad: this.antiguedad
    };
};

// ✅ MÉTODO ESTÁTICO PARA ESTADÍSTICAS AVANZADAS
invoiceSchema.statics.getAdvancedStats = async function() {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisYear = new Date(now.getFullYear(), 0, 1);
    
    const stats = await this.aggregate([
        {
            $facet: {
                // Stats generales
                general: [
                    {
                        $group: {
                            _id: null,
                            totalInvoices: { $sum: 1 },
                            totalAmount: { $sum: '$total' },
                            avgAmount: { $avg: '$total' },
                            maxAmount: { $max: '$total' },
                            minAmount: { $min: '$total' },
                            officialCount: { $sum: { $cond: [{ $eq: ['$testing', false] }, 1, 0] } },
                            testingCount: { $sum: { $cond: [{ $eq: ['$testing', true] }, 1, 0] } },
                            completedCount: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                            pendingCount: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
                            errorCount: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } }
                        }
                    }
                ],
                
                // Stats por tipo
                byType: [
                    {
                        $group: {
                            _id: '$tipo',
                            count: { $sum: 1 },
                            totalAmount: { $sum: '$total' },
                            avgAmount: { $avg: '$total' }
                        }
                    },
                    { $sort: { _id: 1 } }
                ],
                
                // Stats mensuales (últimos 6 meses)
                monthly: [
                    {
                        $match: {
                            fechaEmision: { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) }
                        }
                    },
                    {
                        $group: {
                            _id: {
                                year: { $year: '$fechaEmision' },
                                month: { $month: '$fechaEmision' }
                            },
                            count: { $sum: 1 },
                            totalAmount: { $sum: '$total' },
                            avgAmount: { $avg: '$total' }
                        }
                    },
                    { $sort: { '_id.year': 1, '_id.month': 1 } }
                ],
                
                // Top clientes
                topClients: [
                    {
                        $group: {
                            _id: '$cliente',
                            count: { $sum: 1 },
                            totalAmount: { $sum: '$total' }
                        }
                    },
                    { $sort: { totalAmount: -1 } },
                    { $limit: 10 }
                ]
            }
        }
    ]);
    
    return {
        general: stats[0].general[0] || {},
        byType: stats[0].byType || [],
        monthly: stats[0].monthly || [],
        topClients: stats[0].topClients || []
    };
};

export default model('Invoice', invoiceSchema);

