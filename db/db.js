import  { connect } from "mongoose";
import { MONGO_URI } from "../config.js";

export const connectDB = async () => {
    try {
        await connect(MONGO_URI)
        console.log("Connect to MongoDB")
    } catch (error) {
        console.error(`Error connecting to MongoDB: ${error.message}`)
        process.exit(1) 
        
    }
}