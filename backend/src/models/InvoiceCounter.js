
import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

const invoiceCounterSchema = new Schema(
  {
    _id: {
      type: String,
      required: true,
    },

    sequence: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  {
    versionKey: false,
  }
);

const InvoiceCounter =
  models.InvoiceCounter ||
  model("InvoiceCounter", invoiceCounterSchema);

export default InvoiceCounter;
