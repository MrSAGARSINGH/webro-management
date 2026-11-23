
import { Router } from "express";

import {
  getCalendarEvents,
  getCalendarEventById,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "../controllers/calendarController.js";

import {
  protect,
  authorize,
} from "../middlewares/authMiddleware.js";

// ======================================
// Initialize Calendar Router
// ======================================

const router = Router();

// ======================================
// Authentication
// ======================================

// Every Calendar API request requires
// a valid authenticated user session.

router.use(protect);

// ======================================
// GET /api/calendar/events
// ======================================

// Returns events within the requested
// date range.
//
// Visibility and ownership filtering
// are enforced inside the controller.
//
// Example:
// /api/calendar/events?startDate=2026-11-01&endDate=2026-11-30

router.get(
  "/events",
  authorize("admin", "manager", "employee"),
  getCalendarEvents
);

// ======================================
// GET /api/calendar/events/:id
// ======================================

// Returns one accessible calendar event.

router.get(
  "/events/:id",
  authorize("admin", "manager", "employee"),
  getCalendarEventById
);

// ======================================
// POST /api/calendar/events
// ======================================

// All authenticated roles may create
// private calendar events.
//
// Only Admin/Manager may create
// team-visible events.
//
// Additional validation and permissions
// are enforced inside the controller.

router.post(
  "/events",
  authorize("admin", "manager", "employee"),
  createCalendarEvent
);

// ======================================
// PATCH /api/calendar/events/:id
// ======================================

// Event creator can edit their event.
//
// Admin/Manager may also manage
// team-visible events.
//
// Controller verifies permissions
// before saving changes.

router.patch(
  "/events/:id",
  authorize("admin", "manager", "employee"),
  updateCalendarEvent
);

// ======================================
// DELETE /api/calendar/events/:id
// ======================================

// Delete is restricted to the event
// creator or authorized Admin/Manager
// for team-visible events.

router.delete(
  "/events/:id",
  authorize("admin", "manager", "employee"),
  deleteCalendarEvent
);

// ======================================
// Export Router
// ======================================

export default router;
