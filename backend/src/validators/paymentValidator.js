
import { z } from "zod";

import {
  PAYMENT_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_TYPES,
  PAYMENT_CURRENCIES,
} from "../models/Payment.js";

// ======================================
// Reusable Validation Schemas
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

const identifierSchema = (maxLength) =>
  z
    .string()
    .trim()
    .min(1, "Identifier cannot be empty")
    .max(maxLength)
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9_./:@-]*$/,
      "Identifier contains invalid characters"
    );

const optionalIdentifier = (maxLength) =>
  z
    .union([
      identifierSchema(maxLength),
      z.null(),
      z.literal(""),
    ])
    .transform((value) =>
      value === "" ? null : value
    )
    .optional();

// ======================================
// Financial Amount Validation
// ======================================

// Current Payment model stores INR amounts
// as JavaScript numbers.
//
// For real financial processing, migrate
// to integer paise or Decimal128.

const amountSchema = z
  .number()
  .finite()
  .positive("Amount must be greater than zero")
  .max(
    999999999999,
    "Amount exceeds maximum allowed value"
  )
  .refine(
    (value) =>
      Math.abs(
        Math.round(value * 100) -
          value * 100
      ) < 0.000001,
    {
      message:
        "Amount must have at most two decimal places",
    }
  );

const refundAmountSchema = amountSchema;

// ======================================
// Payment Creation Fields
// ======================================

const paymentFields = {
  client: objectIdSchema,

  project: optionalObjectIdSchema
    .default(null),

  amount: amountSchema,

  currency: z
    .enum(PAYMENT_CURRENCIES)
    .default("INR"),

  paymentType: z.enum(PAYMENT_TYPES),

  paymentMethod: z.enum(PAYMENT_METHODS),

  transactionId: optionalIdentifier(150),

  referenceNumber: optionalIdentifier(100),

  gatewayProvider: textSchema(100)
    .default(""),

  gatewayPaymentId: optionalIdentifier(200),

  gatewayOrderId: optionalIdentifier(200),

  dueDate: nullableDateSchema.default(null),

  description: textSchema(2000).default(""),

  notes: textSchema(5000).default(""),
};

// ======================================
// Create Payment
// POST /api/payments
// ======================================

export const createPaymentSchema = z
  .strictObject(paymentFields)
  .superRefine((data, ctx) => {
    if (
      data.paymentMethod === "Payment Gateway" &&
      !data.gatewayProvider
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["gatewayProvider"],
        message:
          "Gateway provider is required for gateway payments",
      });
    }

    if (
      data.paymentMethod !== "Payment Gateway" &&
      (
        data.gatewayPaymentId ||
        data.gatewayOrderId
      )
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["paymentMethod"],
        message:
          "Gateway IDs require Payment Gateway method",
      });
    }
  });

// ======================================
// Update Payment
// PATCH /api/payments/:id
// ======================================

// Only non-financial fields are editable.

export const updatePaymentSchema = z
  .strictObject({
    dueDate: nullableDateSchema.optional(),

    description: textSchema(2000).optional(),

    notes: textSchema(5000).optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message:
        "At least one field must be provided",
    }
  );

// ======================================
// Verify Payment
// PATCH /api/payments/:id/verify
// ======================================

export const verifyPaymentSchema =
  z.strictObject({
    paymentDate: dateTimeSchema,

    notes: textSchema(5000).optional(),
  });

// ======================================
// Mark Payment Failed
// PATCH /api/payments/:id/fail
// ======================================

export const failPaymentSchema =
  z.strictObject({
    reason: z
      .string()
      .trim()
      .min(3, "Reason must be at least 3 characters")
      .max(1000),
  });

// ======================================
// Cancel Payment
// PATCH /api/payments/:id/cancel
// ======================================

export const cancelPaymentSchema =
  z.strictObject({
    reason: z
      .string()
      .trim()
      .min(3, "Reason must be at least 3 characters")
      .max(1000),
  });

// ======================================
// Refund Payment
// POST /api/payments/:id/refund
// ======================================

export const refundPaymentSchema =
  z.strictObject({
    amount: refundAmountSchema,

    reason: z
      .string()
      .trim()
      .min(
        3,
        "Refund reason must be at least 3 characters"
      )
      .max(1000),

    referenceNumber: identifierSchema(100),
  });

// ======================================
// Payment Filters
// GET /api/payments
// ======================================

export const paymentQuerySchema = z
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
      .enum(PAYMENT_STATUSES)
      .optional(),

    paymentMethod: z
      .enum(PAYMENT_METHODS)
      .optional(),

    paymentType: z
      .enum(PAYMENT_TYPES)
      .optional(),

    currency: z
      .enum(PAYMENT_CURRENCIES)
      .optional(),

    createdBy: objectIdSchema.optional(),

    verifiedBy: objectIdSchema.optional(),

    fromDate: dateTimeSchema.optional(),

    toDate: dateTimeSchema.optional(),

    overdue: z
      .enum(["true", "false"])
      .optional(),

    sortBy: z
      .enum([
        "createdAt",
        "updatedAt",
        "paymentDate",
        "dueDate",
        "amount",
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
// Payment ID Validation
// ======================================

export const paymentIdSchema =
  z.strictObject({
    id: objectIdSchema,
  });
