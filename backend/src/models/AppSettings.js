
import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ======================================
// Constants
// ======================================

export const SETTINGS_SCOPES = [
  "workspace",
  "user",
];

export const DEFAULT_COMPANY_SETTINGS = {
  name: "WEBRO Studio",
  email: "",
  phone: "",
  website: "https://webro.studio",
  address: "",
  gstin: "",
};

export const DEFAULT_PREFERENCES = {
  theme: "dark",
  accent: "lime",
  currency: "INR",
  dateFormat: "DD/MM/YYYY",
  compactMode: false,
};

export const DEFAULT_NOTIFICATIONS = {
  taskReminders: true,
  followUpReminders: true,
  paymentReminders: true,
  projectDeadlines: true,
  desktopNotifications: false,
};

// ======================================
// Company Settings
// ======================================

const companySchema = new Schema(
  {
    name: {
      type: String,
      trim: true,
      required: true,
      minlength: 2,
      maxlength: 150,
      default: DEFAULT_COMPANY_SETTINGS.name,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
      default: "",
      match: [
        /^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Invalid company email",
      ],
    },

    phone: {
      type: String,
      trim: true,
      maxlength: 25,
      default: "",
    },

    website: {
      type: String,
      trim: true,
      maxlength: 500,
      default: DEFAULT_COMPANY_SETTINGS.website,
      validate: {
        validator(value) {
          if (!value) return true;

          try {
            const url = new URL(value);

            return (
              ["http:", "https:"].includes(
                url.protocol
              ) &&
              Boolean(url.hostname)
            );
          } catch {
            return false;
          }
        },
        message: "Invalid company website URL",
      },
    },

    address: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
      validate: {
        validator(value) {
          return (
            value === "" ||
            /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(
              value
            )
          );
        },
        message: "Invalid GSTIN format",
      },
    },
  },
  {
    _id: false,
    strict: "throw",
  }
);

// ======================================
// Display Preferences
// ======================================

const preferencesSchema = new Schema(
  {
    theme: {
      type: String,
      enum: ["light", "dark", "system"],
      default: DEFAULT_PREFERENCES.theme,
    },

    accent: {
      type: String,
      enum: [
        "lime",
        "blue",
        "purple",
        "orange",
        "cyan",
      ],
      default: DEFAULT_PREFERENCES.accent,
    },

    currency: {
      type: String,
      enum: ["INR", "USD", "EUR"],
      default: DEFAULT_PREFERENCES.currency,
    },

    dateFormat: {
      type: String,
      enum: [
        "DD/MM/YYYY",
        "MM/DD/YYYY",
        "YYYY-MM-DD",
      ],
      default: DEFAULT_PREFERENCES.dateFormat,
    },

    compactMode: {
      type: Boolean,
      default: DEFAULT_PREFERENCES.compactMode,
    },
  },
  {
    _id: false,
    strict: "throw",
  }
);

// ======================================
// Notification Preferences
// ======================================

const notificationsSchema = new Schema(
  {
    taskReminders: {
      type: Boolean,
      default: DEFAULT_NOTIFICATIONS.taskReminders,
    },

    followUpReminders: {
      type: Boolean,
      default: DEFAULT_NOTIFICATIONS.followUpReminders,
    },

    paymentReminders: {
      type: Boolean,
      default: DEFAULT_NOTIFICATIONS.paymentReminders,
    },

    projectDeadlines: {
      type: Boolean,
      default: DEFAULT_NOTIFICATIONS.projectDeadlines,
    },

    desktopNotifications: {
      type: Boolean,
      default:
        DEFAULT_NOTIFICATIONS.desktopNotifications,
    },
  },
  {
    _id: false,
    strict: "throw",
  }
);

// ======================================
// Main Settings Schema
// ======================================

const appSettingsSchema = new Schema(
  {
    // workspace = company-wide settings
    // user = personal preferences
    scope: {
      type: String,
      enum: SETTINGS_SCOPES,
      required: true,
      immutable: true,
    },

    // Deterministic unique document key:
    //
    // workspace
    // user:<MongoDB User ObjectId>
    //
    // This avoids duplicate settings documents.

    key: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
    },

    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      immutable: true,
    },

    company: {
      type: companySchema,
      default: undefined,
    },

    preferences: {
      type: preferencesSchema,
      default: undefined,
    },

    notifications: {
      type: notificationsSchema,
      default: undefined,
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    strict: "throw",
    optimisticConcurrency: true,
    collection: "app_settings",
  }
);

// ======================================
// Scope Validation
// ======================================

appSettingsSchema.pre("validate", function () {
  if (this.scope === "workspace") {
    if (this.key !== "workspace") {
      this.invalidate(
        "key",
        "Workspace settings must use key 'workspace'"
      );
    }

    if (this.owner !== null) {
      this.invalidate(
        "owner",
        "Workspace settings cannot have an owner"
      );
    }

    if (
      this.preferences !== undefined ||
      this.notifications !== undefined
    ) {
      this.invalidate(
        "scope",
        "Workspace settings cannot contain personal preferences"
      );
    }
  }

  if (this.scope === "user") {
    if (!this.owner) {
      this.invalidate(
        "owner",
        "User settings require an owner"
      );
    } else if (
      this.key !== `user:${String(this.owner)}`
    ) {
      this.invalidate(
        "key",
        "Invalid user settings key"
      );
    }

    if (this.company !== undefined) {
      this.invalidate(
        "company",
        "User settings cannot contain company details"
      );
    }
  }
});

// ======================================
// Model
// ======================================

const AppSettings =
  models.AppSettings ||
  model("AppSettings", appSettingsSchema);

export default AppSettings;
