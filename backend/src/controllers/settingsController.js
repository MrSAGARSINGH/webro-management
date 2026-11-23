
import mongoose from "mongoose";

import AppSettings, {
  DEFAULT_COMPANY_SETTINGS,
  DEFAULT_PREFERENCES,
  DEFAULT_NOTIFICATIONS,
} from "../models/AppSettings.js";

const { Types } = mongoose;

// ======================================
// Helpers
// ======================================

const createError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const getUserId = (req) => {
  const id = req.user?._id ?? req.user?.id;

  if (
    !id ||
    !Types.ObjectId.isValid(String(id))
  ) {
    throw createError(
      401,
      "Valid authentication is required"
    );
  }

  return String(id);
};

const getUserKey = (userId) =>
  `user:${userId}`;

const isAdmin = (req) =>
  req.user?.role === "admin";

const isPlainObject = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) ===
    Object.prototype;

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(
    object,
    key
  );

const allowedCompanyFields = {
  name: "string",
  email: "string",
  phone: "string",
  website: "string",
  address: "string",
  gstin: "string",
};

const allowedPreferenceFields = {
  theme: "string",
  accent: "string",
  currency: "string",
  dateFormat: "string",
  compactMode: "boolean",
};

const allowedNotificationFields = {
  taskReminders: "boolean",
  followUpReminders: "boolean",
  paymentReminders: "boolean",
  projectDeadlines: "boolean",
  desktopNotifications: "boolean",
};

const validateSection = (
  input,
  allowedFields,
  sectionName
) => {
  if (!isPlainObject(input)) {
    throw createError(
      400,
      `${sectionName} must be an object`
    );
  }

  const entries = Object.entries(input);

  if (entries.length === 0) {
    throw createError(
      400,
      `${sectionName} cannot be empty`
    );
  }

  const result = {};

  for (const [key, value] of entries) {
    if (!hasOwn(allowedFields, key)) {
      throw createError(
        400,
        `Unsupported ${sectionName} field: ${key}`
      );
    }

    if (
      typeof value !== allowedFields[key]
    ) {
      throw createError(
        400,
        `Invalid type for ${key}`
      );
    }

    result[key] =
      typeof value === "string"
        ? value.trim()
        : value;
  }

  return result;
};

const validateCompany = (input) => {
  const data = validateSection(
    input,
    allowedCompanyFields,
    "company"
  );

  if (
    hasOwn(data, "name") &&
    (data.name.length < 2 ||
      data.name.length > 150)
  ) {
    throw createError(
      400,
      "Company name must contain 2–150 characters"
    );
  }

  if (
    hasOwn(data, "email") &&
    (data.email.length > 254 ||
      (data.email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          data.email
        )))
  ) {
    throw createError(
      400,
      "Invalid company email"
    );
  }

  if (
    hasOwn(data, "phone") &&
    data.phone.length > 25
  ) {
    throw createError(
      400,
      "Phone number is too long"
    );
  }

  if (
    hasOwn(data, "address") &&
    data.address.length > 1000
  ) {
    throw createError(
      400,
      "Company address is too long"
    );
  }

  if (hasOwn(data, "website")) {
    if (data.website.length > 500) {
      throw createError(
        400,
        "Website URL is too long"
      );
    }

    if (data.website) {
      try {
        const url = new URL(
          data.website
        );

        if (
          !["http:", "https:"].includes(
            url.protocol
          ) ||
          !url.hostname
        ) {
          throw new Error(
            "Invalid protocol"
          );
        }
      } catch {
        throw createError(
          400,
          "Website must be a valid HTTP or HTTPS URL"
        );
      }
    }
  }

  if (hasOwn(data, "gstin")) {
    data.gstin =
      data.gstin.toUpperCase();

    if (
      data.gstin &&
      !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(
        data.gstin
      )
    ) {
      throw createError(
        400,
        "Invalid GSTIN format"
      );
    }
  }

  if (hasOwn(data, "email")) {
    data.email =
      data.email.toLowerCase();
  }

  return data;
};

const validatePreferences = (input) => {
  const data = validateSection(
    input,
    allowedPreferenceFields,
    "preferences"
  );

  const allowedValues = {
    theme: [
      "light",
      "dark",
      "system",
    ],
    accent: [
      "lime",
      "blue",
      "purple",
      "orange",
      "cyan",
    ],
    currency: [
      "INR",
      "USD",
      "EUR",
    ],
    dateFormat: [
      "DD/MM/YYYY",
      "MM/DD/YYYY",
      "YYYY-MM-DD",
    ],
  };

  for (const [key, values] of Object.entries(
    allowedValues
  )) {
    if (
      hasOwn(data, key) &&
      !values.includes(data[key])
    ) {
      throw createError(
        400,
        `Invalid ${key} value`
      );
    }
  }

  return data;
};

const validateNotifications = (input) =>
  validateSection(
    input,
    allowedNotificationFields,
    "notifications"
  );

const serializeSettings = (
  workspace,
  personal
) => ({
  company: {
    ...DEFAULT_COMPANY_SETTINGS,
    ...(workspace?.company?.toObject?.() ??
      workspace?.company ??
      {}),
  },

  preferences: {
    ...DEFAULT_PREFERENCES,
    ...(personal?.preferences?.toObject?.() ??
      personal?.preferences ??
      {}),
  },

  notifications: {
    ...DEFAULT_NOTIFICATIONS,
    ...(personal?.notifications?.toObject?.() ??
      personal?.notifications ??
      {}),
  },
});

const sendError = (error, res, next) => {
  if (
    Number.isInteger(error.status) &&
    error.status >= 400 &&
    error.status < 500
  ) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
    });
  }

  if (
    error.name === "ValidationError"
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Settings validation failed",
      errors: Object.values(
        error.errors
      ).map((item) => ({
        field: item.path,
        message: item.message,
      })),
    });
  }

  if (
    error.code === 11000
  ) {
    return res.status(409).json({
      success: false,
      message:
        "Settings were modified concurrently. Please retry.",
    });
  }

  if (
    error.name === "VersionError"
  ) {
    return res.status(409).json({
      success: false,
      message:
        "Settings were modified by another request. Please reload.",
    });
  }

  return next(error);
};

// ======================================
// GET /api/settings
// ======================================

export const getSettings = async (
  req,
  res,
  next
) => {
  try {
    const userId = getUserId(req);

    const [workspace, personal] =
      await Promise.all([
        AppSettings.findOne({
          key: "workspace",
          scope: "workspace",
        }).lean(),

        AppSettings.findOne({
          key: getUserKey(userId),
          scope: "user",
          owner: userId,
        }).lean(),
      ]);

    return res.status(200).json({
      success: true,
      settings: serializeSettings(
        workspace,
        personal
      ),
    });
  } catch (error) {
    return sendError(
      error,
      res,
      next
    );
  }
};

// ======================================
// PATCH /api/settings/company
// ======================================

export const updateCompanySettings =
  async (req, res, next) => {
    try {
      if (!isAdmin(req)) {
        throw createError(
          403,
          "Only Admin can update company settings"
        );
      }

      const userId = getUserId(req);

      if (
        !isPlainObject(req.body) ||
        Object.keys(req.body).some(
          (key) => key !== "company"
        )
      ) {
        throw createError(
          400,
          "Request must contain only the company object"
        );
      }

      const company =
        validateCompany(
          req.body.company
        );

      const updates = {
        updatedBy: userId,
      };

      for (const [key, value] of Object.entries(
        company
      )) {
        updates[`company.${key}`] =
          value;
      }

      const settings =
        await AppSettings.findOneAndUpdate(
          {
            key: "workspace",
            scope: "workspace",
          },
          {
            $set: updates,
            $setOnInsert: {
              key: "workspace",
              scope: "workspace",
              owner: null,
            },
          },
          {
            new: true,
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true,
          }
        );

      return res.status(200).json({
        success: true,
        message:
          "Company settings updated",
        company: {
          ...DEFAULT_COMPANY_SETTINGS,
          ...settings.company.toObject(),
        },
      });
    } catch (error) {
      return sendError(
        error,
        res,
        next
      );
    }
  };

// ======================================
// PATCH /api/settings/preferences
// ======================================

export const updatePreferences =
  async (req, res, next) => {
    try {
      const userId = getUserId(req);

      if (
        !isPlainObject(req.body) ||
        Object.keys(req.body).some(
          (key) => key !== "preferences"
        )
      ) {
        throw createError(
          400,
          "Request must contain only the preferences object"
        );
      }

      const preferences =
        validatePreferences(
          req.body.preferences
        );

      const updates = {
        updatedBy: userId,
      };

      for (const [key, value] of Object.entries(
        preferences
      )) {
        updates[
          `preferences.${key}`
        ] = value;
      }

      const settings =
        await AppSettings.findOneAndUpdate(
          {
            key: getUserKey(
              userId
            ),
            scope: "user",
            owner: userId,
          },
          {
            $set: updates,
            $setOnInsert: {
              key: getUserKey(
                userId
              ),
              scope: "user",
              owner: userId,
            },
          },
          {
            new: true,
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true,
          }
        );

      return res.status(200).json({
        success: true,
        message:
          "Preferences updated",
        preferences: {
          ...DEFAULT_PREFERENCES,
          ...settings.preferences.toObject(),
        },
      });
    } catch (error) {
      return sendError(
        error,
        res,
        next
      );
    }
  };

// ======================================
// PATCH /api/settings/notifications
// ======================================

export const updateNotifications =
  async (req, res, next) => {
    try {
      const userId = getUserId(req);

      if (
        !isPlainObject(req.body) ||
        Object.keys(req.body).some(
          (key) => key !== "notifications"
        )
      ) {
        throw createError(
          400,
          "Request must contain only the notifications object"
        );
      }

      const notifications =
        validateNotifications(
          req.body.notifications
        );

      const updates = {
        updatedBy: userId,
      };

      for (const [key, value] of Object.entries(
        notifications
      )) {
        updates[
          `notifications.${key}`
        ] = value;
      }

      const settings =
        await AppSettings.findOneAndUpdate(
          {
            key: getUserKey(
              userId
            ),
            scope: "user",
            owner: userId,
          },
          {
            $set: updates,
            $setOnInsert: {
              key: getUserKey(
                userId
              ),
              scope: "user",
              owner: userId,
            },
          },
          {
            new: true,
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true,
          }
        );

      return res.status(200).json({
        success: true,
        message:
          "Notification settings updated",
        notifications: {
          ...DEFAULT_NOTIFICATIONS,
          ...settings.notifications.toObject(),
        },
      });
    } catch (error) {
      return sendError(
        error,
        res,
        next
      );
    }
  };
