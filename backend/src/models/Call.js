
import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ======================================
// Calling Management Constants
// ======================================

export const CALL_DIRECTIONS = [
  "Outgoing",
  "Incoming",
];

export const CALL_STATUSES = [
  "Completed",
  "No Answer",
  "Busy",
  "Failed",
  "Cancelled",
];

export const CALL_OUTCOMES = [
  "Interested",
  "Not Interested",
  "Callback Requested",
  "Follow Up Required",
  "Meeting Scheduled",
  "Converted",
  "No Response",
  "Other",
];

export const CALL_CONTACT_TYPES = [
  "Lead",
  "Client",
];

// ======================================
// Call Schema
// ======================================

const callSchema = new Schema(
  {
    contactType: {
      type: String,
      enum: CALL_CONTACT_TYPES,
      required: true,
      trim: true,
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

    contactName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
      match: [
        /^[6-9]\d{9}$/,
        "Enter a valid 10-digit Indian mobile number",
      ],
    },

    direction: {
      type: String,
      enum: CALL_DIRECTIONS,
      default: "Outgoing",
    },

    status: {
      type: String,
      enum: CALL_STATUSES,
      required: true,
    },

    outcome: {
      type: String,
      enum: CALL_OUTCOMES,
      default: "Other",
    },

    durationSeconds: {
      type: Number,
      default: 0,
      min: 0,
      max: 86400,
      validate: {
        validator: Number.isInteger,
        message: "Call duration must be an integer",
      },
    },

    calledAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    nextFollowUp: {
      type: Date,
      default: null,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },

    calledBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
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

callSchema.pre("validate", function () {
  if (this.contactType === "Lead") {
    if (!this.lead) {
      this.invalidate(
        "lead",
        "Lead reference is required for a Lead call"
      );
    }

    if (this.client) {
      this.invalidate(
        "client",
        "Client reference must be empty for a Lead call"
      );
    }
  }

  if (this.contactType === "Client") {
    if (!this.client) {
      this.invalidate(
        "client",
        "Client reference is required for a Client call"
      );
    }

    if (this.lead) {
      this.invalidate(
        "lead",
        "Lead reference must be empty for a Client call"
      );
    }
  }

  if (
    this.status !== "Completed" &&
    this.durationSeconds > 0
  ) {
    this.invalidate(
      "durationSeconds",
      "Only completed calls can have a duration"
    );
  }

  if (
    this.status !== "Completed" &&
    this.outcome !== "Other" &&
    this.outcome !== "No Response"
  ) {
    this.invalidate(
      "outcome",
      "This outcome requires a completed call"
    );
  }

  if (
    this.nextFollowUp &&
    this.calledAt &&
    this.nextFollowUp <= this.calledAt
  ) {
    this.invalidate(
      "nextFollowUp",
      "Follow-up must be after the call date"
    );
  }
});

// ======================================
// Virtual Fields
// ======================================

callSchema.virtual("durationMinutes").get(function () {
  return Number(
    (this.durationSeconds / 60).toFixed(2)
  );
});

callSchema.virtual("hasFollowUp").get(function () {
  return Boolean(this.nextFollowUp);
});

// ======================================
// Database Indexes
// ======================================

// Recent calls
callSchema.index({
  calledAt: -1,
  _id: -1,
});

// Employee call history
callSchema.index({
  calledBy: 1,
  calledAt: -1,
});

// Lead call history
callSchema.index({
  lead: 1,
  calledAt: -1,
});

// Client call history
callSchema.index({
  client: 1,
  calledAt: -1,
});

// Follow-up scheduling
callSchema.index({
  nextFollowUp: 1,
  status: 1,
});

// Call outcome reports
callSchema.index({
  outcome: 1,
  calledAt: -1,
});

// ======================================
// Export Model
// ======================================

const Call = models.Call || model("Call", callSchema);

export default Call;
