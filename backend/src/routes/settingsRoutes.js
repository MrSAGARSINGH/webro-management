
import { Router } from "express";

import {
  getSettings,
  updateCompanySettings,
  updatePreferences,
  updateNotifications,
} from "../controllers/settingsController.js";

import {
  protect,
  authorize,
} from "../middlewares/authMiddleware.js";

// ======================================
// Initialize Settings Router
// ======================================

const router = Router();

// ======================================
// Authentication
// ======================================

// All Settings endpoints require
// an authenticated user.
//
// The parent businessRouter in app.js
// already applies protect and
// csrfProtection.
//
// Keeping protect here provides
// authentication if this router is
// mounted independently later.

router.use(protect);

// ======================================
// GET /api/settings
// ======================================

// Returns:
// - Workspace company information
// - Current user's preferences
// - Current user's notifications

router.get(
  "/",
  authorize("admin", "manager", "employee"),
  getSettings
);

// ======================================
// PATCH /api/settings/company
// ======================================

// Only Admin can update company details.
//
// Example body:
// {
//   "company": {
//     "name": "WEBRO Studio",
//     "email": "contact@example.com"
//   }
// }

router.patch(
  "/company",
  authorize("admin"),
  updateCompanySettings
);

// ======================================
// PATCH /api/settings/preferences
// ======================================

// Every authenticated user can update
// their own display preferences.
//
// Example body:
// {
//   "preferences": {
//     "theme": "dark",
//     "compactMode": false
//   }
// }

router.patch(
  "/preferences",
  authorize("admin", "manager", "employee"),
  updatePreferences
);

// ======================================
// PATCH /api/settings/notifications
// ======================================

// Every authenticated user can update
// their own notification preferences.
//
// Example body:
// {
//   "notifications": {
//     "taskReminders": true,
//     "paymentReminders": false
//   }
// }

router.patch(
  "/notifications",
  authorize("admin", "manager", "employee"),
  updateNotifications
);

// ======================================
// Export Router
// ======================================

export default router;
