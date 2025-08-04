import { model, Schema } from "mongoose";


const productShema = new Schema({

    name:{
        type:String,
        required:[true, "Name is required"],
        unique:true,
        trim:true,
        toLowerCase:true
    },
    price:{
        type:Number,
        required:[true, "Price is required, min 0.1"],
        min: 0.01,
    },
    stock: {
        type:Number,
        min:0,
        required:[true, "Stock is required"]
    },
    category:{
        type:Schema.Types.ObjectId,
        ref:"Category",
        required:[true, "Category is required"],
        
    },
     barcode: {
        type: String,
        unique: true,
        sparse: true, // Permite valores null pero mantiene unicidad
        trim: true,
        validate: {
            validator: function(v) {
                
                return !v || /^[0-9]{4}$|^[0-9]{6}$|^[0-9]{8}$|^[0-9]{10}$/.test(v);
            },
            
        }
    },
    
    createDate:{
        type:Date,
        default: Date.now
    }


})


productShema.set("toJSON",{ virtuals:true })
productShema.set("toObject",{ virtuals:true })

export default model("product", productShema)