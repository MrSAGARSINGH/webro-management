
import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { AppError } from "./errorMiddleware.js";

// ======================================
// Configuration
// ======================================

const CSRF_COOKIE_NAME = "webro_csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";

const SAFE_METHODS = new Set([
  "GET",
  "HEAD",
  "OPTIONS",
]);

const TOKEN_PATTERN =
  /^[a-f0-9]{64}\.[a-f0-9]{64}$/;

const IS_PRODUCTION =
  process.env.NODE_ENV === "production";

// ======================================
// Secret Configuration
// ======================================

const getCsrfSecret = () => {
  const secret = process.env.CSRF_SECRET;

  if (
    typeof secret !== "string" ||
    Buffer.byteLength(secret, "utf8") < 32
  ) {
    throw new Error(
      "CSRF_SECRET must contain at least 32 bytes"
    );
  }

  return secret;
};

// ======================================
// Cookie Configuration
// ======================================

// Production:
// SameSite=None + Secure=true allows
// cross-site requests from Vercel to Render.
//
// Development:
// SameSite=Strict preserves local security.

const cookieOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: IS_PRODUCTION ? "none" : "strict",
  path: "/api",
};

// ======================================
// Session Binding
// ======================================

// The authenticated session identifier
// must be stable for the lifetime of
// the JWT and unique to that login.
//
// Expected:
// req.authSessionId = verified JWT jti
//
// This value must come from verified
// authentication middleware, never
// directly from request input.

const getSessionId = (req) => {
  const sessionId = req.authSessionId;

  if (
    typeof sessionId !== "string" ||
    sessionId.length < 16
  ) {
    throw new AppError(
      "Authenticated session is required",
      401,
      "AUTH_SESSION_REQUIRED"
    );
  }

  return sessionId;
};

// ======================================
// Token Signature
// ======================================

const signToken = (
  sessionId,
  nonce
) => {
  const message =
    `${sessionId.length}!${sessionId}!` +
    `${nonce.length}!${nonce}`;

  return createHmac(
    "sha256",
    getCsrfSecret()
  )
    .update(message)
    .digest("hex");
};

// ======================================
// Create CSRF Token
// ======================================

export const createCsrfToken = (
  sessionId
) => {
  if (
    typeof sessionId !== "string" ||
    sessionId.length < 16
  ) {
    throw new Error(
      "Valid authenticated session ID required"
    );
  }

  const nonce = randomBytes(32)
    .toString("hex");

  const signature = signToken(
    sessionId,
    nonce
  );

  return `${nonce}.${signature}`;
};

// ======================================
// Verify CSRF Token
// ======================================

export const verifyCsrfToken = (
  token,
  sessionId
) => {
  if (
    typeof token !== "string" ||
    typeof sessionId !== "string" ||
    !TOKEN_PATTERN.test(token)
  ) {
    return false;
  }

  const [nonce, signature] =
    token.split(".");

  const expectedSignature =
    signToken(sessionId, nonce);

  const supplied = Buffer.from(
    signature,
    "hex"
  );

  const expected = Buffer.from(
    expectedSignature,
    "hex"
  );

  return (
    supplied.length === expected.length &&
    timingSafeEqual(
      supplied,
      expected
    )
  );
};

// ======================================
// Issue CSRF Token
// ======================================

// Use after authentication:
//
// GET /api/auth/csrf
//
// Returns a token in JSON so the
// frontend can send it in the header.
//
// The cookie is HttpOnly and cannot
// be read directly by JavaScript.

export const issueCsrfToken = (
  req,
  res,
  next
) => {
  try {
    const sessionId = getSessionId(req);

    const token =
      createCsrfToken(sessionId);

    res.cookie(
      CSRF_COOKIE_NAME,
      token,
      cookieOptions
    );

    return res.status(200).json({
      success: true,
      csrfToken: token,
    });
  } catch (error) {
    return next(error);
  }
};

// ======================================
// CSRF Validation Middleware
// ======================================

// Apply after JWT authentication.
//
// Safe methods are excluded.
// Unsafe methods require matching
// header and cookie tokens plus
// a valid session-bound signature.

export const csrfProtection = (
  req,
  res,
  next
) => {
  try {
    if (SAFE_METHODS.has(req.method)) {
      return next();
    }

    const sessionId = getSessionId(req);

    const cookieToken =
      req.cookies?.[CSRF_COOKIE_NAME];

    const headerToken =
      req.get(CSRF_HEADER_NAME);

    if (
      typeof cookieToken !== "string" ||
      typeof headerToken !== "string" ||
      !TOKEN_PATTERN.test(cookieToken) ||
      !TOKEN_PATTERN.test(headerToken)
    ) {
      throw new AppError(
        "CSRF token is missing or invalid",
        403,
        "CSRF_TOKEN_INVALID"
      );
    }

    const cookieBuffer =
      Buffer.from(cookieToken, "utf8");

    const headerBuffer =
      Buffer.from(headerToken, "utf8");

    if (
      cookieBuffer.length !==
        headerBuffer.length ||
      !timingSafeEqual(
        cookieBuffer,
        headerBuffer
      )
    ) {
      throw new AppError(
        "CSRF token mismatch",
        403,
        "CSRF_TOKEN_MISMATCH"
      );
    }

    if (
      !verifyCsrfToken(
        headerToken,
        sessionId
      )
    ) {
      throw new AppError(
        "CSRF token verification failed",
        403,
        "CSRF_VERIFICATION_FAILED"
      );
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

// ======================================
// Clear CSRF Cookie
// ======================================

// Call when the user logs out.

export const clearCsrfCookie = (
  res
) => {
  res.clearCookie(
    CSRF_COOKIE_NAME,
    cookieOptions
  );
};
