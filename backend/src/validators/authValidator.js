
import { z } from "zod";

// Shared validation rules
const emailSchema = z
  .email("Enter a valid email address")
  .max(254)
  .transform((email) => email.trim().toLowerCase());

const passwordSchema = z
  .string()
  .min(12, "Password must contain at least 12 characters")
  .refine(
    (password) => Buffer.byteLength(password, "utf8") <= 72,
    "Password must not exceed 72 UTF-8 bytes"
  );

const phoneSchema = z
  .string()
  .trim()
  .regex(
    /^$|^[6-9]\d{9}$/,
    "Enter a valid 10-digit Indian mobile number"
  );

// Login validation
export const loginSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

// Create employee/admin-managed account
export const createUserSchema = z.strictObject({
  name: z
    .string()
    .trim()
    .min(2, "Name must contain at least 2 characters")
    .max(100),

  email: emailSchema,

  password: passwordSchema,

  phone: phoneSchema.optional().default(""),

  role: z
    .enum(["admin", "manager", "employee"])
    .default("employee"),
});

// Change own password
export const changePasswordSchema = z.strictObject({
  currentPassword: z.string().min(1),

  newPassword: passwordSchema,
}).refine(
  (data) => data.currentPassword !== data.newPassword,
  {
    message: "New password must differ from current password",
    path: ["newPassword"],
  }
);
