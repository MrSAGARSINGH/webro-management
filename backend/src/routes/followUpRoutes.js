import { Router } from "express";

import {
  createFollowUp,
  getFollowUps,
  getFollowUpStats,
  getFollowUpById,
  updateFollowUp,
  updateFollowUpStatus,
  deleteFollowUp,
} from "../controllers/followUpController.js";

import {
  protect,
  authorize,
} from "../middlewares/authMiddleware.js";

import { validateRequest } from "../middlewares/validateRequest.js";

import {
  createFollowUpSchema,
  updateFollowUpSchema,
  updateFollowUpStatusSchema,
  followUpQuerySchema,
  followUpIdSchema,
} from "../validators/followUpValidator.js";

const router = Router();

// ======================================
// Authentication
// ======================================

router.use(protect);

// ======================================
// Follow-up Statistics
// ======================================

// GET /api/follow-ups/stats

router.get(
  "/stats",
  authorize("admin", "manager", "employee"),
  getFollowUpStats
);

// ======================================
// Get All Follow-ups
// ======================================

// GET /api/follow-ups

router.get(
  "/",
  authorize("admin", "manager", "employee"),
  validateRequest(followUpQuerySchema, "query"),
  getFollowUps
);

// ======================================
// Create Follow-up
// ======================================

// POST /api/follow-ups

router.post(
  "/",
  authorize("admin", "manager", "employee"),
  validateRequest(createFollowUpSchema, "body"),
  createFollowUp
);

// ======================================
// Get Single Follow-up
// ======================================

// GET /api/follow-ups/:id

router.get(
  "/:id",
  authorize("admin", "manager", "employee"),
  validateRequest(followUpIdSchema, "params"),
  getFollowUpById
);

// ======================================
// Update Follow-up
// ======================================

// PATCH /api/follow-ups/:id

router.patch(
  "/:id",
  authorize("admin", "manager", "employee"),
  validateRequest(followUpIdSchema, "params"),
  validateRequest(updateFollowUpSchema, "body"),
  updateFollowUp
);

// ======================================
// Update Follow-up Status
// ======================================

// PATCH /api/follow-ups/:id/status

router.patch(
  "/:id/status",
  authorize("admin", "manager", "employee"),
  validateRequest(followUpIdSchema, "params"),
  validateRequest(updateFollowUpStatusSchema, "body"),
  updateFollowUpStatus
);

// ======================================
// Delete Follow-up
// ======================================

// DELETE /api/follow-ups/:id

router.delete(
  "/:id",
  authorize("admin", "manager"),
  validateRequest(followUpIdSchema, "params"),
  deleteFollowUp
);

export default router;