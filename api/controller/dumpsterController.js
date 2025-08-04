import  Dumpster  from '../../models/dumpsterModel.js';
import {  formatDate, parseDate } from '../../models/utils/dateFormat.js';
export const dumpsterCreate = async (req, res) => {
    try {
        console.log(req.body)
        const { number, size} = req.body;
        const newDumpster = new Dumpster({number, size});
        if (newDumpster) {
            return res.status(400).json({ message: 'Number already exists/Numero ya existe ' });
        }
        const savedDumpster = await newDumpster.save();
        return res.status(201).json({ message: 'Dumpster created successfully/Volquete creado con exito', dumpster: savedDumpster });
    } catch (error) {
        console.error( error);
        return res.status(500).json({ message: 'Error creating dumpster/ Error al crear el volquete' });
    }
}

export const dumpsterRent = async (req, res) => {
    try {
        const { id } = req.params;
        const dumpster = await Dumpster.findById(id);
        if (!dumpster || dumpster.status !== 'disponible') {
            return res.status(404).json({ message: 'Volquete no disponible' });
        }
        const rentalStartDateString = req.body.rentalStartDate; // Suponiendo que recibes la fecha como cadena
        const prsedRentalStartDate = parseDate(rentalStartDateString); // Convierte la cadena a Date
        // Verifica si la conversión fue exitosa
        if (isNaN(prsedRentalStartDate.getTime())) {
            return res.status(400).json({ message: 'Fecha de inicio no válida' });
        }
        dumpster.status = 'alquilado';
        dumpster.currentRental = {
            rentalName: req.body.rentalName,
            rentalAdress: req.body.rentalAdress,
            rentalStartDate: formatDate(prsedRentalStartDate), // Formatear la fecha para la visualización
            rentalEndDate: formatDate(new Date(prsedRentalStartDate.getTime() + 48 * 60 * 60 * 1000)), // Agregar 48 horas en milisegundos y formatear
            contactPhone: req.body.contactPhone
        };
        const newDumpsterRental = await dumpster.save();
        return res.status(200).json({ message: 'Volquete alquilado con éxito', newDumpsterRental });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error al alquilar el volquete' });
    }
};
export const dumpsterReturn = async (req, res) => {
    try {
        const { id } = req.params;
        const dumpster = await Dumpster.findById(id);
        if (!dumpster || dumpster.status !== 'alquilado') {
            return res.status(404).json({ message: 'Volquete no disponible' });
        }
        dumpster.status = 'disponible';
        dumpster.currentRental = {
            rentalName: null,
            rentalAdress: null,
            rentalStartDate: null,
            rentalEndDate: null,
            contactPhone: null
        };
        const newDumpsterReturn = await dumpster.save();
        return res.status(200).json({ message: 'Volquete devuelto con exito', newDumpsterReturn });
    } catch (error) {
        return res.status(500).json({ message: 'Error al devolver el volquete' });
    }
}

export const dumpsterList = async (req, res) => {
    try {
        const dumpsters = await Dumpster.find();
        const status = {
            total : dumpsters.length,
            available: dumpsters.filter(d => d.status === 'disponible').length,
            rented: dumpsters.filter(d => d.status === 'alquilado').length,
            rentalDetails : dumpsters.filter( d => d.status === 'alquilado').map(d => ({
                number: d.number,
                rentalName: d.currentRental.rentalName,
                rentalAdress: d.currentRental.rentalAdress,
                daysRemaing: d.currentRental.rentalEndDate
                 ? Math.ceil((new Date(d.currentRental.rentalEndDate) - Date()) / (1000 * 60 * 60 * 24)) : 0,
            }))
        }

        return res.status(200).json({dumpsters , status});
    } catch (error) {
        return res.status(500).json({ message: 'Error fetching dumpsters' });
    }
}

export const checkExpiredRentals = async (req,res) => {
    try {
        const expiredDumpsters = await Dumpster.find({
            status: 'alquilado',
            'currentRental.rentalEndDate': { $lt: new Date() }
        });
        if (expiredDumpsters.length > 0) {
            for (const dumpster of expiredDumpsters) {
                dumpster.status = 'disponible';
                dumpster.currentRental = {
                    rentalName: null,
                    rentalAdress: null,
                    rentalStartDate: null,
                    rentalEndDate: null,
                    contactPhone: null
                };
                await dumpster.save();
            }
        }
        return res.status(200).json({ message: `Chequeo exitoso, se encontraron ${expiredDumpsters.length} volquetes expirados.`, expiredDumpsters }); ;
    } catch (error) {
        return res.status(500).json({ message: 'Error al chequear los volquetes expirados' });
    }
}

export const dumpsterDelete = async (req, res) => {
    try {
        const { id } = req.params;
        const dumpster = await Dumpster.findById(id);
       
        if (!dumpster) {
            
            return res.status(404).json({ message: 'Volquete no encontrado' });
        }
        await Dumpster.findByIdAndDelete(id)
        return res.status(200).json({ message: 'Volquete eliminado con exito'});
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error al eliminar el volquete' });
    }
}

export const dumpsterUpdate = async (req, res) => {
    try {
        const { id } = req.params;
        const dumpster = await Dumpster.findById(id);
        if (!dumpster) {
            return res.status(404).json({ message: 'Volquete no encontrado' });
        }
        dumpster.number = req.body.number || dumpster.number;
        dumpster.size = req.body.size || dumpster.size;
        dumpster.status = req.body.status || dumpster.status;
        const updatedDumpster = await dumpster.save();
        return res.status(200).json({ message: 'Volquete actualizado con exito', updatedDumpster });
    } catch (error) {
        return res.status(500).json({ message: 'Error al actualizar el volquete' });
    }
}

