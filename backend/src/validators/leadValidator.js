
import { z } from "zod";

import {
  LEAD_STATUSES,
  LEAD_SOURCES,
  LEAD_PRIORITIES,
  LEAD_SERVICES,
} from "../models/Lead.js";

// ======================================
// 1. Reusable Validation Schemas
// ======================================

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

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine(
    (value) =>
      value === "" ||
      (value.length <= 254 &&
        z.email().safeParse(value).success),
    "Enter a valid email address"
  );

const dateSchema = z
  .union([
    z.iso.datetime({ offset: true }),
    z.iso.date(),
    z.null(),
    z.literal(""),
  ])
  .transform((value) =>
    value === "" ? null : value
  );

const assignedUserSchema = z
  .union([
    objectIdSchema,
    z.null(),
    z.literal(""),
  ])
  .transform((value) =>
    value === "" ? null : value
  );

// ======================================
// 2. Lead Fields
// ======================================

const leadFields = {
  name: z
    .string()
    .trim()
    .min(2, "Lead name must contain at least 2 characters")
    .max(100, "Lead name cannot exceed 100 characters"),

  company: optionalText(150).default(""),

  phone: z
    .string()
    .trim()
    .regex(
      /^[6-9]\d{9}$/,
      "Enter a valid 10-digit Indian mobile number"
    ),

  email: emailSchema.default(""),

  service: z.enum(LEAD_SERVICES),

  source: z.enum(LEAD_SOURCES).default("Other"),

  status: z.enum(LEAD_STATUSES).default("New"),

  priority: z.enum(LEAD_PRIORITIES).default("Medium"),

  estimatedValue: moneySchema.default(0),

  assignedTo: assignedUserSchema.default(null),

  nextFollowUp: dateSchema.default(null),

  lastContactedAt: dateSchema.default(null),

  notes: optionalText(5000).default(""),

  lostReason: optionalText(1000).default(""),
};

// ======================================
// 3. Cross-field Validation
// ======================================

const validateLeadRules = (data, ctx) => {
  // Lead conversion must use the dedicated
  // conversion endpoint.
  if (data.status === "Converted") {
    ctx.addIssue({
      code: "custom",
      path: ["status"],
      message:
        "Use the lead conversion endpoint to convert a lead",
    });
  }

  // Lost reason is meaningful only for lost leads.
  if (
    data.lostReason &&
    data.status !== undefined &&
    data.status !== "Lost"
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["lostReason"],
      message:
        "Lost reason can only be set for a Lost lead",
    });
  }
};

// ======================================
// 4. POST /api/leads
// ======================================

export const createLeadSchema = z
  .strictObject(leadFields)
  .superRefine(validateLeadRules);

// ======================================
// 5. PATCH /api/leads/:id
// ======================================

export const updateLeadSchema = z
  .strictObject(leadFields)
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: "At least one field must be provided",
    }
  )
  .superRefine(validateLeadRules);

// ======================================
// 6. GET /api/leads
// ======================================

export const leadQuerySchema = z.strictObject({
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

  status: z.enum(LEAD_STATUSES).optional(),

  source: z.enum(LEAD_SOURCES).optional(),

  priority: z.enum(LEAD_PRIORITIES).optional(),

  service: z.enum(LEAD_SERVICES).optional(),

  assignedTo: objectIdSchema.optional(),

  sortBy: z
    .enum([
      "createdAt",
      "updatedAt",
      "name",
      "estimatedValue",
      "nextFollowUp",
      "priority",
    ])
    .default("createdAt"),

  sortOrder: z
    .enum(["asc", "desc"])
    .default("desc"),
});

// ======================================
// 7. Lead ID Validation
// ======================================

export const leadIdSchema = z.strictObject({
  id: objectIdSchema,
});

// ======================================
// 8. POST /api/leads/:id/convert
// ======================================

export const convertLeadSchema = z.strictObject({
  projectName: optionalText(200).default(""),

  contractAmount: moneySchema,

  startDate: dateSchema.default(null),

  deadline: dateSchema.default(null),

  notes: optionalText(5000).default(""),
}).superRefine((data, ctx) => {
  if (
    data.startDate &&
    data.deadline &&
    new Date(data.deadline).getTime() <
      new Date(data.startDate).getTime()
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["deadline"],
      message:
        "Deadline cannot be earlier than start date",
    });
  }
});
