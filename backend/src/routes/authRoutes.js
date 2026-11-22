
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";

import {
  login,
  logout,
  getMe,
} from "../controllers/authController.js";

import {
  protect,
} from "../middlewares/authMiddleware.js";

import {
  issueCsrfToken,
  csrfProtection,
} from "../middlewares/csrfMiddleware.js";

import {
  AppError,
} from "../middlewares/errorMiddleware.js";

// ======================================
// Initialize Router
// ======================================

const router = Router();

// ======================================
// Login Request Validation
// ======================================

const loginSchema = z.object({
  email: z
    .email()
    .trim()
    .max(254),

  password: z
    .string()
    .min(1)
    .max(1024),
}).strict();

const validateLogin = (
  req,
  _res,
  next
) => {
  const result =
    loginSchema.safeParse(req.body);

  if (!result.success) {
    return next(
      new AppError(
        "Valid email and password are required",
        400,
        "VALIDATION_ERROR"
      )
    );
  }

  req.body = result.data;

  return next();
};

// ======================================
// Allowed Request Origins
// ======================================

const getAllowedOrigins = () => {
  return new Set(
    (
      process.env.FRONTEND_URL ||
      "http://localhost:5175"
    )
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  );
};

// ======================================
// Origin Validation
// ======================================

// Protects browser-based authentication
// requests from unexpected origins.
//
// API clients without Origin/Referer
// remain supported. For production,
// enforce origin checks at the edge too.

const verifyRequestOrigin = (
  req,
  _res,
  next
) => {
  const origin = req.get("origin");
  const referer = req.get("referer");

  const allowedOrigins =
    getAllowedOrigins();

  if (origin) {
    if (!allowedOrigins.has(origin)) {
      return next(
        new AppError(
          "Request origin not allowed",
          403,
          "ORIGIN_NOT_ALLOWED"
        )
      );
    }

    return next();
  }

  if (referer) {
    try {
      const refererOrigin =
        new URL(referer).origin;

      if (
        !allowedOrigins.has(
          refererOrigin
        )
      ) {
        return next(
          new AppError(
            "Request origin not allowed",
            403,
            "ORIGIN_NOT_ALLOWED"
          )
        );
      }
    } catch {
      return next(
        new AppError(
          "Invalid request referer",
          403,
          "INVALID_REFERER"
        )
      );
    }
  }

  return next();
};

// ======================================
// Login Rate Limiter
// ======================================

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 10,

  standardHeaders: "draft-8",

  legacyHeaders: false,

  skipSuccessfulRequests: true,

  message: {
    success: false,
    message:
      "Too many failed login attempts. Please try again later.",
    code: "LOGIN_RATE_LIMIT_EXCEEDED",
  },
});

// ======================================
// POST /api/auth/login
// ======================================

router.post(
  "/login",
  verifyRequestOrigin,
  loginLimiter,
  validateLogin,
  login
);

// ======================================
// GET /api/auth/me
// ======================================

router.get(
  "/me",
  protect,
  getMe
);

// ======================================
// GET /api/auth/csrf
// ======================================

router.get(
  "/csrf",
  protect,
  issueCsrfToken
);

// ======================================
// POST /api/auth/logout
// ======================================

router.post(
  "/logout",
  verifyRequestOrigin,
  protect,
  csrfProtection,
  logout
);

// ======================================
// Export Router
// ======================================

export default router;
