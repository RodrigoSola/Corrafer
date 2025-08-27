import { model, Schema } from "mongoose";

const clientsSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    toLowerCase: true,
  },
  alias: {
    type: String,
    trim: true,
    toLowerCase: true,
  },
  fiscalDirection: {
    type: String,
    required: true,
    trim: true,
    toLowerCase: true,
  },
  location: {
    type: String,
    trim: true,
    toLowerCase: true,
  },
  province: {
    type: String,
    trim: true,
    toLowerCase: true,
  },
  country: {
    type: String,
    trim: true,
    toLowerCase: true,
  },
  cuit: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    toLowerCase: true,
  },
  typeOfClient: {
    type: String,
    clientEnum: ["RI", "EX","MONOTRIBUTO", "CF"],
  },
  owesDebt: {
    type: Boolean,
    default: false,
  },
  debtAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
});

export default model("clients", clientsSchema);
