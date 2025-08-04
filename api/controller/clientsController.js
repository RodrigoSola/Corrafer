import Clients from "../../models/clientsModel.js";

export const createClient = async (req, res) => {
  try {
    const client = new Clients(req.body);
    // En createClient y updateClient (después de extraer req.body)
    if (
      req.body.owesDebt &&
      (!req.body.debtAmount || req.body.debtAmount <= 0)
    ) {
      return res
        .status(400)
        .json({
          message: "Debe ingresar un monto válido si el cliente debe dinero",
        });
    }

    const { cuit } = client;

    // Verificar si el cliente ya existe
    const clientExist = await Clients.findOne({ cuit });
    if (clientExist) {
      return res.status(400).json({ message: "Client already exists" });
    }

    // Guardar el nuevo cliente
    const newClient = await client.save();
    console.log("Cliente creado:", newClient); // Movido antes del return

    // Devolver el objeto cliente completo, no solo el nombre
    return res.status(201).json({
      message: "Client created successfully",
      client: newClient, // Objeto completo en lugar de solo el name
    });
  } catch (error) {
    console.error("Error creating client:", error);
    return res.status(500).json({
      message: "Error creating client",
      error: error.message,
    });
  }
};

export const getClients = async (req, res) => {
  try {
    const clients = await Clients.find();
    if (clients.length === 0) {
      return res.status(404).json({ message: "No clients found" });
    }
    return res.status(200).json({
      message: "Clients found successfully",
      clients,
    });
  } catch (error) {
    console.error("Error fetching clients:", error);
    return res.status(500).json({
      message: "Error fetching clients",
      error: error.message,
    });
  }
};

export const updateClient = async (req, res) => {
  try {
    const _id = req.params.id;
    const updateData = req.body;
    // En createClient y updateClient (después de extraer req.body)
    if (
      req.body.owesDebt &&
      (!req.body.debtAmount || req.body.debtAmount <= 0)
    ) {
      return res
        .status(400)
        .json({
          message: "Debe ingresar un monto válido si el cliente debe dinero",
        });
    }

    // Validar datos de entrada
    if (typeof updateData !== "object" || updateData === null) {
      return res.status(400).json({ message: "Invalid data format" });
    }

    // Verificar si el cliente existe
    const clientExist = await Clients.findById(_id);
    if (!clientExist) {
      return res.status(404).json({ message: "Client not found" });
    }

    // Actualizar el cliente
    const updatedClient = await Clients.findByIdAndUpdate(_id, updateData, {
      new: true, // Devolver el documento actualizado
      runValidators: true, // Ejecutar validaciones del modelo
    });

    console.log("Cliente actualizado:", updatedClient);

    return res.status(200).json({
      message: "Client updated successfully",
      client: updatedClient,
    });
  } catch (error) {
    console.error("Error updating client:", error);
    return res.status(500).json({
      message: "Error updating client",
      error: error.message,
    });
  }
};

export const deleteClient = async (req, res) => {
  try {
    const _id = req.params.id;

    // Verificar si el cliente existe
    const clientExist = await Clients.findById(_id);
    if (!clientExist) {
      return res.status(404).json({ message: "Client not found" });
    }

    // Eliminar el cliente
    const deletedClient = await Clients.findByIdAndDelete(_id);
    console.log("Cliente eliminado:", deletedClient);

    return res.status(200).json({
      message: "Client deleted successfully",
      client: deletedClient,
    });
  } catch (error) {
    console.error("Error deleting client:", error);
    return res.status(500).json({
      message: "Error deleting client",
      error: error.message,
    });
  }
};
