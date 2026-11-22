
import "dotenv/config";

import { z } from "zod";

// ======================================
// Environment Schema
// ======================================

const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum([
        "development",
        "production",
        "test",
      ])
      .default("development"),

    PORT: z.coerce
      .number()
      .int()
      .min(1)
      .max(65535)
      .default(5000),

    FRONTEND_URL: z
      .string()
      .min(1)
      .default("http://localhost:5175"),

    MONGODB_URI: z
      .string()
      .min(1)
      .optional(),

    JWT_SECRET: z
      .string()
      .min(32),

    CSRF_SECRET: z
      .string()
      .min(32),

    JWT_EXPIRES_IN: z
      .string()
      .default("8h"),
  })
  .superRefine((data, ctx) => {
    // Database setup can remain deferred
    // during local development.

    if (
      data.NODE_ENV === "production" &&
      !data.MONGODB_URI
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["MONGODB_URI"],
        message:
          "MONGODB_URI is required in production",
      });
    }

    const origins =
      data.FRONTEND_URL
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);

    if (origins.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["FRONTEND_URL"],
        message:
          "At least one frontend origin is required",
      });
    }

    for (const origin of origins) {
      try {
        const url = new URL(origin);

        if (
          !["http:", "https:"].includes(
            url.protocol
          ) ||
          url.origin !== origin
        ) {
          throw new Error(
            "Invalid frontend origin"
          );
        }

        if (
          data.NODE_ENV === "production" &&
          url.protocol !== "https:"
        ) {
          throw new Error(
            "HTTPS required"
          );
        }
      } catch {
        ctx.addIssue({
          code: "custom",
          path: ["FRONTEND_URL"],
          message:
            `Invalid frontend origin: ${origin}`,
        });
      }
    }

    if (
      data.JWT_SECRET &&
      data.CSRF_SECRET &&
      data.JWT_SECRET === data.CSRF_SECRET
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["CSRF_SECRET"],
        message:
          "CSRF_SECRET must differ from JWT_SECRET",
      });
    }
  });

// ======================================
// Validate Environment
// ======================================

const result =
  environmentSchema.safeParse(
    process.env
  );

if (!result.success) {
  console.error(
    "\n[WEBRO CONFIG ERROR]"
  );

  for (
    const issue of
    result.error.issues
  ) {
    console.error(
      `${issue.path.join(".")}: ${issue.message}`
    );
  }

  throw new Error(
    "Invalid backend environment configuration"
  );
}

// ======================================
// Export Configuration
// ======================================

const config = result.data;

export const env = Object.freeze({
  NODE_ENV: config.NODE_ENV,

  PORT: config.PORT,

  FRONTEND_URL:
    config.FRONTEND_URL,

  ALLOWED_ORIGINS:
    Object.freeze(
      config.FRONTEND_URL
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    ),

  MONGODB_URI:
    config.MONGODB_URI ?? "",

  JWT_SECRET:
    config.JWT_SECRET,

  CSRF_SECRET:
    config.CSRF_SECRET,

  JWT_EXPIRES_IN:
    config.JWT_EXPIRES_IN,

  IS_PRODUCTION:
    config.NODE_ENV === "production",

  IS_DEVELOPMENT:
    config.NODE_ENV === "development",
});

export default env;
