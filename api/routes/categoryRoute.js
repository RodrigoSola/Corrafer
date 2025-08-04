import { Router } from "express";
import { createCategory, deleteCategory, getCategories, updateCategory } from "../../api/controller/categoryController.js";
import { verifyTokenMiddleware } from "../../middlewares/verifyTokenMiddleware.js";

export const CategoryRoute = Router();

CategoryRoute.post("/create", verifyTokenMiddleware, createCategory)
CategoryRoute.get("/",getCategories)
CategoryRoute.post("/update/:id",verifyTokenMiddleware, updateCategory)
CategoryRoute.delete("/delete/:id", verifyTokenMiddleware,deleteCategory)