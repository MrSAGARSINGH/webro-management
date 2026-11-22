
import { Router } from "express";

import {
  getProjects,
  getProjectStats,
  getProjectById,
  createProject,
  updateProject,
  updateProjectStatus,
  addMilestone,
  updateMilestone,
  updateMilestoneStatus,
  deleteMilestone,
  deleteProject,
} from "../controllers/projectController.js";

import {
  protect,
  authorize,
} from "../middlewares/authMiddleware.js";

import { validateRequest } from "../middlewares/validateRequest.js";

import {
  createProjectSchema,
  updateProjectSchema,
  updateProjectStatusSchema,
  projectQuerySchema,
  projectIdSchema,
  projectMilestoneIdSchema,
  addMilestoneSchema,
  editMilestoneSchema,
  milestoneStatusSchema,
} from "../validators/projectValidator.js";

const router = Router();

// ======================================
// Authentication
// ======================================

router.use(protect);

// ======================================
// Project Statistics
// GET /api/projects/stats
// ======================================

router.get(
  "/stats",
  authorize("admin", "manager", "employee"),
  getProjectStats
);

// ======================================
// List Projects
// GET /api/projects
// ======================================

router.get(
  "/",
  authorize("admin", "manager", "employee"),
  validateRequest(projectQuerySchema, "query"),
  getProjects
);

// ======================================
// Create Project
// POST /api/projects
// ======================================

router.post(
  "/",
  authorize("admin", "manager"),
  validateRequest(createProjectSchema, "body"),
  createProject
);

// ======================================
// Get Single Project
// GET /api/projects/:id
// ======================================

router.get(
  "/:id",
  authorize("admin", "manager", "employee"),
  validateRequest(projectIdSchema, "params"),
  getProjectById
);

// ======================================
// Update Project
// PATCH /api/projects/:id
// ======================================

router.patch(
  "/:id",
  authorize("admin", "manager"),
  validateRequest(projectIdSchema, "params"),
  validateRequest(updateProjectSchema, "body"),
  updateProject
);

// ======================================
// Update Project Status
// PATCH /api/projects/:id/status
// ======================================

router.patch(
  "/:id/status",
  authorize("admin", "manager"),
  validateRequest(projectIdSchema, "params"),
  validateRequest(updateProjectStatusSchema, "body"),
  updateProjectStatus
);

// ======================================
// Add Milestone
// POST /api/projects/:id/milestones
// ======================================

router.post(
  "/:id/milestones",
  authorize("admin", "manager"),
  validateRequest(projectIdSchema, "params"),
  validateRequest(addMilestoneSchema, "body"),
  addMilestone
);

// ======================================
// Update Milestone
// PATCH /api/projects/:id/milestones/:milestoneId
// ======================================

router.patch(
  "/:id/milestones/:milestoneId",
  authorize("admin", "manager"),
  validateRequest(
    projectMilestoneIdSchema,
    "params"
  ),
  validateRequest(editMilestoneSchema, "body"),
  updateMilestone
);

// ======================================
// Update Milestone Status
// PATCH /api/projects/:id/milestones/:milestoneId/status
// ======================================

router.patch(
  "/:id/milestones/:milestoneId/status",
  authorize("admin", "manager", "employee"),
  validateRequest(
    projectMilestoneIdSchema,
    "params"
  ),
  validateRequest(milestoneStatusSchema, "body"),
  updateMilestoneStatus
);

// ======================================
// Delete Milestone
// DELETE /api/projects/:id/milestones/:milestoneId
// ======================================

router.delete(
  "/:id/milestones/:milestoneId",
  authorize("admin", "manager"),
  validateRequest(
    projectMilestoneIdSchema,
    "params"
  ),
  deleteMilestone
);

// ======================================
// Delete Project
// DELETE /api/projects/:id
// ======================================

router.delete(
  "/:id",
  authorize("admin"),
  validateRequest(projectIdSchema, "params"),
  deleteProject
);

export default router;
