
import { Router } from "express";

import {
  createCall,
  getCalls,
  getCallStats,
  getCallById,
  updateCall,
  deleteCall,
} from "../controllers/callController.js";

import {
  protect,
  authorize,
} from "../middlewares/authMiddleware.js";

import { validateRequest } from "../middlewares/validateRequest.js";

import {
  createCallSchema,
  updateCallSchema,
  callQuerySchema,
  callIdSchema,
} from "../validators/callValidator.js";

const router = Router();

// ======================================
// Authentication
// ======================================

// All calling endpoints require login.
router.use(protect);

// ======================================
// Calling Statistics
// ======================================

// GET /api/calls/stats
router.get(
  "/stats",
  authorize("admin", "manager", "employee"),
  getCallStats
);

// ======================================
// List Call History
// ======================================

// GET /api/calls
router.get(
  "/",
  authorize("admin", "manager", "employee"),
  validateRequest(callQuerySchema, "query"),
  getCalls
);

// ======================================
// Create Call Log
// ======================================

// POST /api/calls
router.post(
  "/",
  authorize("admin", "manager", "employee"),
  validateRequest(createCallSchema, "body"),
  createCall
);

// ======================================
// Get Single Call
// ======================================

// GET /api/calls/:id
router.get(
  "/:id",
  authorize("admin", "manager", "employee"),
  validateRequest(callIdSchema, "params"),
  getCallById
);

// ======================================
// Update Call
// ======================================

// PATCH /api/calls/:id
router.patch(
  "/:id",
  authorize("admin", "manager", "employee"),
  validateRequest(callIdSchema, "params"),
  validateRequest(updateCallSchema, "body"),
  updateCall
);

// ======================================
// Delete Call
// ======================================

// DELETE /api/calls/:id
router.delete(
  "/:id",
  authorize("admin", "manager"),
  validateRequest(callIdSchema, "params"),
  deleteCall
);

export default router;
