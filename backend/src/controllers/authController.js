
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import { randomUUID } from "node:crypto";

import User from "../models/User.js";

import {
  AppError,
  asyncHandler,
} from "../middlewares/errorMiddleware.js";

import {
  clearCsrfCookie,
} from "../middlewares/csrfMiddleware.js";

// ======================================
// Configuration
// ======================================

const COOKIE_NAME = "webro_access_token";

const JWT_ISSUER = "webro-management";
const JWT_AUDIENCE = "webro-dashboard";

const TOKEN_LIFETIME_SECONDS = 60 * 60 * 8;

const IS_PRODUCTION =
  process.env.NODE_ENV === "production";

const cookieOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: "strict",
  path: "/api",
};

// ======================================
// JWT Secret
// ======================================

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (
    typeof secret !== "string" ||
    Buffer.byteLength(secret, "utf8") < 32
  ) {
    throw new AppError(
      "Authentication configuration error",
      500,
      "JWT_CONFIGURATION_ERROR"
    );
  }

  return secret;
};

// ======================================
// Public User Response
// ======================================

const serializeUser = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone ?? "",
  isActive: user.isActive,
});

// ======================================
// JWT Generation
// ======================================

const generateAccessToken = (user) => {
  const sessionId = randomUUID();

  const token = jwt.sign(
    {},
    getJwtSecret(),
    {
      algorithm: "HS256",

      subject: String(user._id),

      jwtid: sessionId,

      issuer: JWT_ISSUER,

      audience: JWT_AUDIENCE,

      expiresIn: TOKEN_LIFETIME_SECONDS,
    }
  );

  return token;
};

// ======================================
// Authentication Cookie
// ======================================

const setAuthCookie = (res, token) => {
  res.cookie(COOKIE_NAME, token, {
    ...cookieOptions,
    maxAge:
      TOKEN_LIFETIME_SECONDS * 1000,
  });
};

const clearAuthCookie = (res) => {
  res.clearCookie(
    COOKIE_NAME,
    cookieOptions
  );
};

// ======================================
// POST /api/auth/login
// ======================================

export const login = asyncHandler(
  async (req, res) => {
    const { email, password } = req.body;

    const normalizedEmail =
      email.trim().toLowerCase();

    // Password hash must be explicitly
    // selected if hidden by the model.

    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+passwordHash");

    // Use a fixed dummy hash to reduce
    // account-enumeration timing differences.

    const dummyHash =
      "$2b$12$C6UzMDM.H6dfI/f/IKcEeO6aMW8s9R0w0sQJ6JxVdGxgGx7L7G8eK";

    const hashToVerify =
      user?.passwordHash || dummyHash;

    const passwordMatches =
      await bcrypt.compare(
        password,
        hashToVerify
      );

    if (
      !user ||
      !passwordMatches ||
      !user.isActive
    ) {
      throw new AppError(
        "Invalid email or password",
        401,
        "INVALID_CREDENTIALS"
      );
    }

    const token =
      generateAccessToken(user);

    user.lastLoginAt = new Date();

    await user.save();

    // Remove any CSRF token from
    // the previous login session.

    clearCsrfCookie(res);

    setAuthCookie(res, token);

    return res.status(200).json({
      success: true,

      message:
        "Login successful",

      user: serializeUser(user),

      expiresIn:
        TOKEN_LIFETIME_SECONDS,
    });
  }
);

// ======================================
// GET /api/auth/me
// ======================================

export const getMe = asyncHandler(
  async (req, res) => {
    return res.status(200).json({
      success: true,

      user: serializeUser(
        req.user
      ),
    });
  }
);

// ======================================
// POST /api/auth/logout
// ======================================

export const logout = asyncHandler(
  async (_req, res) => {
    clearAuthCookie(res);

    clearCsrfCookie(res);

    return res.status(200).json({
      success: true,

      message:
        "Logout successful",
    });
  }
);
