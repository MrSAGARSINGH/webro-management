
import { Router } from "express";

// ======================================
// Employee Controllers
// ======================================

import {
  getEmployees,
  getEmployeeStats,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  updateEmployeeSalary,
  updateEmployeeStatus,
  updateReportingManager,
  deleteEmployee,
} from "../controllers/employeeController.js";

// ======================================
// Authentication Middleware
// ======================================

import {
  protect,
  authorize,
} from "../middlewares/authMiddleware.js";

// ======================================
// Validation Middleware
// ======================================

import {
  validateRequest,
} from "../middlewares/validateRequest.js";

// ======================================
// Employee Validators
// ======================================

import {
  createEmployeeSchema,
  updateEmployeeSchema,
  updateEmployeeSalarySchema,
  updateEmployeeStatusSchema,
  updateReportingManagerSchema,
  employeeQuerySchema,
  employeeIdSchema,
} from "../validators/employeeValidator.js";

// ======================================
// Initialize Router
// ======================================

const router = Router();

// ======================================
// Authentication Required
// ======================================

// All employee endpoints require login.

router.use(protect);

// ======================================
// GET /api/employees/stats
// ======================================

router.get(
  "/stats",
  authorize("admin", "manager"),
  getEmployeeStats
);

// ======================================
// GET /api/employees
// ======================================

router.get(
  "/",
  validateRequest(employeeQuerySchema, "query"),
  getEmployees
);

// ======================================
// POST /api/employees
// ======================================

router.post(
  "/",
  authorize("admin"),
  validateRequest(createEmployeeSchema, "body"),
  createEmployee
);

// ======================================
// GET /api/employees/:id
// ======================================

router.get(
  "/:id",
  validateRequest(employeeIdSchema, "params"),
  getEmployeeById
);

// ======================================
// PATCH /api/employees/:id
// ======================================

router.patch(
  "/:id",
  authorize("admin"),
  validateRequest(employeeIdSchema, "params"),
  validateRequest(updateEmployeeSchema, "body"),
  updateEmployee
);

// ======================================
// PATCH /api/employees/:id/salary
// ======================================

router.patch(
  "/:id/salary",
  authorize("admin"),
  validateRequest(employeeIdSchema, "params"),
  validateRequest(
    updateEmployeeSalarySchema,
    "body"
  ),
  updateEmployeeSalary
);

// ======================================
// PATCH /api/employees/:id/status
// ======================================

router.patch(
  "/:id/status",
  authorize("admin"),
  validateRequest(employeeIdSchema, "params"),
  validateRequest(
    updateEmployeeStatusSchema,
    "body"
  ),
  updateEmployeeStatus
);

// ======================================
// PATCH /api/employees/:id/manager
// ======================================

router.patch(
  "/:id/manager",
  authorize("admin"),
  validateRequest(employeeIdSchema, "params"),
  validateRequest(
    updateReportingManagerSchema,
    "body"
  ),
  updateReportingManager
);

// ======================================
// DELETE /api/employees/:id
// ======================================

// Historical employee records are preserved.
// Controller intentionally rejects deletion.

router.delete(
  "/:id",
  authorize("admin"),
  validateRequest(employeeIdSchema, "params"),
  deleteEmployee
);

// ======================================
// Export Router
// ======================================

export default router;
