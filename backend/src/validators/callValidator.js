
import { z } from "zod";

import {
  CALL_DIRECTIONS,
  CALL_STATUSES,
  CALL_OUTCOMES,
  CALL_CONTACT_TYPES,
} from "../models/Call.js";

// ======================================
// Reusable Schemas
// ======================================

const objectIdSchema = z
  .string()
  .regex(
    /^[a-fA-F0-9]{24}$/,
    "Invalid MongoDB ObjectId"
  );

const optionalObjectIdSchema = z
  .union([
    objectIdSchema,
    z.null(),
    z.literal(""),
  ])
  .transform((value) => value === "" ? null : value);

const dateTimeSchema = z.iso.datetime({
  offset: true,
});

const optionalDateTimeSchema = z
  .union([
    dateTimeSchema,
    z.null(),
    z.literal(""),
  ])
  .transform((value) => value === "" ? null : value);

const phoneSchema = z
  .string()
  .trim()
  .regex(
    /^[6-9]\d{9}$/,
    "Enter a valid 10-digit Indian mobile number"
  );

const notesSchema = z
  .string()
  .trim()
  .max(5000, "Notes cannot exceed 5000 characters");

const durationSchema = z
  .number()
  .int("Duration must be a whole number")
  .min(0, "Duration cannot be negative")
  .max(86400, "Duration cannot exceed 24 hours");

// ======================================
// Call Fields
// ======================================

const callFields = {
  contactType: z.enum(CALL_CONTACT_TYPES),

  lead: optionalObjectIdSchema.default(null),

  client: optionalObjectIdSchema.default(null),

  contactName: z
    .string()
    .trim()
    .min(2, "Contact name must contain at least 2 characters")
    .max(100, "Contact name cannot exceed 100 characters"),

  phone: phoneSchema,

  direction: z.enum(CALL_DIRECTIONS).default("Outgoing"),

  status: z.enum(CALL_STATUSES),

  outcome: z.enum(CALL_OUTCOMES).default("Other"),

  durationSeconds: durationSchema.default(0),

  calledAt: dateTimeSchema.optional(),

  nextFollowUp: optionalDateTimeSchema.default(null),

  notes: notesSchema.default(""),
};

// ======================================
// Cross-field Validation
// ======================================

const validateCallRules = (data, ctx) => {
  if (data.contactType === "Lead") {
    if (!data.lead) {
      ctx.addIssue({
        code: "custom",
        path: ["lead"],
        message: "Lead ID is required for a Lead call",
      });
    }

    if (data.client) {
      ctx.addIssue({
        code: "custom",
        path: ["client"],
        message: "Client must be empty for a Lead call",
      });
    }
  }

  if (data.contactType === "Client") {
    if (!data.client) {
      ctx.addIssue({
        code: "custom",
        path: ["client"],
        message: "Client ID is required for a Client call",
      });
    }

    if (data.lead) {
      ctx.addIssue({
        code: "custom",
        path: ["lead"],
        message: "Lead must be empty for a Client call",
      });
    }
  }

  if (
    data.status &&
    data.status !== "Completed" &&
    data.durationSeconds > 0
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["durationSeconds"],
      message: "Only completed calls can have a duration",
    });
  }

  if (
    data.status &&
    data.status !== "Completed" &&
    data.outcome &&
    !["Other", "No Response"].includes(data.outcome)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["outcome"],
      message: "This outcome requires a completed call",
    });
  }

  if (
    data.calledAt &&
    data.nextFollowUp &&
    new Date(data.nextFollowUp).getTime() <=
      new Date(data.calledAt).getTime()
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["nextFollowUp"],
      message: "Follow-up must be after the call date",
    });
  }
};

// ======================================
// POST /api/calls
// ======================================

export const createCallSchema = z
  .strictObject(callFields)
  .superRefine(validateCallRules);

// ======================================
// PATCH /api/calls/:id
// ======================================

export const updateCallSchema = z
  .strictObject(callFields)
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: "At least one field must be provided",
    }
  )
  .superRefine(validateCallRules);

// ======================================
// GET /api/calls
// ======================================

export const callQuerySchema = z.strictObject({
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

  contactType: z.enum(CALL_CONTACT_TYPES).optional(),

  direction: z.enum(CALL_DIRECTIONS).optional(),

  status: z.enum(CALL_STATUSES).optional(),

  outcome: z.enum(CALL_OUTCOMES).optional(),

  lead: objectIdSchema.optional(),

  client: objectIdSchema.optional(),

  calledBy: objectIdSchema.optional(),

  fromDate: dateTimeSchema.optional(),

  toDate: dateTimeSchema.optional(),

  sortBy: z
    .enum([
      "calledAt",
      "createdAt",
      "updatedAt",
      "durationSeconds",
      "contactName",
    ])
    .default("calledAt"),

  sortOrder: z
    .enum(["asc", "desc"])
    .default("desc"),
}).superRefine((data, ctx) => {
  if (
    data.fromDate &&
    data.toDate &&
    new Date(data.fromDate).getTime() >
      new Date(data.toDate).getTime()
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["toDate"],
      message: "End date must be after start date",
    });
  }
});

// ======================================
// GET /api/calls/:id
// PATCH /api/calls/:id
// DELETE /api/calls/:id
// ======================================

export const callIdSchema = z.strictObject({
  id: objectIdSchema,
});
