
import { Router } from "express";

import {
  createLead,
  getLeads,
  getLeadStats,
  getLeadById,
  updateLead,
  deleteLead,
  convertLead,
} from "../controllers/leadController.js";

import {
  protect,
  authorize,
} from "../middlewares/authMiddleware.js";

import { validateRequest } from "../middlewares/validateRequest.js";

import {
  createLeadSchema,
  updateLeadSchema,
  leadQuerySchema,
  leadIdSchema,
  convertLeadSchema,
} from "../validators/leadValidator.js";

const router = Router();

// ======================================
// Authentication
// ======================================

// All lead endpoints require login
router.use(protect);

// ======================================
// Lead Statistics
// ======================================

// GET /api/leads/stats
router.get(
  "/stats",
  authorize("admin", "manager", "employee"),
  getLeadStats
);

// ======================================
// List Leads
// ======================================

// GET /api/leads
router.get(
  "/",
  authorize("admin", "manager", "employee"),
  validateRequest(leadQuerySchema, "query"),
  getLeads
);

// ======================================
// Create Lead
// ======================================

// POST /api/leads
router.post(
  "/",
  authorize("admin", "manager", "employee"),
  validateRequest(createLeadSchema, "body"),
  createLead
);

// ======================================
// Get Single Lead
// ======================================

// GET /api/leads/:id
router.get(
  "/:id",
  authorize("admin", "manager", "employee"),
  validateRequest(leadIdSchema, "params"),
  getLeadById
);

// ======================================
// Update Lead
// ======================================

// PATCH /api/leads/:id
router.patch(
  "/:id",
  authorize("admin", "manager", "employee"),
  validateRequest(leadIdSchema, "params"),
  validateRequest(updateLeadSchema, "body"),
  updateLead
);

// ======================================
// Delete Lead
// ======================================

// DELETE /api/leads/:id
router.delete(
  "/:id",
  authorize("admin", "manager"),
  validateRequest(leadIdSchema, "params"),
  deleteLead
);

// ======================================
// Convert Lead to Client
// ======================================

// POST /api/leads/:id/convert
router.post(
  "/:id/convert",
  authorize("admin", "manager"),
  validateRequest(leadIdSchema, "params"),
  validateRequest(convertLeadSchema, "body"),
  convertLead
);

export default router;
