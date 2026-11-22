
import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ======================================
// Invoice Constants
// ======================================

export const INVOICE_STATUSES = [
  "Draft",
  "Issued",
  "Partially Paid",
  "Paid",
  "Overdue",
  "Cancelled",
];

export const INVOICE_CURRENCIES = ["INR"];

export const INVOICE_ITEM_UNITS = [
  "Service",
  "Hour",
  "Day",
  "Month",
  "Piece",
  "Project",
];

// ======================================
// Financial Helpers
// ======================================

// Current model stores INR amounts as
// JavaScript numbers with 2-decimal precision.
// Migrate to integer paise before using
// invoices for real financial accounting.

const roundMoney = (value) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const isValidMoney = (value) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  Math.abs(
    Math.round(value * 100) - value * 100
  ) < 0.000001;

// ======================================
// Invoice Item Schema
// ======================================

const invoiceItemSchema = new Schema(
  {
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 500,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0.001,
      max: 1000000,
    },

    unit: {
      type: String,
      enum: INVOICE_ITEM_UNITS,
      default: "Service",
    },

    unitPrice: {
      type: Number,
      required: true,
      min: 0,
      max: 999999999999,
    },

    taxRate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0,
    },

    taxableAmount: {
      type: Number,
      default: 0,
    },

    taxAmount: {
      type: Number,
      default: 0,
    },

    totalAmount: {
      type: Number,
      default: 0,
    },
  },
  {
    _id: true,
    timestamps: false,
    versionKey: false,
  }
);

// ======================================
// Invoice Schema
// ======================================

const invoiceSchema = new Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 3,
      maxlength: 50,
      immutable: true,
    },

    client: {
      type: Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },

    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },

    status: {
      type: String,
      enum: INVOICE_STATUSES,
      default: "Draft",
    },

    currency: {
      type: String,
      enum: INVOICE_CURRENCIES,
      default: "INR",
      immutable: true,
    },

    issueDate: {
      type: Date,
      default: null,
    },

    dueDate: {
      type: Date,
      default: null,
    },

    items: {
      type: [invoiceItemSchema],
      default: [],
      validate: {
        validator: (items) => items.length <= 100,
        message: "Maximum 100 invoice items allowed",
      },
    },

    subtotal: {
      type: Number,
      default: 0,
      min: 0,
    },

    taxTotal: {
      type: Number,
      default: 0,
      min: 0,
    },

    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    grandTotal: {
      type: Number,
      default: 0,
      min: 0,
    },

    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Billing snapshot prevents historical
    // invoices from changing when a client's
    // contact details are edited.

    billingDetails: {
      businessName: {
        type: String,
        trim: true,
        maxlength: 200,
        default: "",
      },

      billingAddress: {
        type: String,
        trim: true,
        maxlength: 1000,
        default: "",
      },

      email: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 254,
        default: "",
      },

      phone: {
        type: String,
        trim: true,
        maxlength: 30,
        default: "",
      },

      gstin: {
        type: String,
        trim: true,
        uppercase: true,
        maxlength: 15,
        default: "",
      },
    },

    // Issuer snapshot must be populated from
    // trusted company settings by the controller.

    issuerDetails: {
      businessName: {
        type: String,
        trim: true,
        maxlength: 200,
        default: "",
      },

      billingAddress: {
        type: String,
        trim: true,
        maxlength: 1000,
        default: "",
      },

      gstin: {
        type: String,
        trim: true,
        uppercase: true,
        maxlength: 15,
        default: "",
      },
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },

    termsAndConditions: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    issuedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: "__v",
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
// Calculate Invoice Totals
// ======================================

invoiceSchema.methods.calculateTotals = function () {
  let subtotal = 0;
  let taxTotal = 0;

  for (const item of this.items) {
    const taxableAmount = roundMoney(
      item.quantity * item.unitPrice
    );

    const taxAmount = roundMoney(
      (taxableAmount * item.taxRate) / 100
    );

    item.taxableAmount = taxableAmount;
    item.taxAmount = taxAmount;

    item.totalAmount = roundMoney(
      taxableAmount + taxAmount
    );

    subtotal += taxableAmount;
    taxTotal += taxAmount;
  }

  this.subtotal = roundMoney(subtotal);
  this.taxTotal = roundMoney(taxTotal);

  this.grandTotal = roundMoney(
    Math.max(
      0,
      this.subtotal +
        this.taxTotal -
        this.discountAmount
    )
  );

  return this;
};

// ======================================
// Schema Validation
// ======================================

invoiceSchema.pre("validate", function () {
  // Reject invalid source amounts before
  // computing invoice totals.

  if (!isValidMoney(this.discountAmount)) {
    this.invalidate(
      "discountAmount",
      "Invalid discount amount"
    );
  }

  if (!isValidMoney(this.paidAmount)) {
    this.invalidate(
      "paidAmount",
      "Invalid paid amount"
    );
  }

  for (const item of this.items) {
    if (!isValidMoney(item.unitPrice)) {
      item.invalidate(
        "unitPrice",
        "Unit price must have at most 2 decimal places"
      );
    }

    if (
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0
    ) {
      item.invalidate(
        "quantity",
        "Quantity must be positive and finite"
      );
    }

    if (
      !Number.isFinite(item.taxRate) ||
      item.taxRate < 0 ||
      item.taxRate > 100
    ) {
      item.invalidate(
        "taxRate",
        "Tax rate must be between 0 and 100"
      );
    }
  }

  // Never trust client-provided totals.
  this.calculateTotals();

  if (
    this.discountAmount >
    this.subtotal + this.taxTotal
  ) {
    this.invalidate(
      "discountAmount",
      "Discount cannot exceed invoice total"
    );
  }

  if (this.paidAmount > this.grandTotal) {
    this.invalidate(
      "paidAmount",
      "Paid amount cannot exceed invoice total"
    );
  }

  if (
    this.issueDate &&
    this.dueDate &&
    this.dueDate < this.issueDate
  ) {
    this.invalidate(
      "dueDate",
      "Due date cannot be before issue date"
    );
  }

  if (this.status !== "Draft") {
    if (this.items.length === 0) {
      this.invalidate(
        "items",
        "Issued invoices must contain at least one item"
      );
    }

    if (!this.issueDate) {
      this.invalidate(
        "issueDate",
        "Issue date is required"
      );
    }

    if (!this.dueDate) {
      this.invalidate(
        "dueDate",
        "Due date is required"
      );
    }

    if (!this.issuedBy) {
      this.invalidate(
        "issuedBy",
        "Issuer is required"
      );
    }
  }

  if (this.status === "Paid") {
    if (
      Math.abs(
        this.paidAmount - this.grandTotal
      ) > 0.001
    ) {
      this.invalidate(
        "paidAmount",
        "Paid invoice must be fully settled"
      );
    }

    if (!this.paidAt) {
      this.invalidate(
        "paidAt",
        "Payment completion date is required"
      );
    }
  }

  if (this.status === "Partially Paid") {
    if (
      this.paidAmount <= 0 ||
      this.paidAmount >= this.grandTotal
    ) {
      this.invalidate(
        "paidAmount",
        "Partial payment must be between zero and invoice total"
      );
    }
  }

  if (this.status === "Cancelled") {
    if (!this.cancelledAt) {
      this.invalidate(
        "cancelledAt",
        "Cancellation date is required"
      );
    }

    if (this.paidAmount > 0) {
      this.invalidate(
        "status",
        "An invoice with recorded payments cannot be cancelled directly"
      );
    }
  }
});

// ======================================
// Virtual Fields
// ======================================

invoiceSchema.virtual("balanceDue").get(function () {
  return roundMoney(
    Math.max(0, this.grandTotal - this.paidAmount)
  );
});

invoiceSchema.virtual("isOverdue").get(function () {
  return (
    ["Issued", "Partially Paid", "Overdue"].includes(
      this.status
    ) &&
    this.dueDate instanceof Date &&
    this.dueDate.getTime() < Date.now() &&
    this.paidAmount < this.grandTotal
  );
});

invoiceSchema.virtual("itemCount").get(function () {
  return this.items.length;
});

// ======================================
// Database Indexes
// ======================================

invoiceSchema.index(
  { invoiceNumber: 1 },
  { unique: true }
);

invoiceSchema.index({
  client: 1,
  createdAt: -1,
});

invoiceSchema.index({
  project: 1,
  createdAt: -1,
});

invoiceSchema.index({
  status: 1,
  dueDate: 1,
});

invoiceSchema.index({
  issueDate: -1,
});

invoiceSchema.index({
  createdBy: 1,
  createdAt: -1,
});

// ======================================
// Export Invoice Model
// ======================================

const Invoice =
  models.Invoice ||
  model("Invoice", invoiceSchema);

export default Invoice;
