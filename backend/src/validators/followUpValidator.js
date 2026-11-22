
import { z } from "zod";

import {
  FOLLOW_UP_CONTACT_TYPES,
  FOLLOW_UP_STATUSES,
  FOLLOW_UP_PRIORITIES,
  FOLLOW_UP_TYPES,
} from "../models/FollowUp.js";

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
  .transform((value) =>
    value === "" ? null : value
  );

const dateTimeSchema = z.iso.datetime({
  offset: true,
});

const optionalDateTimeSchema = z
  .union([
    dateTimeSchema,
    z.null(),
    z.literal(""),
  ])
  .transform((value) =>
    value === "" ? null : value
  );

const textSchema = (maxLength) =>
  z.string().trim().max(maxLength);

// ======================================
// Follow-up Fields
// ======================================

const followUpFields = {
  contactType: z.enum(FOLLOW_UP_CONTACT_TYPES),

  lead: optionalObjectIdSchema.default(null),

  client: optionalObjectIdSchema.default(null),

  call: optionalObjectIdSchema.default(null),

  title: z
    .string()
    .trim()
    .min(3, "Title must contain at least 3 characters")
    .max(200, "Title cannot exceed 200 characters"),

  description: textSchema(5000).default(""),

  type: z.enum(FOLLOW_UP_TYPES).default("Call"),

  priority: z
    .enum(FOLLOW_UP_PRIORITIES)
    .default("Medium"),

  scheduledAt: dateTimeSchema,

  reminderAt: optionalDateTimeSchema.default(null),

  assignedTo: objectIdSchema,
};

// ======================================
// Shared Cross-field Validation
// ======================================

const validateFollowUpRules = (data, ctx) => {
  if (data.contactType === "Lead") {
    if (!data.lead) {
      ctx.addIssue({
        code: "custom",
        path: ["lead"],
        message: "Lead ID is required",
      });
    }

    if (data.client) {
      ctx.addIssue({
        code: "custom",
        path: ["client"],
        message: "Client must be empty for a Lead follow-up",
      });
    }
  }

  if (data.contactType === "Client") {
    if (!data.client) {
      ctx.addIssue({
        code: "custom",
        path: ["client"],
        message: "Client ID is required",
      });
    }

    if (data.lead) {
      ctx.addIssue({
        code: "custom",
        path: ["lead"],
        message: "Lead must be empty for a Client follow-up",
      });
    }
  }

  if (
    data.reminderAt &&
    data.scheduledAt &&
    new Date(data.reminderAt).getTime() >
      new Date(data.scheduledAt).getTime()
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["reminderAt"],
      message:
        "Reminder cannot be after scheduled time",
    });
  }
};

// ======================================
// POST /api/follow-ups
// ======================================

export const createFollowUpSchema = z
  .strictObject(followUpFields)
  .superRefine(validateFollowUpRules);

// ======================================
// PATCH /api/follow-ups/:id
// ======================================

export const updateFollowUpSchema = z
  .strictObject(followUpFields)
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: "At least one field must be provided",
    }
  )
  .superRefine(validateFollowUpRules);

// ======================================
// PATCH /api/follow-ups/:id/status
// ======================================

export const updateFollowUpStatusSchema =
  z.discriminatedUnion("status", [
    z.strictObject({
      status: z.literal("Pending"),
    }),

    z.strictObject({
      status: z.literal("In Progress"),
    }),

    z.strictObject({
      status: z.literal("Completed"),
      completionNotes: textSchema(5000).default(""),
    }),

    z.strictObject({
      status: z.literal("Cancelled"),
      cancellationReason: textSchema(1000).default(""),
    }),
  ]);

// ======================================
// GET /api/follow-ups
// ======================================

export const followUpQuerySchema = z
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

    status: z.enum(FOLLOW_UP_STATUSES).optional(),

    priority: z
      .enum(FOLLOW_UP_PRIORITIES)
      .optional(),

    type: z.enum(FOLLOW_UP_TYPES).optional(),

    contactType: z
      .enum(FOLLOW_UP_CONTACT_TYPES)
      .optional(),

    lead: objectIdSchema.optional(),

    client: objectIdSchema.optional(),

    call: objectIdSchema.optional(),

    assignedTo: objectIdSchema.optional(),

    fromDate: dateTimeSchema.optional(),

    toDate: dateTimeSchema.optional(),

    due: z
      .enum(["today", "upcoming", "overdue"])
      .optional(),

    sortBy: z
      .enum([
        "scheduledAt",
        "createdAt",
        "updatedAt",
        "priority",
        "status",
        "title",
      ])
      .default("scheduledAt"),

    sortOrder: z
      .enum(["asc", "desc"])
      .default("asc"),
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

    if (
      data.due &&
      (data.fromDate || data.toDate)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["due"],
        message:
          "Use either a due filter or a custom date range",
      });
    }
  });

// ======================================
// Follow-up ID Validation
// ======================================

export const followUpIdSchema = z.strictObject({
  id: objectIdSchema,
});
