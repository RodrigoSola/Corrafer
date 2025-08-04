import { Router } from "express";
import { createClient, deleteClient, getClients, updateClient } from "../../api/controller/clientsController.js";


const ClientRouter = Router();


ClientRouter.post("/create", createClient)
ClientRouter.get("/get", getClients)
ClientRouter.put("/update/:id", updateClient)
ClientRouter.delete("/delete/:id" ,deleteClient)








export default ClientRouter;