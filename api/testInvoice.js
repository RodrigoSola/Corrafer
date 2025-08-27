// testInvoice.js - Test CORRAFER
import dotenv from 'dotenv';
dotenv.config();

const testInvoiceData = {
    client: {
        name: 'Cliente Test CORRAFER',
        typeOfClient: 'CF'
    },
    cartItems: [
        {
            name: 'Producto Test',
            quantity: 1,
            priceWithIVA: 100.00,
            priceWithoutIVA: 82.64
        }
    ],
    paymentMethod: 'Efectivo',
    testing: true
};

console.log('🧪 Test CORRAFER - Facturación AFIP');
console.log('URL:', 'http://localhost:3000/api/arca/generate-invoice');
console.log('Datos:', JSON.stringify(testInvoiceData, null, 2));

// Comando curl para prueba:
const curlCommand = `curl -X POST http://localhost:3000/api/arca/generate-invoice -H "Content-Type: application/json" -d '${JSON.stringify(testInvoiceData)}'`;
console.log('\nComando curl:');
console.log(curlCommand);
