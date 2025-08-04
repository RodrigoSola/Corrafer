import { Router } from "express";
import { checkBarcodeExists, createProduct, deleteProduct, getProduct, getProductByBarcode, getProductsByBarcodes, searchProducts, updateProduct } from "../../api/controller/productController.js";
import { verifyTokenMiddleware } from "../../middlewares/verifyTokenMiddleware.js";


const ProductRouter = Router();

ProductRouter.post("/create",createProduct)
ProductRouter.get("/get", verifyTokenMiddleware, getProduct)
ProductRouter.put("/update/:id", verifyTokenMiddleware, updateProduct)
ProductRouter.delete("/delete/:id",verifyTokenMiddleware, deleteProduct)
ProductRouter.get("/barcode/:barcode",verifyTokenMiddleware, getProductByBarcode);
ProductRouter.get("/barcodes",verifyTokenMiddleware, getProductsByBarcodes)
ProductRouter.get("/check/:barcode",verifyTokenMiddleware, checkBarcodeExists);
ProductRouter.get("/search", verifyTokenMiddleware, searchProducts);

export default ProductRouter;