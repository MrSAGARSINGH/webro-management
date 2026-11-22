
import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ======================================
// Constants
// ======================================

export const FOLLOW_UP_CONTACT_TYPES = [
  "Lead",
  "Client",
];

export const FOLLOW_UP_STATUSES = [
  "Pending",
  "In Progress",
  "Completed",
  "Cancelled",
];

export const FOLLOW_UP_PRIORITIES = [
  "Low",
  "Medium",
  "High",
  "Urgent",
];

export const FOLLOW_UP_TYPES = [
  "Call",
  "WhatsApp",
  "Email",
  "Meeting",
  "Demo",
  "Other",
];

// ======================================
// Follow-up Schema
// ======================================

const followUpSchema = new Schema(
  {
    contactType: {
      type: String,
      enum: FOLLOW_UP_CONTACT_TYPES,
      required: true,
    },

    lead: {
      type: Schema.Types.ObjectId,
      ref: "Lead",
      default: null,
    },

    client: {
      type: Schema.Types.ObjectId,
      ref: "Client",
      default: null,
    },

    call: {
      type: Schema.Types.ObjectId,
      ref: "Call",
      default: null,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 200,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },

    type: {
      type: String,
      enum: FOLLOW_UP_TYPES,
      default: "Call",
    },

    status: {
      type: String,
      enum: FOLLOW_UP_STATUSES,
      default: "Pending",
    },

    priority: {
      type: String,
      enum: FOLLOW_UP_PRIORITIES,
      default: "Medium",
    },

    scheduledAt: {
      type: Date,
      required: true,
    },

    reminderAt: {
      type: Date,
      default: null,
    },

    reminderSentAt: {
      type: Date,
      default: null,
    },

    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    completedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    completionNotes: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    cancellationReason: {
      type: String,
      trim: true,
      maxlength:1000,
      default: "",
    },
  },
  {
    timestamps: true,
    versionKey: false,

    toJSON: {
      virtuals: true,

      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        return ret;
      },
    },
  }
);

// ======================================
// Schema Validation
// ======================================

followUpSchema.pre("validate", function () {
  // Contact must reference exactly one type.

  if (this.contactType === "Lead") {
    if (!this.lead) {
      this.invalidate(
        "lead",
        "Lead reference is required"
      );
    }

    if (this.client) {
      this.invalidate(
        "client",
        "Client reference must be empty"
      );
    }
  }

  if (this.contactType === "Client") {
    if (!this.client) {
      this.invalidate(
        "client",
        "Client reference is required"
      );
    }

    if (this.lead) {
      this.invalidate(
        "lead",
        "Lead reference must be empty"
      );
    }
  }

  // Reminder must be before the scheduled time.

  if (
    this.reminderAt &&
    this.scheduledAt &&
    this.reminderAt > this.scheduledAt
  ) {
    this.invalidate(
      "reminderAt",
      "Reminder cannot be after scheduled time"
    );
  }

  // Completed follow-ups require completion metadata.

  if (this.status === "Completed") {
    if (!this.completedAt) {
      this.invalidate(
        "completedAt",
        "Completion date is required"
      );
    }

    if (!this.completedBy) {
      this.invalidate(
        "completedBy",
        "Completed by is required"
      );
    }
  } else if (this.completedAt || this.completedBy) {
    this.invalidate(
      "status",
      "Completion metadata requires Completed status"
    );
  }

  // Cancelled follow-ups require cancellation date.

  if (this.status === "Cancelled") {
    if (!this.cancelledAt) {
      this.invalidate(
        "cancelledAt",
        "Cancellation date is required"
      );
    }
  } else if (this.cancelledAt) {
    this.invalidate(
      "cancelledAt",
      "Cancellation metadata requires Cancelled status"
    );
  }
});

// ======================================
// Virtual Fields
// ======================================

followUpSchema.virtual("isOverdue").get(function () {
  return (
    ["Pending", "In Progress"].includes(this.status) &&
    this.scheduledAt instanceof Date &&
    this.scheduledAt.getTime() < Date.now()
  );
});

followUpSchema.virtual("isDueToday").get(function () {
  if (
    !this.scheduledAt ||
    !["Pending", "In Progress"].includes(this.status)
  ) {
    return false;
  }

  const now = new Date();
  const scheduled = new Date(this.scheduledAt);

  return (
    now.getUTCFullYear() === scheduled.getUTCFullYear() &&
    now.getUTCMonth() === scheduled.getUTCMonth() &&
    now.getUTCDate() === scheduled.getUTCDate()
  );
});

// ======================================
// Database Indexes
// ======================================

// Employee's upcoming follow-ups
followUpSchema.index({
  assignedTo: 1,
  status: 1,
  scheduledAt: 1,
});

// Dashboard upcoming follow-ups
followUpSchema.index({
  status: 1,
  scheduledAt: 1,
});

// Lead follow-up history
followUpSchema.index({
  lead: 1,
  scheduledAt: -1,
});

// Client follow-up history
followUpSchema.index({
  client: 1,
  scheduledAt: -1,
});

// Call-linked follow-ups
followUpSchema.index({
  call: 1,
});

// Pending reminders
followUpSchema.index({
  reminderAt: 1,
  reminderSentAt: 1,
  status: 1,
});

// Recent follow-ups
followUpSchema.index({
  createdAt: -1,
});

// ======================================
// Export Model
// ======================================

const FollowUp =
  models.FollowUp || model("FollowUp", followUpSchema);

export default FollowUp;
