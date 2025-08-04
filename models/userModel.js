import { model, Schema } from 'mongoose';
import { isGoodPassword } from './utils/validator.js';
import bcrypt from 'bcrypt';

const userSchema = new Schema({
    
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        minlength: 6,
        maxlength: 50,
        validate: {
            validator: function (v) {
                return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v);
            },
            message: props => `${props.value} is not a valid email!`
        }

    },
    password: {
        type: String,
        required: true,
        validate : {
            validator : function (value) {
                return isGoodPassword(value)
                
            },
            message : "La contraseña debe tener al menos un digito, una letra mayuscula y una minuscula, un caracter especial y no menos de 8 caracteres en total"
        }
    },

   
    registrationDate: {
        type: Date,
        default: Date.now
    },
   
})



 userSchema.pre("save", function (next){

    this.password = bcrypt.hashSync(this.password, 10);
    next();
   })

export default model("user", userSchema)