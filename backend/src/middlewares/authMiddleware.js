
import jwt from "jsonwebtoken";
import User from "../models/User.js";

import {
  AppError,
  asyncHandler,
} from "./errorMiddleware.js";

// ======================================
// Configuration
// ======================================

const ACCESS_COOKIE_NAME =
  "webro_access_token";

const ALLOWED_ROLES = new Set([
  "admin",
  "manager",
  "employee",
]);

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
// Authentication Middleware
// ======================================

export const protect = asyncHandler(
  async (req, _res, next) => {
    // Only accept the access token
    // from the HttpOnly cookie.

    const token =
      req.cookies?.[ACCESS_COOKIE_NAME];

    if (
      typeof token !== "string" ||
      !token
    ) {
      throw new AppError(
        "Authentication required",
        401,
        "AUTHENTICATION_REQUIRED"
      );
    }

    // Verify JWT signature, expiration,
    // issuer and audience.

    const decoded = jwt.verify(
      token,
      getJwtSecret(),
      {
        algorithms: ["HS256"],
        issuer: "webro-management",
        audience: "webro-dashboard",
      }
    );

    if (
      !decoded ||
      typeof decoded !== "object"
    ) {
      throw new AppError(
        "Invalid authentication token",
        401,
        "INVALID_TOKEN"
      );
    }

    // Subject must be a MongoDB ObjectId.

    const userId = decoded.sub;

    if (
      typeof userId !== "string" ||
      !/^[a-fA-F0-9]{24}$/.test(userId)
    ) {
      throw new AppError(
        "Invalid token subject",
        401,
        "INVALID_TOKEN_SUBJECT"
      );
    }

    // Unique JWT session identifier
    // required by CSRF middleware.

    if (
      typeof decoded.jti !== "string" ||
      decoded.jti.length < 16
    ) {
      throw new AppError(
        "Invalid authentication session",
        401,
        "INVALID_AUTH_SESSION"
      );
    }

    // Load current user from database.

    const user = await User.findById(
      userId
    ).select(
      "_id name email role isActive passwordChangedAt"
    );

    if (!user || !user.isActive) {
      throw new AppError(
        "User account is inactive or unavailable",
        401,
        "USER_NOT_ACTIVE"
      );
    }

    if (!ALLOWED_ROLES.has(user.role)) {
      throw new AppError(
        "Invalid account role",
        403,
        "INVALID_USER_ROLE"
      );
    }

    // Invalidate JWTs issued before
    // the user's password was changed.

    if (
      user.passwordChangedAt &&
      typeof decoded.iat === "number"
    ) {
      const passwordChangedAt =
        Math.floor(
          new Date(
            user.passwordChangedAt
          ).getTime() / 1000
        );

      if (
        decoded.iat < passwordChangedAt
      ) {
        throw new AppError(
          "Session expired after password change",
          401,
          "SESSION_REVOKED"
        );
      }
    }

    // Existing controllers use req.user.

    req.user = user;

    // CSRF middleware uses this value.
    // It comes from the verified JWT,
    // never from client input.

    req.authSessionId = decoded.jti;

    return next();
  }
);

// ======================================
// Role Authorization Middleware
// ======================================

export const authorize = (...roles) => {
  const permittedRoles = new Set(
    roles.flat()
  );

  return (req, _res, next) => {
    if (!req.user) {
      return next(
        new AppError(
          "Authentication required",
          401,
          "AUTHENTICATION_REQUIRED"
        )
      );
    }

    if (
      !permittedRoles.has(
        req.user.role
      )
    ) {
      return next(
        new AppError(
          "You do not have permission to perform this action",
          403,
          "ACCESS_DENIED"
        )
      );
    }

    return next();
  };
};
