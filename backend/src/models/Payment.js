
import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ======================================
// Constants
// ======================================

export const PAYMENT_STATUSES = [
  "Pending",
  "Completed",
  "Failed",
  "Refunded",
  "Partially Refunded",
  "Cancelled",
];

export const PAYMENT_METHODS = [
  "UPI",
  "Bank Transfer",
  "Cash",
  "Cheque",
  "Credit Card",
  "Debit Card",
  "Payment Gateway",
  "Other",
];

export const PAYMENT_TYPES = [
  "Advance",
  "Milestone",
  "Final",
  "Maintenance",
  "Other",
];

export const PAYMENT_CURRENCIES = ["INR"];

// ======================================
// Payment Schema
// ======================================

const paymentSchema = new Schema(
  {
    client: {
      type: Schema.Types.ObjectId,
      ref: "Client",
      required: true,
      immutable: true,
    },

    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      default: null,
      immutable: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0.01,
      max: 999999999999,
      immutable: true,

      validate: {
        validator: Number.isFinite,
        message: "Amount must be a finite number",
      },
    },

    currency: {
      type: String,
      enum: PAYMENT_CURRENCIES,
      default: "INR",
      immutable: true,
    },

    paymentType: {
      type: String,
      enum: PAYMENT_TYPES,
      required: true,
      immutable: true,
    },

    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      required: true,
      immutable: true,
    },

    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "Pending",
    },

    transactionId: {
      type: String,
      trim: true,
      maxlength: 150,
      default: null,
      immutable: true,

      set(value) {
        return typeof value === "string"
          ? value.trim() || null
          : value;
      },
    },

    paymentDate: {
      type: Date,
      default: null,
    },

    dueDate: {
      type: Date,
      default: null,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    referenceNumber: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
      immutable: true,

      set(value) {
        return typeof value === "string"
          ? value.trim() || null
          : value;
      },
    },

    gatewayProvider: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
      immutable: true,
    },

    gatewayPaymentId: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null,
      immutable: true,
    },

    gatewayOrderId: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null,
      immutable: true,
    },

    refundedAmount: {
      type: Number,
      min: 0,
      default: 0,

      validate: {
        validator: Number.isFinite,
        message: "Refunded amount must be finite",
      },
    },

    refundedAt: {
      type: Date,
      default: null,
    },

    refundReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,

    // Required for optimistic concurrency
    versionKey: "__v",

    // Detect conflicting document saves
    optimisticConcurrency: true,

    toJSON: {
      virtuals: true,

      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ======================================
// Payment Validation
// ======================================

paymentSchema.pre("validate", function () {
  const hasValidPrecision = (value) =>
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(
      Math.round(value * 100) -
        value * 100
    ) < 0.000001;

  // Validate payment amount precision
  if (!hasValidPrecision(this.amount)) {
    this.invalidate(
      "amount",
      "Amount must have at most two decimal places"
    );
  }

  // Validate refund amount precision
  if (!hasValidPrecision(this.refundedAmount)) {
    this.invalidate(
      "refundedAmount",
      "Refund must have at most two decimal places"
    );
  }

  // Refund cannot exceed payment
  if (
    Number.isFinite(this.amount) &&
    Number.isFinite(this.refundedAmount) &&
    this.refundedAmount > this.amount
  ) {
    this.invalidate(
      "refundedAmount",
      "Refund cannot exceed payment amount"
    );
  }

  // ======================================
  // Refund Validation
  // ======================================

  if (
    ["Refunded", "Partially Refunded"].includes(
      this.status
    )
  ) {
    if (
      !this.paymentDate ||
      !this.verifiedAt ||
      !this.verifiedBy
    ) {
      this.invalidate(
        "status",
        "Refund requires a previously verified payment"
      );
    }

    if (this.refundedAmount <= 0) {
      this.invalidate(
        "refundedAmount",
        "Refund amount must be greater than zero"
      );
    }

    if (!this.refundedAt) {
      this.invalidate(
        "refundedAt",
        "Refund date is required"
      );
    }

    if (
      this.status === "Refunded" &&
      this.refundedAmount !== this.amount
    ) {
      this.invalidate(
        "refundedAmount",
        "Full refund must equal payment amount"
      );
    }

    if (
      this.status === "Partially Refunded" &&
      this.refundedAmount >= this.amount
    ) {
      this.invalidate(
        "refundedAmount",
        "Partial refund must be less than payment amount"
      );
    }
  } else if (
    this.refundedAmount !== 0 ||
    this.refundedAt
  ) {
    this.invalidate(
      "refundedAmount",
      "Refund metadata requires a refund status"
    );
  }

  // ======================================
  // Completed Payment Validation
  // ======================================

  if (this.status === "Completed") {
    if (!this.paymentDate) {
      this.invalidate(
        "paymentDate",
        "Payment date is required"
      );
    }

    if (!this.verifiedBy || !this.verifiedAt) {
      this.invalidate(
        "verifiedBy",
        "Completed payment requires verification"
      );
    }
  }

  // ======================================
  // Unsuccessful Payment Validation
  // ======================================

  if (
    ["Pending", "Failed", "Cancelled"].includes(
      this.status
    )
  ) {
    if (
      this.verifiedBy ||
      this.verifiedAt ||
      this.paymentDate
    ) {
      this.invalidate(
        "status",
        "Unsuccessful payments cannot have completion metadata"
      );
    }
  }

  // ======================================
  // Verification Consistency
  // ======================================

  if (
    Boolean(this.verifiedBy) !==
    Boolean(this.verifiedAt)
  ) {
    this.invalidate(
      "verifiedAt",
      "Verification requires both user and date"
    );
  }
});

// ======================================
// Virtual Fields
// ======================================

paymentSchema.virtual("netAmount").get(function () {
  if (
    ![
      "Completed",
      "Refunded",
      "Partially Refunded",
    ].includes(this.status)
  ) {
    return 0;
  }

  return (
    Math.round(
      (this.amount - this.refundedAmount) * 100
    ) / 100
  );
});

paymentSchema.virtual("isOverdue").get(function () {
  return (
    this.status === "Pending" &&
    this.dueDate instanceof Date &&
    this.dueDate.getTime() < Date.now()
  );
});

paymentSchema.virtual("isVerified").get(function () {
  return Boolean(
    this.verifiedBy && this.verifiedAt
  );
});

// ======================================
// Database Indexes
// ======================================

// Client payment history
paymentSchema.index({
  client: 1,
  createdAt: -1,
});

// Project payment history
paymentSchema.index({
  project: 1,
  createdAt: -1,
});

// Revenue reports
paymentSchema.index({
  status: 1,
  paymentDate: -1,
});

// Pending payment deadlines
paymentSchema.index({
  status: 1,
  dueDate: 1,
});

// Payment method reports
paymentSchema.index({
  paymentMethod: 1,
  paymentDate: -1,
});

// Unique transaction ID
paymentSchema.index(
  { transactionId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      transactionId: {
        $type: "string",
      },
    },
  }
);

// Unique gateway payment
paymentSchema.index(
  {
    gatewayProvider: 1,
    gatewayPaymentId: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      gatewayPaymentId: {
        $type: "string",
      },
    },
  }
);

// Unique internal reference number
paymentSchema.index(
  { referenceNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      referenceNumber: {
        $type: "string",
      },
    },
  }
);

// ======================================
// Export Payment Model
// ======================================

const Payment =
  models.Payment ||
  model("Payment", paymentSchema);

export default Payment;
