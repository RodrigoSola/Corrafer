import { Router } from "express";
import { createUser, deleteUser, getUsers, updateUser, validate} from "../../api/controller/userController.js";
import { verifyTokenMiddleware } from "../../middlewares/verifyTokenMiddleware.js";

const UserRouter = Router();

UserRouter.get("/get",verifyTokenMiddleware, getUsers)
UserRouter.post("/create",  createUser)
UserRouter.delete("/delete/:id",verifyTokenMiddleware, deleteUser)
UserRouter.put("/update/:id", verifyTokenMiddleware, updateUser)
UserRouter.post("/login",validate)







export default UserRouter;