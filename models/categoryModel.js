import { model, Schema } from 'mongoose'

const categorySchema = new Schema({
    name:{
        type: String,
        required: true,
        unique: true,
        trim: true,
        toLowerCase: true
    }
})

export default model("Category", categorySchema)