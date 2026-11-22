
import { z } from "zod";

import {
  PROJECT_STATUSES,
  PROJECT_PRIORITIES,
  PROJECT_TYPES,
  MILESTONE_STATUSES,
} from "../models/Project.js";

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

const dateSchema = z.iso.datetime({
  offset: true,
});

const optionalDateSchema = z
  .union([
    dateSchema,
    z.null(),
    z.literal(""),
  ])
  .transform((value) =>
    value === "" ? null : value
  );

const optionalUrlSchema = z
  .union([
    z.url({
      protocol: /^https?$/,
      hostname: z.regexes.domain,
    }).max(2048),
    z.literal(""),
  ])
  .default("");

const textSchema = (maxLength) =>
  z.string().trim().max(maxLength);

const projectNameSchema = z
  .string()
  .trim()
  .min(3, "Project name must contain at least 3 characters")
  .max(200, "Project name cannot exceed 200 characters");

const assignedEmployeesSchema = z
  .array(objectIdSchema)
  .max(100, "Maximum 100 employees per project")
  .refine(
    (ids) =>
      new Set(ids.map((id) => id.toLowerCase())).size ===
      ids.length,
    {
      message: "Duplicate employee assignments are not allowed",
    }
  );

// ======================================
// Milestone Schema
// ======================================

const milestoneFields = {
  title: z
    .string()
    .trim()
    .min(3)
    .max(150),

  description: textSchema(2000).default(""),

  dueDate: optionalDateSchema.default(null),

  order: z.number().int().min(0).default(0),
};

// New milestones always start as Pending.
// Completion is managed by the backend.

export const createMilestoneSchema =
  z.strictObject(milestoneFields);

export const updateMilestoneSchema =
  z.strictObject(milestoneFields)
    .partial()
    .refine(
      (data) => Object.keys(data).length > 0,
      {
        message: "At least one milestone field is required",
      }
    );

export const milestoneStatusSchema =
  z.strictObject({
    status: z.enum(MILESTONE_STATUSES),
  });

// ======================================
// Project Fields
// ======================================

const projectFields = {
  name: projectNameSchema,

  description: textSchema(5000).default(""),

  client: objectIdSchema,

  type: z.enum(PROJECT_TYPES),

  priority: z
    .enum(PROJECT_PRIORITIES)
    .default("Medium"),

  projectManager:
    optionalObjectIdSchema.default(null),

  assignedTo:
    assignedEmployeesSchema.default([]),

  startDate:
    optionalDateSchema.default(null),

  deadline:
    optionalDateSchema.default(null),

  budget: z
    .number()
    .finite()
    .min(0)
    .max(999999999999)
    .default(0),

  progress: z
    .number()
    .int()
    .min(0)
    .max(100)
    .default(0),

  milestones: z
    .array(createMilestoneSchema)
    .max(100)
    .default([]),

  repositoryUrl: optionalUrlSchema,

  liveUrl: optionalUrlSchema,

  notes: textSchema(5000).default(""),
};

// ======================================
// Shared Date Validation
// ======================================

const validateProjectDates = (data, ctx) => {
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
        "Deadline cannot be before project start date",
    });
  }

  if (!data.milestones) return;

  data.milestones.forEach((milestone, index) => {
    if (!milestone.dueDate) return;

    const due = new Date(milestone.dueDate).getTime();

    if (
      data.startDate &&
      due < new Date(data.startDate).getTime()
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["milestones", index, "dueDate"],
        message:
          "Milestone cannot be before project start date",
      });
    }

    if (
      data.deadline &&
      due > new Date(data.deadline).getTime()
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["milestones", index, "dueDate"],
        message:
          "Milestone cannot be after project deadline",
      });
    }
  });
};

// ======================================
// POST /api/projects
// ======================================

export const createProjectSchema = z
  .strictObject(projectFields)
  .superRefine(validateProjectDates);

// ======================================
// PATCH /api/projects/:id
// ======================================

// Existing milestones are managed through
// dedicated milestone endpoints, so normal
// project updates cannot replace the entire
// milestones array.

const {
  milestones: _milestones,
  ...updatableProjectFields
} = projectFields;

export const updateProjectSchema = z
  .strictObject(updatableProjectFields)
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: "At least one project field is required",
    }
  )
  .superRefine(validateProjectDates);

// ======================================
// PATCH /api/projects/:id/status
// ======================================

export const updateProjectStatusSchema =
  z.strictObject({
    status: z.enum(PROJECT_STATUSES),
  });

// ======================================
// POST /api/projects/:id/milestones
// ======================================

export const addMilestoneSchema =
  createMilestoneSchema;

// ======================================
// PATCH /api/projects/:id/milestones/:milestoneId
// ======================================

export const editMilestoneSchema =
  updateMilestoneSchema;

// ======================================
// GET /api/projects
// ======================================

export const projectQuerySchema = z
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

    projectManager: objectIdSchema.optional(),

    assignedTo: objectIdSchema.optional(),

    status: z.enum(PROJECT_STATUSES).optional(),

    priority: z
      .enum(PROJECT_PRIORITIES)
      .optional(),

    type: z.enum(PROJECT_TYPES).optional(),

    fromDate: dateSchema.optional(),

    toDate: dateSchema.optional(),

    overdue: z
      .enum(["true", "false"])
      .optional(),

    sortBy: z
      .enum([
        "name",
        "createdAt",
        "updatedAt",
        "deadline",
        "startDate",
        "budget",
        "progress",
        "priority",
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
// Project ID Validation
// ======================================

export const projectIdSchema =
  z.strictObject({
    id: objectIdSchema,
  });

// ======================================
// Milestone ID Validation
// ======================================

export const projectMilestoneIdSchema =
  z.strictObject({
    id: objectIdSchema,
    milestoneId: objectIdSchema,
  });
