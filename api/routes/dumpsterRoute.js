import { Router } from "express";
import { checkExpiredRentals, dumpsterCreate, dumpsterDelete, dumpsterList, dumpsterRent, dumpsterReturn, dumpsterUpdate } from "../../api/controller/dumpsterController.js";
import { verifyTokenMiddleware } from "../../middlewares/verifyTokenMiddleware.js";

const dumpsterRouter = Router();

dumpsterRouter.post("/create", verifyTokenMiddleware, dumpsterCreate);
dumpsterRouter.get("/get",verifyTokenMiddleware, dumpsterList)
dumpsterRouter.put("/update/:id",verifyTokenMiddleware, dumpsterUpdate);
dumpsterRouter.post("/rent/:id",verifyTokenMiddleware, dumpsterRent);
dumpsterRouter.post("/return/:id",verifyTokenMiddleware, dumpsterReturn);
dumpsterRouter.get("/check",verifyTokenMiddleware, checkExpiredRentals)
dumpsterRouter.delete("/delete/:id",verifyTokenMiddleware, dumpsterDelete)

export default dumpsterRouter;