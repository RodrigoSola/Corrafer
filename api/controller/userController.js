import User from '../../models/userModel.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
 
export const createUser = async (req, res) => {
    try {
        const user = new User(req.body)
        const { email } = user;
        const userExist = await User.findOne({ email });
        if(userExist) {
            return res.status(400).json({ message: 'User already exists' });
        }




        const newUser = await user.save();
        const { pasword, ...rest } = newUser;
        return res.status(201).json({ message: 'User created successfully', user: rest });
    } catch (error) {
        res.status(500).json({ message: 'Error creating user', error });

        
    }
}

export const getUsers = async (req, res) => {
   try {
    const users = await User.find();
   if(users.length === 0){
    return res.status(404).json({message: 'No users found'});
   }
   return res.status(200).json({ message: " Users founded successfully", users })
   } catch (error) {
    return res.status(500).json({ message: 'Error fetching users', error });
   }
}   

export const deleteUser = async (req,res) => {
    try {
        const _id = req.params.id
        const userExist = await User.findById(_id)
        if(!userExist){
            return res.status(404).json({message: 'User not found'})
        }
        const deletedUser = await User.findByIdAndDelete(_id)
        return res.status(200).json({ message: 'User deleted successfully', user: deletedUser })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: 'Error deleting user', error });


        
       
    }
}

export const updateUser = async (req, res) => {
    try {
        const _id= req.params.id
        const updateData= req.body
        if (typeof updateData !== 'object' || updateData === null) {
            return res.status(400).json({ message: 'Invalid data format' });
        }
        const userExist = await User.findById(_id)
        if(!userExist){
            return res.status(404).json({ message: 'User not found' });
        }
        const updatedUser = await User.findByIdAndUpdate(_id, updateData, { new: true });


        const savedUser = await updatedUser.save();

        const { password, ...rest } = savedUser.toObject(); // Exclude password from response
   
        return res.status(200).json({ message: 'User updated successfully', user: updatedUser , rest });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error updating user', error });
    }
}

export const validate = async (req, res) => {

    if(!req.body.email && !req.body.password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }
    try {
       const userFound = await User.findOne({ email: req.body.email })
       
       if(!userFound){
        return res.status(400).json({ message: 'Email or password are wrong' });
       }

       console.log({userFound})

       
       if(bcrypt.compareSync(req.body.password, userFound.password)) {

        const payload = {
            userId : userFound._id,
            userEmail : userFound.email,
        }

        const token = jwt.sign(payload, "secret", { expiresIn: "6h" })
        
        console.log(req.session)
       req.session.token = token;

        return res.status(200).json({ message: "Logged in ", token })
       }else {
         return res.status(400).json({ message: 'Email or password are wrong' });
       }
    } catch (error) {
        return res.status(500).json({ message: 'Error validating user', error });
    }
}
