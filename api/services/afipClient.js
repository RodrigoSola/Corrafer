import soap from 'soap';
import forge from 'node-forge';
import fs from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';

export default class AFIPClient {
    constructor(config) {
        this.config = config;
        this.token = null;
        this.sign = null;
        this.tokenExpiry = null;
        this.soapClient = null;
        
        // URLs según el ambiente
        this.wsaaUrl = config.afip.environment === 'production' 
            ? 'https://wsaa.afip.gov.ar/ws/services/LoginCms'
            : 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms';
            
        this.wsfeUrl = config.afip.environment === 'production'
            ? 'https://servicios1.afip.gov.ar/wsfev1/service.asmx?WSDL'
            : 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx?WSDL';
            
        console.log(`🏛️ AFIP Client iniciado - Ambiente: ${config.afip.environment}`);
        console.log(`🔗 WSAA URL: ${this.wsaaUrl}`);
        console.log(`🔗 WSFE URL: ${this.wsfeUrl}`);
    }

    
    // ✅ OBTENER ÚLTIMO NÚMERO DE FACTURA
    async getLastInvoiceNumber(invoiceType, pointOfSale) {
        try {
            await this.authenticate();

            if (!this.soapClient) {
                this.soapClient = await soap.createClientAsync(this.wsfeUrl, {
                    timeout: 30000
                });
            }

            const params = {
                Auth: {
                    Token: this.token,
                    Sign: this.sign,
                    Cuit: this.config.cuit
                },
                PtoVta: parseInt(pointOfSale),
                CbteTipo: invoiceType
            };

            const result = await new Promise((resolve, reject) => {
                this.soapClient.FECompUltimoAutorizado(params, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });

            const lastNumber = result.FECompUltimoAutorizadoResult.CbteNro || 0;
            console.log(`📊 Último número autorizado para tipo ${invoiceType}, PV ${pointOfSale}: ${lastNumber}`);
            
            return lastNumber;

        } catch (error) {
            console.error('❌ Error obteniendo último número:', error);
            throw error;
        }
    }

     // ✅ LLAMAR A WSAA
   async getServerStatus() {
        try {
            if (!this.token || new Date() >= this.tokenExpiration) {
                await this.authenticate();
            }

            const soap = await import('soap');
            const client = await soap.createClientAsync(this.wsfeUrl);
            
            const request = {
                Auth: {
                    Token: this.token,
                    Sign: this.sign,
                    Cuit: this.config.cuit
                }
            };

            const result = await client.FEDummyAsync(request);
            const response = result[0].FEDummyResult;
            
            return {
                appServer: response.AppServer,
                dbServer: response.DbServer,
                authServer: response.AuthServer
            };
            
        } catch (error) {
            console.error('❌ Error verificando servidor:', error);
            throw new Error(`Error servidor AFIP: ${error.message}`);
        }
    }
    getCodigoTipoComprobante(tipo) {
        const codigos = { 'A': 1, 'B': 6, 'C': 11 };
        return codigos[tipo] || 11;
    }

    getDocumentType(client) {
        if (!client?.cuit || client.typeOfClient === 'CF') {
            return 99; // Sin documento/Consumidor Final
        }
        return client.cuit.length === 11 ? 80 : 96; // CUIT o DNI
    }

    getDocumentNumber(client) {
        if (!client?.cuit || client.typeOfClient === 'CF') {
            return 0;
        }
        return parseInt(client.cuit.replace(/\D/g, '')) || 0;
    }

   

    // ✅ GENERAR TRA (CORREGIDO)
    generateTRA() {
        const now = new Date();
        const from = new Date(now.getTime() - 10 * 60 * 1000); // 10 minutos antes
        const to = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 horas después

        const tra = `<?xml version="1.0" encoding="UTF-8"?>
        <loginTicketRequest version="1.0">
            <header>
                <uniqueId>${Date.now()}</uniqueId>
                <generationTime>${from.toISOString()}</generationTime>
                <expirationTime>${to.toISOString()}</expirationTime>
            </header>
            <service>wsfe</service>
        </loginTicketRequest>`;

        console.log('📋 TRA generado correctamente');
        return tra;
    }

    // ✅ FIRMAR TRA - MÉTODO COMPLETAMENTE CORREGIDO
    async signTRA(tra) {
        try {
            console.log('🔏 Iniciando proceso de firma TRA...');

            // Leer certificado y clave privada
            const certPath = path.resolve(this.config.afip.certificatePath);
            const keyPath = path.resolve(this.config.afip.privateKeyPath);

            console.log('📂 Rutas de certificados:');
            console.log(`   - Certificado: ${certPath}`);
            console.log(`   - Clave privada: ${keyPath}`);

            if (!fs.existsSync(certPath)) {
                throw new Error(`Certificado no encontrado: ${certPath}`);
            }

            if (!fs.existsSync(keyPath)) {
                throw new Error(`Clave privada no encontrada: ${keyPath}`);
            }

            const certPem = fs.readFileSync(certPath, 'utf8');
            const keyPem = fs.readFileSync(keyPath, 'utf8');

            console.log('✅ Certificados leídos correctamente');

            // Parsear certificado y clave
            const cert = forge.pki.certificateFromPem(certPem);
            const privateKey = forge.pki.privateKeyFromPem(keyPem);

            console.log('✅ Certificado parseado exitosamente');
            console.log(`📅 Certificado válido desde: ${cert.validity.notBefore}`);
            console.log(`📅 Certificado válido hasta: ${cert.validity.notAfter}`);

            // Verificar validez del certificado
            const now = new Date();
            if (now < cert.validity.notBefore || now > cert.validity.notAfter) {
                throw new Error('El certificado AFIP ha expirado o no es válido aún');
            }

            // Crear mensaje PKCS#7 - MÉTODO CORREGIDO
            console.log('📦 Creando mensaje PKCS#7...');
            const p7 = forge.pkcs7.createSignedData();

            // Agregar contenido
            p7.content = forge.util.createBuffer(tra, 'utf8');

            console.log('🔐 Agregando firmante con atributos autenticados...');

            // ✅ CORRECCIÓN PRINCIPAL: Agregar atributos autenticados obligatorios
            const authenticatedAttributes = [
                {
                    type: forge.pki.oids.contentType,
                    value: forge.pki.oids.data
                },
                {
                    type: forge.pki.oids.messageDigest,
                    // El hash se calculará automáticamente
                }
            ];

            // Agregar signer con atributos autenticados REQUERIDOS
            p7.addSigner({
                key: privateKey,
                certificate: cert,
                digestAlgorithm: forge.pki.oids.sha256,
                authenticatedAttributes: authenticatedAttributes
            });

            console.log('✅ Firmante agregado con atributos autenticados');

            // Firmar
            console.log('🔏 Ejecutando firma...');
            p7.sign();

            console.log('✅ TRA firmado exitosamente');

            // Convertir a DER y luego a Base64
            const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
            const base64 = forge.util.encode64(der);

            console.log('✅ CMS generado en formato base64');
            console.log(`📏 Tamaño del CMS: ${base64.length} caracteres`);

            return base64;

        } catch (error) {
            console.error('❌ Error firmando TRA:', error);
            
            // Detalles específicos del error
            if (error.message.includes('authenticatedAttributes')) {
                console.error('💡 El error está relacionado con los atributos autenticados PKCS#7');
                console.error('💡 Verificar que node-forge esté actualizado');
            }
            
            if (error.message.includes('certificate')) {
                console.error('💡 Verificar formato y validez del certificado');
            }
            
            if (error.message.includes('private')) {
                console.error('💡 Verificar formato de la clave privada');
            }
            
            throw new Error(`Error al firmar TRA: ${error.message}`);
        }
    }
    
    async solicitarCAE(invoiceData) {
         try {
             // Verificar autenticación
             if (!this.token || new Date() >= this.tokenExpiration) {
                 await this.authenticate();
             }
 
             const soap = await import('soap');
             const client = await soap.createClientAsync(this.wsfeUrl);
             
             // Determinar código de comprobante
             const tipoComprobante = this.getCodigoTipoComprobante(invoiceData.tipo);
             
             // Preparar request SOAP
             const request = {
                 Auth: {
                     Token: this.token,
                     Sign: this.sign,
                     Cuit: this.config.cuit
                 },
                 FeCAEReq: {
                     FeCabReq: {
                         CantReg: 1,
                         PtoVta: parseInt(this.config.ptoVenta),
                         CbteTipo: tipoComprobante
                     },
                     FeDetReq: {
                         FECAEDetRequest: [{
                             Concepto: 1, // Productos
                             DocTipo: this.getDocumentType(invoiceData.client),
                             DocNro: this.getDocumentNumber(invoiceData.client),
                             CbteDesde: invoiceData.numeroComprobante,
                             CbteHasta: invoiceData.numeroComprobante,
                             CbteFch: this.formatDateAFIP(invoiceData.fechaEmision || new Date()),
                             ImpTotal: this.roundAmount(invoiceData.total),
                             ImpTotConc: 0,
                             ImpNeto: this.roundAmount(invoiceData.subtotal),
                             ImpOpEx: 0,
                             ImpIVA: this.roundAmount(invoiceData.iva || 0),
                             ImpTrib: 0,
                             MonId: 'PES',
                             MonCotiz: 1,
                             
                             // ✅ ALÍCUOTAS IVA (solo para facturas A y B)
                             ...(invoiceData.tipo !== 'C' && invoiceData.iva > 0 ? {
                                 Iva: {
                                     AlicIva: [{
                                         Id: 5, // 21%
                                         BaseImp: this.roundAmount(invoiceData.subtotal),
                                         Importe: this.roundAmount(invoiceData.iva)
                                     }]
                                 }
                             } : {})
                         }]
                     }
                 }
             };
 
             console.log('🏛️ Solicitando CAE a AFIP:', JSON.stringify(request, null, 2));
             
             const result = await client.FECAESolicitarAsync(request);
             const response = result[0].FECAESolicitarResult;
             
             console.log('📋 Respuesta AFIP completa:', JSON.stringify(response, null, 2));
             
             // Verificar errores globales
             if (response.Errors && response.Errors.Err) {
                 const errors = Array.isArray(response.Errors.Err) ? response.Errors.Err : [response.Errors.Err];
                 const errorMessages = errors.map(err => `[${err.Code}] ${err.Msg}`).join(', ');
                 throw new Error(`Errores AFIP: ${errorMessages}`);
             }
             
             // Verificar resultado del comprobante
             const caeResponse = response.FeDetResp?.FECAEDetResponse?.[0];
             if (!caeResponse) {
                 throw new Error('Respuesta AFIP inválida: No se recibió detalle del comprobante');
             }
             
             if (caeResponse.Resultado !== 'A') {
                 let errorMessage = 'CAE rechazado';
                 if (caeResponse.Observaciones?.Obs) {
                     const obs = Array.isArray(caeResponse.Observaciones.Obs) 
                         ? caeResponse.Observaciones.Obs 
                         : [caeResponse.Observaciones.Obs];
                     errorMessage += ': ' + obs.map(o => `[${o.Code}] ${o.Msg}`).join(', ');
                 }
                 throw new Error(errorMessage);
             }
             
             // ✅ CAE APROBADO
             const caeData = {
                 cae: caeResponse.CAE,
                 fechaVencimientoCAE: this.parseAFIPDate(caeResponse.CAEFchVto),
                 numeroComprobante: caeResponse.CbteDesde,
                 resultado: caeResponse.Resultado,
                 observaciones: caeResponse.Observaciones?.Obs ? 
                     caeResponse.Observaciones.Obs.map(o => `[${o.Code}] ${o.Msg}`).join(', ') : null,
                 fechaProceso: response.FeCabResp?.FchProceso ? 
                     this.parseAFIPDate(response.FeCabResp.FchProceso) : null
             };
             
             console.log('✅ CAE obtenido exitosamente:', caeData);
             return caeData;
             
         } catch (error) {
             console.error('❌ Error solicitando CAE:', error);
             throw new Error(`Error AFIP CAE: ${error.message}`);
         }
     }
   
    // Agregar estos métodos a tu clase AFIPClient

// ✅ MÉTODO AUTHENTICATE PRINCIPAL (FALTANTE)
async authenticate() {
    try {
        console.log('🔐 Iniciando autenticación AFIP...');
        
        // Verificar si el token aún es válido
        if (this.token && this.tokenExpiry && new Date() < this.tokenExpiry) {
            console.log('✅ Token AFIP válido, reutilizando');
            return;
        }
        
        console.log('🆕 Generando nuevo token AFIP...');
        
        // 1. Generar TRA
        const tra = this.generateTRA();
        
        // 2. Firmar TRA
        const signedTRA = await this.signTRA(tra);
        
        // 3. Llamar a WSAA
        const loginTicket = await this.callWSAA(signedTRA);
        
        // 4. Extraer token y sign
        this.parseLoginTicket(loginTicket);
        
        console.log('✅ Autenticación AFIP exitosa');
        console.log(`🕐 Token expira: ${this.tokenExpiry}`);
        
    } catch (error) {
        console.error('❌ Error en autenticación AFIP:', error);
        throw new Error(`Autenticación AFIP fallida: ${error.message}`);
    }
}

// ✅ MÉTODO CALLWSAA (FALTANTE)
async callWSAA(signedTRA) {
    try {
        console.log('📡 Llamando a WSAA...');
        
        const soap = await import('soap');
        const wsaaWsdl = this.wsaaUrl + '?WSDL';
        
        console.log(`🔗 Conectando a: ${wsaaWsdl}`);
        
        const client = await soap.createClientAsync(wsaaWsdl, {
            timeout: 30000,
            forceSoap12Headers: false
        });
        
        const loginCmsRequest = {
            in0: signedTRA
        };
        
        console.log('📤 Enviando CMS firmado a WSAA...');
        
        const result = await new Promise((resolve, reject) => {
            client.loginCms(loginCmsRequest, (err, result) => {
                if (err) {
                    console.error('❌ Error SOAP WSAA:', err);
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
        
        if (!result || !result.loginCmsReturn) {
            throw new Error('Respuesta inválida de WSAA');
        }
        
        console.log('✅ Login ticket recibido de WSAA');
        return result.loginCmsReturn;
        
    } catch (error) {
        console.error('❌ Error llamando WSAA:', error);
        
        // Detalles específicos del error
        if (error.message.includes('ENOTFOUND') || error.message.includes('timeout')) {
            throw new Error('No se puede conectar a WSAA - Verificar conexión a internet');
        }
        
        if (error.message.includes('SOAP')) {
            throw new Error('Error en protocolo SOAP - Verificar formato CMS');
        }
        
        throw new Error(`Error WSAA: ${error.message}`);
    }
}

// ✅ MÉTODO PARA PARSEAR LOGIN TICKET (FALTANTE)
parseLoginTicket(loginTicketXml) {
    try {
        console.log('📋 Parseando login ticket...');
        
        const parser = new XMLParser();
        const loginTicket = parser.parse(loginTicketXml);
        
        // Navegar la estructura XML
        const credentials = loginTicket.loginTicketResponse?.credentials;
        
        if (!credentials) {
            throw new Error('Estructura de login ticket inválida');
        }
        
        this.token = credentials.token;
        this.sign = credentials.sign;
        
        // Parsear fecha de expiración
        const expirationTime = loginTicket.loginTicketResponse?.header?.expirationTime;
        if (expirationTime) {
            this.tokenExpiry = new Date(expirationTime);
        } else {
            // Fallback: token válido por 12 horas
            this.tokenExpiry = new Date(Date.now() + 12 * 60 * 60 * 1000);
        }
        
        console.log('✅ Token y sign extraídos correctamente');
        console.log(`🕐 Token válido hasta: ${this.tokenExpiry}`);
        
        // Validar que tenemos los datos necesarios
        if (!this.token || !this.sign) {
            throw new Error('Token o sign faltantes en login ticket');
        }
        
    } catch (error) {
        console.error('❌ Error parseando login ticket:', error);
        throw new Error(`Error procesando login ticket: ${error.message}`);
    }
}

// ✅ MÉTODOS UTILITARIOS FALTANTES
formatDateAFIP(date) {
    if (!date) date = new Date();
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

parseAFIPDate(afipDate) {
    if (!afipDate) return null;
    const dateStr = String(afipDate);
    if (dateStr.length !== 8) return null;
    
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    
    return `${year}-${month}-${day}`;
}

roundAmount(amount) {
    return Math.round((amount || 0) * 100) / 100;
}

// ✅ CORRECCIÓN DEL MÉTODO getServerStatus
async getServerStatus() {
    try {
        // Asegurar autenticación
        await this.authenticate();

        const soap = await import('soap');
        const client = await soap.createClientAsync(this.wsfeUrl, {
            timeout: 30000
        });
        
        const request = {
            Auth: {
                Token: this.token,
                Sign: this.sign,
                Cuit: this.config.cuit
            }
        };

        const result = await new Promise((resolve, reject) => {
            client.FEDummy(request, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
        
        const response = result.FEDummyResult;
        
        console.log('🖥️ Status servidor AFIP:', response);
        
        return {
            appServer: response.AppServer || 'OK',
            dbServer: response.DbServer || 'OK', 
            authServer: response.AuthServer || 'OK'
        };
        
    } catch (error) {
        console.error('❌ Error verificando servidor AFIP:', error);
        throw new Error(`Error servidor AFIP: ${error.message}`);
    }
}
}