
import mongoose from "mongoose";

// ======================================
// Custom Application Error
// ======================================

export class AppError extends Error {
  constructor(
    message,
    statusCode = 500,
    code = "APPLICATION_ERROR"
  ) {
    super(message);

    this.name = "AppError";
    this.statusCode = statusCode;
    this.status = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace?.(
      this,
      this.constructor
    );
  }
}

// ======================================
// Async Controller Wrapper
// ======================================

export const asyncHandler = (handler) => {
  return (req, res, next) => {
    Promise.resolve()
      .then(() => handler(req, res, next))
      .catch(next);
  };
};

// ======================================
// Error Response Helper
// ======================================

const sendError = (
  res,
  statusCode,
  message,
  code,
  details
) => {
  const response = {
    success: false,
    message,
    code,
  };

  if (
    Array.isArray(details) &&
    details.length > 0
  ) {
    response.errors = details;
  }

  return res.status(statusCode).json(
    response
  );
};

// ======================================
// Normalize Known Errors
// ======================================

const normalizeError = (error) => {
  // Invalid JSON body
  if (
    error instanceof SyntaxError &&
    error.status === 400 &&
    "body" in error
  ) {
    return {
      statusCode: 400,
      message: "Invalid JSON request body",
      code: "INVALID_JSON",
    };
  }

  // Body parser errors
  if (error.type === "entity.too.large") {
    return {
      statusCode: 413,
      message: "Request body is too large",
      code: "PAYLOAD_TOO_LARGE",
    };
  }

  if (error.type === "encoding.unsupported") {
    return {
      statusCode: 415,
      message: "Unsupported content encoding",
      code: "UNSUPPORTED_ENCODING",
    };
  }

  // Duplicate MongoDB key
  if (error.code === 11000) {
    const fields = Object.keys(
      error.keyPattern ?? error.keyValue ?? {}
    );

    return {
      statusCode: 409,
      message:
        "A record with the supplied unique value already exists",
      code: "DUPLICATE_RESOURCE",
      details: fields.map((field) => ({
        field,
        message: `${field} must be unique`,
      })),
    };
  }

  // Invalid MongoDB ObjectId / cast
  if (
    error instanceof mongoose.Error.CastError
  ) {
    return {
      statusCode: 400,
      message: `Invalid value for ${error.path}`,
      code: "INVALID_FIELD_VALUE",
    };
  }

  // Mongoose schema validation
  if (
    error instanceof
    mongoose.Error.ValidationError
  ) {
    return {
      statusCode: 400,
      message: "Validation failed",
      code: "VALIDATION_ERROR",
      details: Object.values(
        error.errors
      ).map((item) => ({
        field: item.path,
        message: item.message,
      })),
    };
  }

  // Optimistic concurrency conflict
  if (
    error instanceof
    mongoose.Error.VersionError
  ) {
    return {
      statusCode: 409,
      message:
        "This record was modified by another request. Refresh and try again.",
      code: "VERSION_CONFLICT",
    };
  }

  // Document not found during save
  if (
    error instanceof
    mongoose.Error.DocumentNotFoundError
  ) {
    return {
      statusCode: 404,
      message: "Requested record not found",
      code: "RESOURCE_NOT_FOUND",
    };
  }

  // Database unavailable
  if (
    error instanceof
    mongoose.Error.MongooseServerSelectionError ||
    error.name === "MongoServerSelectionError"
  ) {
    return {
      statusCode: 503,
      message:
        "Database service is temporarily unavailable",
      code: "DATABASE_UNAVAILABLE",
    };
  }

  // JWT errors
  if (error.name === "JsonWebTokenError") {
    return {
      statusCode: 401,
      message: "Invalid authentication token",
      code: "INVALID_TOKEN",
    };
  }

  if (error.name === "TokenExpiredError") {
    return {
      statusCode: 401,
      message: "Authentication token expired",
      code: "TOKEN_EXPIRED",
    };
  }

  // Application / HTTP errors
  const rawStatus =
    error.statusCode ?? error.status;

  if (
    Number.isInteger(rawStatus) &&
    rawStatus >= 400 &&
    rawStatus < 500
  ) {
    return {
      statusCode: rawStatus,
      message:
        error.message ||
        "Request could not be processed",
      code:
        typeof error.code === "string"
          ? error.code
          : "REQUEST_ERROR",
    };
  }

  // Unexpected errors
  return {
    statusCode: 500,
    message: "Internal server error",
    code: "INTERNAL_SERVER_ERROR",
  };
};

// ======================================
// Global Error Handler
// ======================================

export const errorHandler = (
  error,
  req,
  res,
  next
) => {
  if (res.headersSent) {
    return next(error);
  }

  const normalized = normalizeError(error);

  const {
    statusCode,
    message,
    code,
    details,
  } = normalized;

  // Log server-side failures.
  // Never expose internal stack traces.
  if (statusCode >= 500) {
    console.error(
      "[WEBRO API ERROR]",
      {
        method: req.method,
        path: req.originalUrl,
        statusCode,
        code,
        error,
      }
    );
  }

  return sendError(
    res,
    statusCode,
    message,
    code,
    details
  );
};

// ======================================
// 404 Middleware
// ======================================

export const notFoundHandler = (
  req,
  res
) => {
  return sendError(
    res,
    404,
    "API endpoint not found",
    "ROUTE_NOT_FOUND"
  );
};
