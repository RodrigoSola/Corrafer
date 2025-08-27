export const logAFIPTransaction = (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
        // Log todas las transacciones AFIP
        if (req.path.includes('/generate-invoice') && !req.body.testing) {
            console.log('🏛️ FACTURA REAL AFIP:', {
                timestamp: new Date().toISOString(),
                ip: req.ip,
                user: req.user?.id || 'anonymous',
                client: req.body.client?.name,
                total: req.body.cartItems?.reduce((sum, item) => 
                    sum + (item.priceWithIVA * item.quantity), 0
                ),
                response: data
            });
        }
        
        originalSend.call(this, data);
    };
    
    next();
};