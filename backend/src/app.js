
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";

// ======================================
// Route Imports
// ======================================

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import clientRoutes from "./routes/clientRoutes.js";
import leadRoutes from "./routes/leadRoutes.js";
import callRoutes from "./routes/callRoutes.js";
import followUpRoutes from "./routes/followUpRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";

// New MongoDB-backed modules
import calendarRoutes from "./routes/calendarRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";

// ======================================
// Security Middleware
// ======================================

import {
  protect,
} from "./middlewares/authMiddleware.js";

import {
  csrfProtection,
} from "./middlewares/csrfMiddleware.js";

import {
  notFoundHandler,
  errorHandler,
} from "./middlewares/errorMiddleware.js";

// ======================================
// Initialize Express
// ======================================

const app = express();

app.disable("x-powered-by");

// ======================================
// Production Reverse Proxy
// ======================================

// Render generally places Express behind
// a reverse proxy.
//
// Trust exactly one proxy hop when this
// matches the deployment topology.
//
// Required for correct client IP handling
// with express-rate-limit.

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// ======================================
// Security Headers
// ======================================

app.use(helmet());

// ======================================
// CORS Configuration
// ======================================

const allowedOrigins = (
  process.env.FRONTEND_URL ||
  "http://localhost:5175"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        allowedOrigins.includes(origin)
      ) {
        return callback(null, true);
      }

      const error = new Error(
        "CORS origin not allowed"
      );

      error.status = 403;

      return callback(error);
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "X-CSRF-Token",
    ],

    optionsSuccessStatus: 204,
  })
);

// ======================================
// Request Body Parsers
// ======================================

app.use(
  express.json({
    limit: "100kb",
    strict: true,
  })
);

app.use(
  express.urlencoded({
    extended: false,
    limit: "100kb",
  })
);

// ======================================
// Cookie Parser
// ======================================

app.use(cookieParser());

// ======================================
// API Rate Limiting
// ======================================

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 300,

  standardHeaders: "draft-8",

  legacyHeaders: false,

  message: {
    success: false,
    message:
      "Too many requests. Please try again later.",
    code: "RATE_LIMIT_EXCEEDED",
  },
});

app.use("/api", apiLimiter);

// ======================================
// Health Check
// ======================================

app.get("/api/health", (_req, res) => {
  return res.status(200).json({
    success: true,

    message:
      "WEBRO Management API is running",

    environment:
      process.env.NODE_ENV || "development",

    timestamp: new Date().toISOString(),
  });
});

// ======================================
// Authentication Routes
// ======================================

// Login and CSRF token generation
// must remain outside global CSRF
// protection to avoid bootstrap issues.
//
// Logout already has its own
// CSRF protection in authRoutes.js.

app.use("/api/auth", authRoutes);

// ======================================
// Protected Business API Router
// ======================================

const businessRouter = express.Router();

// All business API endpoints require
// a valid authenticated user.

businessRouter.use(protect);

// CSRF protection automatically skips
// GET, HEAD and OPTIONS.
//
// POST, PUT, PATCH and DELETE require
// valid session-bound CSRF tokens.

businessRouter.use(csrfProtection);

// ======================================
// User Management Routes
// ======================================

businessRouter.use(
  "/users",
  userRoutes
);

// ======================================
// Client Management Routes
// ======================================

businessRouter.use(
  "/clients",
  clientRoutes
);

// ======================================
// Lead Management Routes
// ======================================

businessRouter.use(
  "/leads",
  leadRoutes
);

// ======================================
// Call Management Routes
// ======================================

businessRouter.use(
  "/calls",
  callRoutes
);

// ======================================
// Follow-up Management Routes
// ======================================

businessRouter.use(
  "/follow-ups",
  followUpRoutes
);

// ======================================
// Project Management Routes
// ======================================

businessRouter.use(
  "/projects",
  projectRoutes
);

// ======================================
// Payment Management Routes
// ======================================

businessRouter.use(
  "/payments",
  paymentRoutes
);

// ======================================
// Invoice Management Routes
// ======================================

businessRouter.use(
  "/invoices",
  invoiceRoutes
);

// ======================================
// Task Management Routes
// ======================================

businessRouter.use(
  "/tasks",
  taskRoutes
);

// ======================================
// Employee Management Routes
// ======================================

businessRouter.use(
  "/employees",
  employeeRoutes
);

// ======================================
// Calendar Management Routes
// ======================================

// MongoDB-backed calendar events.
//
// GET requests require authentication.
//
// POST, PATCH and DELETE additionally
// require CSRF protection.
//
// Event ownership and visibility
// are enforced by calendarController.

businessRouter.use(
  "/calendar",
  calendarRoutes
);

// ======================================
// Settings Management Routes
// ======================================

// Workspace company settings:
// Admin-only modifications.
//
// Personal preferences and notifications:
// Authenticated users can modify
// their own settings.
//
// All mutations require CSRF protection.

businessRouter.use(
  "/settings",
  settingsRoutes
);

// ======================================
// Dashboard Analytics Routes
// ======================================

businessRouter.use(
  "/dashboard",
  dashboardRoutes
);

// ======================================
// Mount Protected Business APIs
// ======================================

app.use(
  "/api",
  businessRouter
);

// ======================================
// 404 Middleware
// ======================================

app.use(notFoundHandler);

// ======================================
// Global Error Middleware
// ======================================

app.use(errorHandler);

// ======================================
// Export App
// ======================================

export default app;
