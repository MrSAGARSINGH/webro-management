
import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

const invoicePaymentAllocationSchema = new Schema(
  {
    invoice: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
      immutable: true,
    },

    payment: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
      immutable: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0.01,
      immutable: true,
    },

    allocatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

invoicePaymentAllocationSchema.index(
  { invoice: 1, payment: 1 },
  { unique: true }
);

invoicePaymentAllocationSchema.index({
  payment: 1,
  createdAt: -1,
});

invoicePaymentAllocationSchema.index({
  invoice: 1,
  createdAt: -1,
});

const InvoicePaymentAllocation =
  models.InvoicePaymentAllocation ||
  model(
    "InvoicePaymentAllocation",
    invoicePaymentAllocationSchema
  );

export default InvoicePaymentAllocation;
