
import { z } from "zod";

import {
  INVOICE_STATUSES,
  INVOICE_CURRENCIES,
  INVOICE_ITEM_UNITS,
} from "../models/Invoice.js";

// ======================================
// Reusable Schemas
// ======================================

const objectIdSchema = z
  .string()
  .regex(
    /^[a-fA-F0-9]{24}$/,
    "Invalid MongoDB ObjectId"
  );

const dateTimeSchema = z.iso.datetime({
  offset: true,
});

const nullableDateSchema = z
  .union([
    dateTimeSchema,
    z.null(),
    z.literal(""),
  ])
  .transform((value) =>
    value === "" ? null : value
  );

const optionalObjectIdSchema = z
  .union([
    objectIdSchema,
    z.null(),
    z.literal(""),
  ])
  .transform((value) =>
    value === "" ? null : value
  );

const textSchema = (maxLength) =>
  z.string().trim().max(maxLength);

const requiredTextSchema = (min, max) =>
  z.string().trim().min(min).max(max);

// ======================================
// Financial Validation
// ======================================

// Matches the current Invoice.js model:
// INR amounts stored as JavaScript numbers.
//
// Migrate to integer paise before real
// financial accounting.

const hasTwoDecimals = (value) =>
  Number.isFinite(value) &&
  Math.abs(
    Math.round(value * 100) -
      value * 100
  ) < 0.000001;

const moneySchema = z
  .number()
  .finite()
  .min(0)
  .max(999999999999)
  .refine(hasTwoDecimals, {
    message:
      "Amount must have at most two decimal places",
  });

const positiveMoneySchema = moneySchema.refine(
  (value) => value > 0,
  {
    message: "Amount must be greater than zero",
  }
);

// ======================================
// Invoice Number
// ======================================

export const invoiceNumberSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(3)
  .max(50)
  .regex(
    /^[A-Z0-9][A-Z0-9/-]*$/,
    "Invalid invoice number format"
  );

// ======================================
// Invoice Item Schema
// ======================================

export const invoiceItemSchema = z
  .strictObject({
    description: requiredTextSchema(2, 500),

    quantity: z
      .number()
      .finite()
      .min(0.001)
      .max(1000000),

    unit: z
      .enum(INVOICE_ITEM_UNITS)
      .default("Service"),

    unitPrice: moneySchema,

    taxRate: z
      .number()
      .finite()
      .min(0)
      .max(100)
      .default(0),
  });

// ======================================
// Billing Details Schema
// ======================================

const billingDetailsSchema = z.strictObject({
  businessName: textSchema(200).default(""),

  billingAddress: textSchema(1000).default(""),

  email: z
    .union([
      z.email(),
      z.literal(""),
    ])
    .default(""),

  phone: textSchema(30).default(""),

  gstin: z
    .union([
      z
        .string()
        .trim()
        .toUpperCase()
        .regex(
          /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
          "Invalid GSTIN format"
        ),
      z.literal(""),
    ])
    .default(""),
});

// ======================================
// Invoice Date Validation
// ======================================

const validateDates = (data, ctx) => {
  if (
    data.issueDate &&
    data.dueDate &&
    new Date(data.dueDate).getTime() <
      new Date(data.issueDate).getTime()
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["dueDate"],
      message:
        "Due date cannot be before issue date",
    });
  }
};

// ======================================
// Create Invoice
// POST /api/invoices
// ======================================

// New invoices always start as Draft.
//
// invoiceNumber, status, totals,
// paidAmount, issuedBy and issuerDetails
// must be controlled by the server.

export const createInvoiceSchema = z
  .strictObject({
    client: objectIdSchema,

    project: optionalObjectIdSchema
      .default(null),

    currency: z
      .enum(INVOICE_CURRENCIES)
      .default("INR"),

    issueDate: nullableDateSchema
      .default(null),

    dueDate: nullableDateSchema
      .default(null),

    items: z
      .array(invoiceItemSchema)
      .max(100)
      .default([]),

    discountAmount: moneySchema.default(0),

    billingDetails:
      billingDetailsSchema.optional(),

    notes: textSchema(5000).default(""),

    termsAndConditions:
      textSchema(5000).default(""),
  })
  .superRefine(validateDates);

// ======================================
// Update Draft Invoice
// PATCH /api/invoices/:id
// ======================================

export const updateInvoiceSchema = z
  .strictObject({
    client: objectIdSchema.optional(),

    project: optionalObjectIdSchema.optional(),

    issueDate: nullableDateSchema.optional(),

    dueDate: nullableDateSchema.optional(),

    items: z
      .array(invoiceItemSchema)
      .max(100)
      .optional(),

    discountAmount: moneySchema.optional(),

    billingDetails:
      billingDetailsSchema.partial().optional(),

    notes: textSchema(5000).optional(),

    termsAndConditions:
      textSchema(5000).optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message:
        "At least one field is required",
    }
  )
  .superRefine(validateDates);

// ======================================
// Issue Invoice
// PATCH /api/invoices/:id/issue
// ======================================

export const issueInvoiceSchema = z
  .strictObject({
    issueDate: dateTimeSchema,

    dueDate: dateTimeSchema,
  })
  .superRefine(validateDates);

// ======================================
// Cancel Invoice
// PATCH /api/invoices/:id/cancel
// ======================================

export const cancelInvoiceSchema =
  z.strictObject({
    reason: requiredTextSchema(3, 1000),
  });

// ======================================
// Invoice Payment Allocation
// POST /api/invoices/:id/payments
// ======================================

// Payments must reference an existing,
// verified Payment record.
//
// The controller must validate that:
// - Payment belongs to invoice client
// - Payment is completed/partially refunded
// - Amount does not exceed net receipts
// - Allocation is not duplicated
// - Invoice balance is sufficient

export const allocateInvoicePaymentSchema =
  z.strictObject({
    paymentId: objectIdSchema,

    amount: positiveMoneySchema,
  });

// ======================================
// Invoice Status Filter
// ======================================

export const invoiceStatusSchema =
  z.strictObject({
    status: z.enum(INVOICE_STATUSES),
  });

// ======================================
// Invoice List Filters
// GET /api/invoices
// ======================================

export const invoiceQuerySchema = z
  .strictObject({
    page: z.coerce
      .number()
      .int()
      .min(1)
      .max(100000)
      .default(1),

    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(10),

    search: z
      .string()
      .trim()
      .max(100)
      .default(""),

    client: objectIdSchema.optional(),

    project: objectIdSchema.optional(),

    status: z
      .enum(INVOICE_STATUSES)
      .optional(),

    currency: z
      .enum(INVOICE_CURRENCIES)
      .optional(),

    createdBy: objectIdSchema.optional(),

    fromDate: dateTimeSchema.optional(),

    toDate: dateTimeSchema.optional(),

    overdue: z
      .enum(["true", "false"])
      .optional(),

    sortBy: z
      .enum([
        "createdAt",
        "updatedAt",
        "invoiceNumber",
        "issueDate",
        "dueDate",
        "grandTotal",
        "paidAmount",
        "status",
      ])
      .default("createdAt"),

    sortOrder: z
      .enum(["asc", "desc"])
      .default("desc"),
  })
  .superRefine((data, ctx) => {
    if (
      data.fromDate &&
      data.toDate &&
      new Date(data.fromDate).getTime() >
        new Date(data.toDate).getTime()
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["toDate"],
        message:
          "End date must be after start date",
      });
    }
  });

// ======================================
// Invoice ID Validation
// ======================================

export const invoiceIdSchema =
  z.strictObject({
    id: objectIdSchema,
  });
