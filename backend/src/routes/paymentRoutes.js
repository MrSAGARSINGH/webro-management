
import { Router } from "express";

import {
  createPayment,
  getPayments,
  getPaymentStats,
  getPaymentById,
  updatePayment,
  verifyPayment,
  failPayment,
  cancelPayment,
  refundPayment,
} from "../controllers/paymentController.js";

import {
  protect,
  authorize,
} from "../middlewares/authMiddleware.js";

import { validateRequest } from "../middlewares/validateRequest.js";

import {
  createPaymentSchema,
  updatePaymentSchema,
  verifyPaymentSchema,
  failPaymentSchema,
  cancelPaymentSchema,
  refundPaymentSchema,
  paymentQuerySchema,
  paymentIdSchema,
} from "../validators/paymentValidator.js";

const router = Router();

// ======================================
// Authentication & Role Authorization
// ======================================

// All payment endpoints require login
// and Admin or Manager permissions.

router.use(protect);

router.use(authorize("admin", "manager"));

// ======================================
// GET /api/payments/stats
// ======================================

router.get(
  "/stats",
  getPaymentStats
);

// ======================================
// GET /api/payments
// ======================================

router.get(
  "/",
  validateRequest(paymentQuerySchema, "query"),
  getPayments
);

// ======================================
// POST /api/payments
// ======================================

router.post(
  "/",
  validateRequest(createPaymentSchema, "body"),
  createPayment
);

// ======================================
// GET /api/payments/:id
// ======================================

router.get(
  "/:id",
  validateRequest(paymentIdSchema, "params"),
  getPaymentById
);

// ======================================
// PATCH /api/payments/:id
// ======================================

router.patch(
  "/:id",
  validateRequest(paymentIdSchema, "params"),
  validateRequest(updatePaymentSchema, "body"),
  updatePayment
);

// ======================================
// PATCH /api/payments/:id/verify
// ======================================

router.patch(
  "/:id/verify",
  validateRequest(paymentIdSchema, "params"),
  validateRequest(verifyPaymentSchema, "body"),
  verifyPayment
);

// ======================================
// PATCH /api/payments/:id/fail
// ======================================

router.patch(
  "/:id/fail",
  validateRequest(paymentIdSchema, "params"),
  validateRequest(failPaymentSchema, "body"),
  failPayment
);

// ======================================
// PATCH /api/payments/:id/cancel
// ======================================

router.patch(
  "/:id/cancel",
  validateRequest(paymentIdSchema, "params"),
  validateRequest(cancelPaymentSchema, "body"),
  cancelPayment
);

// ======================================
// POST /api/payments/:id/refund
// ======================================

router.post(
  "/:id/refund",
  validateRequest(paymentIdSchema, "params"),
  validateRequest(refundPaymentSchema, "body"),
  refundPayment
);

export default router;
