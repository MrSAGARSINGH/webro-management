
import { Router } from "express";

import {
  getUsers,
  getAvailableEmployees,
  createUser,
  updateUser,
  updateUserStatus,
} from "../controllers/userController.js";

import {
  protect,
  authorize,
} from "../middlewares/authMiddleware.js";

const router = Router();

// All routes require authentication.
// app.js also protects the business router.

router.use(protect);

// ======================================
// GET /api/users
// ======================================

router.get(
  "/",
  authorize("admin", "manager"),
  getUsers
);

// ======================================
// GET /api/users/available-employees
// ======================================

router.get(
  "/available-employees",
  authorize("admin"),
  getAvailableEmployees
);

// ======================================
// POST /api/users
// ======================================

router.post(
  "/",
  authorize("admin"),
  createUser
);

// ======================================
// PATCH /api/users/:id
// ======================================

router.patch(
  "/:id",
  authorize("admin"),
  updateUser
);

// ======================================
// PATCH /api/users/:id/status
// ======================================

router.patch(
  "/:id/status",
  authorize("admin"),
  updateUserStatus
);

export default router;
