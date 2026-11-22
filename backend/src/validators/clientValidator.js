
import { z } from "zod";

import {
  CLIENT_STATUSES,
  CLIENT_SERVICES,
} from "../models/Client.js";

// -----------------------------
// Reusable validation schemas
// -----------------------------

const objectIdSchema = z
  .string()
  .regex(
    /^[a-fA-F0-9]{24}$/,
    "Invalid MongoDB ObjectId"
  );

const moneySchema = z
  .number()
  .finite()
  .nonnegative("Amount cannot be negative")
  .max(999999999999, "Amount is too large");

const optionalText = (maxLength) =>
  z.string().trim().max(maxLength);

const dateSchema = z
  .union([
    z.iso.date(),
    z.null(),
    z.literal(""),
  ])
  .transform((value) =>
    value === "" ? null : value
  );

const emailSchema = z
  .union([
    z.email().max(254),
    z.literal(""),
  ])
  .transform((value) =>
    value.trim().toLowerCase()
  );

// -----------------------------
// Client fields
// -----------------------------

const clientFields = {
  name: z
    .string()
    .trim()
    .min(2, "Client name must contain at least 2 characters")
    .max(100),

  company: optionalText(150).default(""),

  phone: z
    .string()
    .trim()
    .regex(
      /^[6-9]\d{9}$/,
      "Enter a valid 10-digit Indian mobile number"
    ),

  email: emailSchema.default(""),

  service: z.enum(CLIENT_SERVICES),

  status: z.enum(CLIENT_STATUSES).default("Active"),

  projectName: optionalText(200).default(""),

  contractAmount: moneySchema.default(0),

  receivedAmount: moneySchema.default(0),

  startDate: dateSchema.default(null),

  deadline: dateSchema.default(null),

  assignedTo: z
    .union([objectIdSchema, z.null()])
    .default(null),

  notes: optionalText(5000).default(""),
};

// -----------------------------
// Cross-field validation
// -----------------------------

const validateClientRules = (data, ctx) => {
  if (
    data.contractAmount !== undefined &&
    data.receivedAmount !== undefined &&
    data.receivedAmount > data.contractAmount
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["receivedAmount"],
      message:
        "Received amount cannot exceed contract amount",
    });
  }

  if (
    data.startDate &&
    data.deadline &&
    data.deadline < data.startDate
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["deadline"],
      message:
        "Deadline cannot be earlier than start date",
    });
  }
};

// -----------------------------
// POST /api/clients
// -----------------------------

export const createClientSchema = z
  .strictObject(clientFields)
  .superRefine(validateClientRules);

// -----------------------------
// PATCH /api/clients/:id
// -----------------------------

export const updateClientSchema = z
  .strictObject(clientFields)
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one field must be provided"
  )
  .superRefine(validateClientRules);

// -----------------------------
// GET /api/clients
// -----------------------------

export const clientQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(10),

  search: z
    .string()
    .trim()
    .max(100)
    .default(""),

  status: z.enum(CLIENT_STATUSES).optional(),

  service: z.enum(CLIENT_SERVICES).optional(),

  assignedTo: objectIdSchema.optional(),

  sortBy: z
    .enum([
      "createdAt",
      "name",
      "company",
      "contractAmount",
      "deadline",
    ])
    .default("createdAt"),

  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// -----------------------------
// GET / PATCH / DELETE by ID
// -----------------------------

export const clientIdSchema = z.strictObject({
  id: objectIdSchema,
});
