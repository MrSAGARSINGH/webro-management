
import { z } from "zod";

import {
  TASK_STATUSES,
  TASK_PRIORITIES,
  TASK_TYPES,
} from "../models/Task.js";

// ======================================
// Reusable Validation Schemas
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

const nullableDateSchema = z
  .union([
    dateTimeSchema,
    z.null(),
    z.literal(""),
  ])
  .transform((value) =>
    value === "" ? null : value
  );

const requiredText = (min, max) =>
  z.string().trim().min(min).max(max);

const optionalText = (max) =>
  z.string().trim().max(max);

const hoursSchema = z
  .number()
  .finite()
  .min(0)
  .max(100000);

const progressSchema = z
  .number()
  .int()
  .min(0)
  .max(100);

// ======================================
// Task Checklist Item
// ======================================

export const taskChecklistItemSchema =
  z.strictObject({
    title: requiredText(2, 200),

    isCompleted: z
      .boolean()
      .default(false),
  });

// ======================================
// Task Tags
// ======================================

const taskTagsSchema = z
  .array(requiredText(1, 50))
  .max(20)
  .refine(
    (tags) =>
      new Set(
        tags.map((tag) =>
          tag.toLowerCase()
        )
      ).size === tags.length,
    {
      message:
        "Duplicate task tags are not allowed",
    }
  );

// ======================================
// Date Validation
// ======================================

const validateTaskDates = (data, ctx) => {
  if (
    data.startDate &&
    data.dueDate &&
    new Date(data.dueDate).getTime() <
      new Date(data.startDate).getTime()
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["dueDate"],
      message:
        "Due date cannot be before start date",
    });
  }
};

// ======================================
// Create Task
// POST /api/tasks
// ======================================

export const createTaskSchema = z
  .strictObject({
    title: requiredText(3, 200),

    description: optionalText(10000)
      .default(""),

    project: objectIdSchema,

    assignedTo:
      optionalObjectIdSchema.default(null),

    type: z
      .enum(TASK_TYPES)
      .default("Other"),

    priority: z
      .enum(TASK_PRIORITIES)
      .default("Medium"),

    startDate:
      nullableDateSchema.default(null),

    dueDate:
      nullableDateSchema.default(null),

    estimatedHours:
      hoursSchema.default(0),

    checklist: z
      .array(taskChecklistItemSchema)
      .max(100)
      .default([]),

    tags: taskTagsSchema.default([]),

    notes: optionalText(5000)
      .default(""),
  })
  .superRefine(validateTaskDates);

// ======================================
// Update Task
// PATCH /api/tasks/:id
// ======================================

export const updateTaskSchema = z
  .strictObject({
    title: requiredText(3, 200)
      .optional(),

    description:
      optionalText(10000).optional(),

    type: z.enum(TASK_TYPES).optional(),

    priority: z
      .enum(TASK_PRIORITIES)
      .optional(),

    startDate:
      nullableDateSchema.optional(),

    dueDate:
      nullableDateSchema.optional(),

    estimatedHours:
      hoursSchema.optional(),

    notes: optionalText(5000)
      .optional(),

    tags: taskTagsSchema.optional(),
  })
  .refine(
    (data) =>
      Object.keys(data).length > 0,
    {
      message:
        "At least one field is required",
    }
  )
  .superRefine(validateTaskDates);

// ======================================
// Assign Task
// PATCH /api/tasks/:id/assign
// ======================================

export const assignTaskSchema =
  z.strictObject({
    assignedTo: optionalObjectIdSchema,
  });

// ======================================
// Update Task Status
// PATCH /api/tasks/:id/status
// ======================================

export const updateTaskStatusSchema =
  z
    .strictObject({
      status: z.enum(TASK_STATUSES),

      progress:
        progressSchema.optional(),
    })
    .superRefine((data, ctx) => {
      if (
        data.status === "Completed" &&
        data.progress !== undefined &&
        data.progress !== 100
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["progress"],
          message:
            "Completed tasks must have 100% progress",
        });
      }

      if (
        data.status !== "Completed" &&
        data.progress === 100
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["progress"],
          message:
            "Only completed tasks can have 100% progress",
        });
      }
    });

// ======================================
// Update Task Progress
// PATCH /api/tasks/:id/progress
// ======================================

export const updateTaskProgressSchema =
  z.strictObject({
    progress: progressSchema,
  });

// ======================================
// Add Checklist Item
// POST /api/tasks/:id/checklist
// ======================================

export const addTaskChecklistSchema =
  z.strictObject({
    title: requiredText(2, 200),
  });

// ======================================
// Update Checklist Item
// PATCH /api/tasks/:id/checklist/:itemId
// ======================================

export const updateTaskChecklistSchema =
  z
    .strictObject({
      title: requiredText(2, 200)
        .optional(),

      isCompleted: z
        .boolean()
        .optional(),
    })
    .refine(
      (data) =>
        Object.keys(data).length > 0,
      {
        message:
          "At least one field is required",
      }
    );

// ======================================
// Checklist Item ID
// ======================================

export const taskChecklistParamsSchema =
  z.strictObject({
    id: objectIdSchema,

    itemId: objectIdSchema,
  });

// ======================================
// Task Time Tracking
// PATCH /api/tasks/:id/hours
// ======================================

export const updateTaskHoursSchema =
  z.strictObject({
    actualHours: hoursSchema,
  });

// ======================================
// Task List Query
// GET /api/tasks
// ======================================

export const taskQuerySchema = z
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

    project: objectIdSchema.optional(),

    assignedTo: objectIdSchema.optional(),

    createdBy: objectIdSchema.optional(),

    status: z
      .enum(TASK_STATUSES)
      .optional(),

    priority: z
      .enum(TASK_PRIORITIES)
      .optional(),

    type: z.enum(TASK_TYPES).optional(),

    overdue: z
      .enum(["true", "false"])
      .optional(),

    fromDate:
      dateTimeSchema.optional(),

    toDate:
      dateTimeSchema.optional(),

    sortBy: z
      .enum([
        "createdAt",
        "updatedAt",
        "title",
        "priority",
        "status",
        "startDate",
        "dueDate",
        "progress",
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
// Task ID Validation
// ======================================

export const taskIdSchema =
  z.strictObject({
    id: objectIdSchema,
  });
