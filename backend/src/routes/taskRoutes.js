
import { Router } from "express";

// ======================================
// Task Controllers
// ======================================

import {
  getTasks,
  getTaskStats,
  getTaskById,
  createTask,
  updateTask,
  assignTask,
  updateTaskStatus,
  updateTaskProgress,
  updateTaskHours,
  addTaskChecklist,
  updateTaskChecklist,
  deleteTaskChecklist,
  deleteTask,
} from "../controllers/taskController.js";

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

import { validateRequest } from "../middlewares/validateRequest.js";

// ======================================
// Task Validators
// ======================================

import {
  createTaskSchema,
  updateTaskSchema,
  assignTaskSchema,
  updateTaskStatusSchema,
  updateTaskProgressSchema,
  updateTaskHoursSchema,
  addTaskChecklistSchema,
  updateTaskChecklistSchema,
  taskChecklistParamsSchema,
  taskQuerySchema,
  taskIdSchema,
} from "../validators/taskValidator.js";

// ======================================
// Initialize Router
// ======================================

const router = Router();

// ======================================
// Authentication
// ======================================

// Every task endpoint requires login.

router.use(protect);

// ======================================
// GET /api/tasks/stats
// ======================================

router.get(
  "/stats",
  getTaskStats
);

// ======================================
// GET /api/tasks
// ======================================

router.get(
  "/",
  validateRequest(taskQuerySchema, "query"),
  getTasks
);

// ======================================
// POST /api/tasks
// ======================================

router.post(
  "/",
  authorize("admin", "manager"),
  validateRequest(createTaskSchema, "body"),
  createTask
);

// ======================================
// GET /api/tasks/:id
// ======================================

router.get(
  "/:id",
  validateRequest(taskIdSchema, "params"),
  getTaskById
);

// ======================================
// PATCH /api/tasks/:id
// ======================================

router.patch(
  "/:id",
  validateRequest(taskIdSchema, "params"),
  validateRequest(updateTaskSchema, "body"),
  updateTask
);

// ======================================
// PATCH /api/tasks/:id/assign
// ======================================

router.patch(
  "/:id/assign",
  authorize("admin", "manager"),
  validateRequest(taskIdSchema, "params"),
  validateRequest(assignTaskSchema, "body"),
  assignTask
);

// ======================================
// PATCH /api/tasks/:id/status
// ======================================

router.patch(
  "/:id/status",
  validateRequest(taskIdSchema, "params"),
  validateRequest(
    updateTaskStatusSchema,
    "body"
  ),
  updateTaskStatus
);

// ======================================
// PATCH /api/tasks/:id/progress
// ======================================

router.patch(
  "/:id/progress",
  validateRequest(taskIdSchema, "params"),
  validateRequest(
    updateTaskProgressSchema,
    "body"
  ),
  updateTaskProgress
);

// ======================================
// PATCH /api/tasks/:id/hours
// ======================================

router.patch(
  "/:id/hours",
  validateRequest(taskIdSchema, "params"),
  validateRequest(
    updateTaskHoursSchema,
    "body"
  ),
  updateTaskHours
);

// ======================================
// POST /api/tasks/:id/checklist
// ======================================

router.post(
  "/:id/checklist",
  validateRequest(taskIdSchema, "params"),
  validateRequest(
    addTaskChecklistSchema,
    "body"
  ),
  addTaskChecklist
);

// ======================================
// PATCH /api/tasks/:id/checklist/:itemId
// ======================================

router.patch(
  "/:id/checklist/:itemId",
  validateRequest(
    taskChecklistParamsSchema,
    "params"
  ),
  validateRequest(
    updateTaskChecklistSchema,
    "body"
  ),
  updateTaskChecklist
);

// ======================================
// DELETE /api/tasks/:id/checklist/:itemId
// ======================================

router.delete(
  "/:id/checklist/:itemId",
  validateRequest(
    taskChecklistParamsSchema,
    "params"
  ),
  deleteTaskChecklist
);

// ======================================
// DELETE /api/tasks/:id
// ======================================

router.delete(
  "/:id",
  authorize("admin", "manager"),
  validateRequest(taskIdSchema, "params"),
  deleteTask
);

// ======================================
// Export Router
// ======================================

export default router;
