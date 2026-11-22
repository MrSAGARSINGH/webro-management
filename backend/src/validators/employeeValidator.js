
import { z } from "zod";

import {
  EMPLOYEE_DEPARTMENTS,
  EMPLOYMENT_TYPES,
  EMPLOYEE_STATUSES,
  WORK_MODES,
  SALARY_TYPES,
} from "../models/Employee.js";

// ======================================
// Reusable Schemas
// ======================================

const objectIdSchema = z
  .string()
  .regex(
    /^[a-fA-F0-9]{24}$/,
    "Invalid MongoDB ObjectId"
  );

const nullableObjectIdSchema = z
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

const nullableDateSchema = z
  .union([
    dateSchema,
    z.null(),
    z.literal(""),
  ])
  .transform((value) =>
    value === "" ? null : value
  );

const optionalText = (max) =>
  z.string().trim().max(max);

const requiredText = (min, max) =>
  z.string().trim().min(min).max(max);

const phoneSchema = z
  .string()
  .trim()
  .regex(
    /^\+?[0-9\s()-]{7,20}$/,
    "Invalid phone number"
  );

const moneySchema = z
  .number()
  .finite()
  .min(0)
  .max(999999999999)
  .refine(
    (value) =>
      Number.isInteger(
        Math.round(value * 100)
      ) &&
      Math.abs(
        value * 100 -
          Math.round(value * 100)
      ) < 0.00001,
    {
      message:
        "Amount cannot exceed two decimal places",
    }
  );

// ======================================
// Salary Schema
// ======================================

export const employeeSalarySchema =
  z.strictObject({
    amount: moneySchema,

    currency: z
      .literal("INR")
      .default("INR"),

    type: z
      .enum(SALARY_TYPES)
      .default("Monthly"),
  });

// ======================================
// Emergency Contact Schema
// ======================================

export const emergencyContactSchema =
  z.strictObject({
    name: optionalText(100)
      .default(""),

    relationship: optionalText(50)
      .default(""),

    phone: z
      .union([
        phoneSchema,
        z.literal(""),
      ])
      .default(""),
  });

// ======================================
// Skills Schema
// ======================================

const skillsSchema = z
  .array(requiredText(1, 100))
  .max(50)
  .refine(
    (skills) =>
      new Set(
        skills.map((skill) =>
          skill.toLowerCase()
        )
      ).size === skills.length,
    {
      message:
        "Duplicate skills are not allowed",
    }
  );

// ======================================
// Shared Employment Date Validation
// ======================================

const validateEmploymentDates = (
  data,
  ctx
) => {
  const joiningDate = data.joiningDate
    ? new Date(data.joiningDate)
    : null;

  const confirmationDate =
    data.confirmationDate
      ? new Date(data.confirmationDate)
      : null;

  const exitDate = data.exitDate
    ? new Date(data.exitDate)
    : null;

  const dateOfBirth = data.dateOfBirth
    ? new Date(data.dateOfBirth)
    : null;

  if (
    joiningDate &&
    confirmationDate &&
    confirmationDate < joiningDate
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["confirmationDate"],
      message:
        "Confirmation date cannot be before joining date",
    });
  }

  if (
    joiningDate &&
    exitDate &&
    exitDate < joiningDate
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["exitDate"],
      message:
        "Exit date cannot be before joining date",
    });
  }

  if (
    dateOfBirth &&
    joiningDate &&
    dateOfBirth >= joiningDate
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["dateOfBirth"],
      message:
        "Date of birth must be before joining date",
    });
  }
};

// ======================================
// Create Employee
// POST /api/employees
// ======================================

export const createEmployeeSchema = z
  .strictObject({
    user: objectIdSchema,

    department: z.enum(
      EMPLOYEE_DEPARTMENTS
    ),

    designation: requiredText(2, 100),

    employmentType: z
      .enum(EMPLOYMENT_TYPES)
      .default("Full Time"),

    workMode: z
      .enum(WORK_MODES)
      .default("Office"),

    joiningDate: dateSchema,

    confirmationDate:
      nullableDateSchema.default(null),

    reportingManager:
      nullableObjectIdSchema.default(null),

    dateOfBirth:
      nullableDateSchema.default(null),

    gender: z
      .enum([
        "Male",
        "Female",
        "Other",
        "Prefer Not to Say",
      ])
      .nullable()
      .default(null),

    address: optionalText(500)
      .default(""),

    city: optionalText(100)
      .default(""),

    state: optionalText(100)
      .default(""),

    country: optionalText(100)
      .default("India"),

    salary: employeeSalarySchema
      .optional(),

    emergencyContact:
      emergencyContactSchema.optional(),

    skills: skillsSchema.default([]),

    notes: optionalText(5000)
      .default(""),
  })
  .superRefine((data, ctx) => {
    validateEmploymentDates(data, ctx);

    if (
      data.reportingManager &&
      data.reportingManager === data.user
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["reportingManager"],
        message:
          "An employee cannot be their own reporting manager",
      });
    }
  });

// ======================================
// Update Employee Profile
// PATCH /api/employees/:id
// ======================================

export const updateEmployeeSchema = z
  .strictObject({
    department: z
      .enum(EMPLOYEE_DEPARTMENTS)
      .optional(),

    designation: requiredText(2, 100)
      .optional(),

    employmentType: z
      .enum(EMPLOYMENT_TYPES)
      .optional(),

    workMode: z
      .enum(WORK_MODES)
      .optional(),

    joiningDate: dateSchema.optional(),

    confirmationDate:
      nullableDateSchema.optional(),

    reportingManager:
      nullableObjectIdSchema.optional(),

    dateOfBirth:
      nullableDateSchema.optional(),

    gender: z
      .enum([
        "Male",
        "Female",
        "Other",
        "Prefer Not to Say",
      ])
      .nullable()
      .optional(),

    address: optionalText(500)
      .optional(),

    city: optionalText(100)
      .optional(),

    state: optionalText(100)
      .optional(),

    country: optionalText(100)
      .optional(),

    emergencyContact:
      emergencyContactSchema.optional(),

    skills: skillsSchema.optional(),

    notes: optionalText(5000)
      .optional(),
  })
  .refine(
    (data) =>
      Object.keys(data).length > 0,
    {
      message:
        "At least one field is required",
    }
  )
  .superRefine(validateEmploymentDates);

// ======================================
// Update Employee Salary
// PATCH /api/employees/:id/salary
// ======================================

export const updateEmployeeSalarySchema =
  employeeSalarySchema;

// ======================================
// Update Employment Status
// PATCH /api/employees/:id/status
// ======================================

export const updateEmployeeStatusSchema =
  z
    .strictObject({
      status: z.enum(
        EMPLOYEE_STATUSES
      ),

      exitDate:
        nullableDateSchema.optional(),
    })
    .superRefine((data, ctx) => {
      const isExited = [
        "Resigned",
        "Terminated",
      ].includes(data.status);

      if (
        isExited &&
        !data.exitDate
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["exitDate"],
          message:
            "Exit date is required for resigned or terminated employees",
        });
      }

      if (
        !isExited &&
        data.exitDate
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["exitDate"],
          message:
            "Exit date is only allowed for resigned or terminated employees",
        });
      }
    });

// ======================================
// Update Reporting Manager
// PATCH /api/employees/:id/manager
// ======================================

export const updateReportingManagerSchema =
  z.strictObject({
    reportingManager:
      nullableObjectIdSchema,
  });

// ======================================
// Employee Query
// GET /api/employees
// ======================================

export const employeeQuerySchema = z
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

    department: z
      .enum(EMPLOYEE_DEPARTMENTS)
      .optional(),

    employmentType: z
      .enum(EMPLOYMENT_TYPES)
      .optional(),

    status: z
      .enum(EMPLOYEE_STATUSES)
      .optional(),

    workMode: z
      .enum(WORK_MODES)
      .optional(),

    reportingManager:
      objectIdSchema.optional(),

    fromDate: dateSchema.optional(),

    toDate: dateSchema.optional(),

    sortBy: z
      .enum([
        "createdAt",
        "updatedAt",
        "employeeId",
        "designation",
        "department",
        "joiningDate",
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
      new Date(data.fromDate) >
        new Date(data.toDate)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["toDate"],
        message:
          "End date cannot be before start date",
      });
    }
  });

// ======================================
// Employee ID Params
// ======================================

export const employeeIdSchema =
  z.strictObject({
    id: objectIdSchema,
  });
