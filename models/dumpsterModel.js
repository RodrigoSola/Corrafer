import { Schema, model  } from 'mongoose';

const dumpsterSchema = new Schema({
    number: {
        type: Number,
        required: true,
        unique: true
    },
    size: {
        type: String,
        required: true,
        sizeEnum: ["pequeño", "grande"]
    },
    status: {
        type: String,
        required: true,
        statusEnum: ["disponible","alquilado"],
        default: 'disponible'
    },
    currentRental: {
        rentalName: {
            type: String,
            default: null
        },
        rentalAdress: {
            type: String,
            default: null
        },
        rentalStartDate: {
            type: Date,
            default: Date.now()
        },
        rentalEndDate: {
            type: Date,
            default: null
        },
        contactPhone: {
            type: String,
            default: null
        }
    }
})

export default model("Dumpster", dumpsterSchema)

