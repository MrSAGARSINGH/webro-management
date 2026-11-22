
import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

const paymentRefundSchema = new Schema(
  {
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

    reason: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 1000,
      immutable: true,
    },

    referenceNumber: {
      type: String,
      trim: true,
      maxlength: 100,
      required: true,
      immutable: true,
    },

    processedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    processedAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,

    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        return ret;
      },
    },
  }
);

paymentRefundSchema.index(
  { referenceNumber: 1 },
  { unique: true }
);

paymentRefundSchema.index({
  payment: 1,
  createdAt: -1,
});

const PaymentRefund =
  models.PaymentRefund ||
  model("PaymentRefund", paymentRefundSchema);

export default PaymentRefund;
