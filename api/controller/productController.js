import Product from "../../models/productModel.js"



   export const createProduct = async (req, res) => {
    try {
        const { name } = req.body;
        
        // Check if product exists BEFORE creating the instance
        const productExist = await Product.findOne({ name: name.toLowerCase() });
        if (productExist) {
            return res.status(400).json({ msg: 'Product already exist' });
        }
        
        // Create and save the product
        const product = new Product(req.body);
        const newProduct = await product.save();
        
        res.status(201).json(newProduct);
    } catch (error) {
        console.error("Product creation error:", error);
        return res.status(500).json({ message: "Product creation failed", error: error.message });
    }
}


export const getProduct = async (req, res) => {
    try {
        const products = await Product.find().populate('category')
        if(products.length === 0){
            return res.status(404).json({msg: 'No products found'})
        }
        const profit = 1.21
        const productWithProfit = products.map(product => {
            return {
                ...product.toObject(),
                adjustedPrice: product.price * profit
            }
        })
        return res.json(productWithProfit)
      
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message : "Product fetching failed", error})
        
    }
}

export const updateProduct = async (req,res) => {
    try {
        const _id = req.params.id
        const product = await Product.findOne({ _id })
        
        if(!product){
            return res.status(404).json({msg: 'Product not found'})
        }
        const { pasword, ...rest } = product.toObject()
        const updatedData = req.body
        const updatedProduct = await Product.findByIdAndUpdate(_id,updatedData, { new: true } )
        return res.json(updatedProduct)
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message : "Product update failed", error})
       
    }
}

export const deleteProduct = async (req, res ) => {
    try {
        const _id = req.params.id
        const product = await Product.findOne({ _id })
        if(!product){
            return res.status(404).json({msg: 'Product not found'})
        }
        const deletedProduct = await Product.findByIdAndDelete(_id)
        return res.json(deletedProduct)
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message : "Product deletion failed", error})
        
    }
}

// Buscar producto por código de barras
export const getProductByBarcode = async (req, res) => {
    try {
        const { barcode } = req.params;
        
        if (!barcode) {
            return res.status(400).json({ msg: 'Barcode is required' });
        }

        // Validar formato de código de barras
        if (!/^[0-9]{8}$|^[0-9]{12}$|^[0-9]{13}$|^[0-9]{14}$/.test(barcode)) {
            return res.status(400).json({ msg: 'Invalid barcode format. Must be 8, 12, 13, or 14 digits' });
        }

        const product = await Product.findOne({ barcode }).populate('category');
        
        if (!product) {
            return res.status(404).json({ msg: 'Product not found with this barcode' });
        }

        // Aplicar profit si es necesario
        const profit = 1.21;
        const productWithProfit = {
            ...product.toObject(),
            adjustedPrice: product.price * profit
        };

        return res.json(productWithProfit);
        
    } catch (error) {
        console.error("Barcode search error:", error);
        return res.status(500).json({ message: "Barcode search failed", error: error.message });
    }
};

// Buscar múltiples productos por códigos de barras
export const getProductsByBarcodes = async (req, res) => {
    try {
        const { barcodes } = req.body;
        
        if (!barcodes || !Array.isArray(barcodes)) {
            return res.status(400).json({ msg: 'Barcodes array is required' });
        }

        // Validar todos los códigos de barras
        const invalidBarcodes = barcodes.filter(barcode => 
            !/^[0-9]{8}$|^[0-9]{12}$|^[0-9]{13}$|^[0-9]{14}$/.test(barcode)
        );

        if (invalidBarcodes.length > 0) {
            return res.status(400).json({ 
                msg: 'Invalid barcode format found', 
                invalidBarcodes 
            });
        }

        const products = await Product.find({ 
            barcode: { $in: barcodes } 
        }).populate('category');

        if (products.length === 0) {
            return res.status(404).json({ msg: 'No products found with these barcodes' });
        }

        // Aplicar profit a todos los productos
        const profit = 1.21;
        const productsWithProfit = products.map(product => ({
            ...product.toObject(),
            adjustedPrice: product.price * profit
        }));

        return res.json(productsWithProfit);
        
    } catch (error) {
        console.error("Multiple barcode search error:", error);
        return res.status(500).json({ message: "Multiple barcode search failed", error: error.message });
    }
};

// Verificar si un código de barras ya existe
export const checkBarcodeExists = async (req, res) => {
    try {
        const { barcode } = req.params;
        
        if (!barcode) {
            return res.status(400).json({ msg: 'Barcode is required' });
        }

        const product = await Product.findOne({ barcode });
        
        return res.json({ 
            exists: !!product,
            product: product ? {
                _id: product._id,
                name: product.name,
                barcode: product.barcode
            } : null
        });
        
    } catch (error) {
        console.error("Barcode check error:", error);
        return res.status(500).json({ message: "Barcode check failed", error: error.message });
    }
};

// Buscar productos por nombre o código de barras (búsqueda combinada)
export const searchProducts = async (req, res) => {
    try {
        const { query } = req.query;
        
        if (!query || query.trim().length < 2) {
            return res.status(400).json({ msg: 'Search query must be at least 2 characters long' });
        }

        const searchTerm = query.toLowerCase();
        
        const products = await Product.find({
            $or: [
                { name: { $regex: `.*${searchTerm}.*`, $options: 'i' } },
                { barcode: { $regex: `.*${searchTerm}.*`, $options: 'i' } }
            ]
        }).populate('category');
        
        return res.json(products);
        
    } catch (error) {
        console.error("Product search error:", error);
        return res.status(500).json({ message: "Product search failed", error: error.message });
    }
};