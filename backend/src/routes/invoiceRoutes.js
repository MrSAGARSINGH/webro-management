
import { Router } from "express";

// ======================================
// Invoice Controllers
// ======================================

import {
  getInvoices,
  getInvoiceStats,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  issueInvoice,
  cancelInvoice,
  allocateInvoicePayment,
} from "../controllers/invoiceController.js";

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
// Invoice Validators
// ======================================

import {
  createInvoiceSchema,
  updateInvoiceSchema,
  issueInvoiceSchema,
  cancelInvoiceSchema,
  allocateInvoicePaymentSchema,
  invoiceQuerySchema,
  invoiceIdSchema,
} from "../validators/invoiceValidator.js";

// ======================================
// Initialize Router
// ======================================

const router = Router();

// ======================================
// Authentication
// ======================================

// All invoice routes require JWT login.

router.use(protect);

// Invoice financial data is restricted
// to Admin and Manager roles.

router.use(authorize("admin", "manager"));

// ======================================
// GET /api/invoices/stats
// ======================================

router.get(
  "/stats",
  getInvoiceStats
);

// ======================================
// GET /api/invoices
// ======================================

router.get(
  "/",
  validateRequest(invoiceQuerySchema, "query"),
  getInvoices
);

// ======================================
// POST /api/invoices
// ======================================

router.post(
  "/",
  validateRequest(createInvoiceSchema, "body"),
  createInvoice
);

// ======================================
// GET /api/invoices/:id
// ======================================

router.get(
  "/:id",
  validateRequest(invoiceIdSchema, "params"),
  getInvoiceById
);

// ======================================
// PATCH /api/invoices/:id
// ======================================

router.patch(
  "/:id",
  validateRequest(invoiceIdSchema, "params"),
  validateRequest(updateInvoiceSchema, "body"),
  updateInvoice
);

// ======================================
// PATCH /api/invoices/:id/issue
// ======================================

router.patch(
  "/:id/issue",
  validateRequest(invoiceIdSchema, "params"),
  validateRequest(issueInvoiceSchema, "body"),
  issueInvoice
);

// ======================================
// PATCH /api/invoices/:id/cancel
// ======================================

router.patch(
  "/:id/cancel",
  validateRequest(invoiceIdSchema, "params"),
  validateRequest(cancelInvoiceSchema, "body"),
  cancelInvoice
);

// ======================================
// POST /api/invoices/:id/payments
// ======================================

router.post(
  "/:id/payments",
  validateRequest(invoiceIdSchema, "params"),
  validateRequest(
    allocateInvoicePaymentSchema,
    "body"
  ),
  allocateInvoicePayment
);

// ======================================
// Export Router
// ======================================

export default router;
