
import { Router } from "express";

// ======================================
// Dashboard Controllers
// ======================================

import {
  getDashboardOverview,
  getRevenueAnalytics,
  getLeadAnalytics,
  getProjectAnalytics,
  getTaskAnalytics,
  getEmployeeAnalytics,
  getRecentActivity,
} from "../controllers/dashboardController.js";

// ======================================
// Authentication Middleware
// ======================================

import {
  protect,
  authorize,
} from "../middlewares/authMiddleware.js";

// ======================================
// Initialize Router
// ======================================

const router = Router();

// ======================================
// Authentication & Authorization
// ======================================

// Every dashboard endpoint requires
// authentication and management access.

router.use(protect);

router.use(
  authorize("admin", "manager")
);

// ======================================
// Dashboard Overview
// GET /api/dashboard/overview
// ======================================

router.get(
  "/overview",
  getDashboardOverview
);

// ======================================
// Revenue Analytics
// GET /api/dashboard/revenue
// ======================================

router.get(
  "/revenue",
  getRevenueAnalytics
);

// ======================================
// Lead Analytics
// GET /api/dashboard/leads
// ======================================

router.get(
  "/leads",
  getLeadAnalytics
);

// ======================================
// Project Analytics
// GET /api/dashboard/projects
// ======================================

router.get(
  "/projects",
  getProjectAnalytics
);

// ======================================
// Task Analytics
// GET /api/dashboard/tasks
// ======================================

router.get(
  "/tasks",
  getTaskAnalytics
);

// ======================================
// Employee Analytics
// GET /api/dashboard/employees
// ======================================

router.get(
  "/employees",
  getEmployeeAnalytics
);

// ======================================
// Recent Activity
// GET /api/dashboard/activity
// ======================================

router.get(
  "/activity",
  getRecentActivity
);

// ======================================
// Export Router
// ======================================

export default router;
