
import mongoose from "mongoose";

const { Schema } = mongoose;

// ======================================
// Lead Status
// ======================================

export const LEAD_STATUSES = [
  "New",
  "Contacted",
  "Interested",
  "Follow Up",
  "Qualified",
  "Converted",
  "Lost",
];

// ======================================
// Lead Sources
// ======================================

export const LEAD_SOURCES = [
  "Website",
  "Google",
  "Instagram",
  "Facebook",
  "LinkedIn",
  "WhatsApp",
  "Referral",
  "Cold Calling",
  "Other",
];

// ======================================
// Lead Priority
// ======================================

export const LEAD_PRIORITIES = [
  "Low",
  "Medium",
  "High",
  "Urgent",
];

// ======================================
// Lead Services
// ======================================

export const LEAD_SERVICES = [
  "Website Development",
  "E-commerce Development",
  "Web Application",
  "SEO",
  "Website Maintenance",
  "Branding",
  "Other",
];

// ======================================
// Lead Schema
// ======================================

const leadSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Lead name is required"],
      trim: true,
      minlength: [2, "Name must contain at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },

    company: {
      type: String,
      trim: true,
      maxlength: 150,
      default: "",
    },

    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      match: [
        /^[6-9]\d{9}$/,
        "Enter a valid 10-digit Indian mobile number",
      ],
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
      default: "",
      validate: {
        validator(value) {
          return (
            !value ||
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
          );
        },
        message: "Enter a valid email address",
      },
    },

    service: {
      type: String,
      enum: LEAD_SERVICES,
      required: [true, "Service is required"],
    },

    source: {
      type: String,
      enum: LEAD_SOURCES,
      default: "Other",
    },

    status: {
      type: String,
      enum: LEAD_STATUSES,
      default: "New",
    },

    priority: {
      type: String,
      enum: LEAD_PRIORITIES,
      default: "Medium",
    },

    estimatedValue: {
      type: Number,
      min: [0, "Estimated value cannot be negative"],
      max: [999999999999, "Estimated value is too large"],
      default: 0,
    },

    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    nextFollowUp: {
      type: Date,
      default: null,
    },

    lastContactedAt: {
      type: Date,
      default: null,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },

    convertedClient: {
      type: Schema.Types.ObjectId,
      ref: "Client",
      default: null,
    },

    convertedAt: {
      type: Date,
      default: null,
    },

    lostReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
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
  }
);

// ======================================
// Database Indexes
// ======================================

// Filter by lead status
leadSchema.index({
  status: 1,
  createdAt: -1,
});

// Employee assigned leads
leadSchema.index({
  assignedTo: 1,
  status: 1,
  createdAt: -1,
});

// Upcoming follow-ups
leadSchema.index({
  nextFollowUp: 1,
  status: 1,
});

// Filter by source
leadSchema.index({
  source: 1,
  createdAt: -1,
});

// Recent leads
leadSchema.index({
  createdAt: -1,
});

// Prevent a client from being linked
// as the converted client of multiple leads
leadSchema.index(
  { convertedClient: 1 },
  {
    unique: true,
    partialFilterExpression: {
      convertedClient: { $type: "objectId" },
    },
  }
);

// ======================================
// Schema Validation
// ======================================

leadSchema.pre("validate", function () {
  if (
    this.status === "Converted" &&
    (!this.convertedClient || !this.convertedAt)
  ) {
    this.invalidate(
      "convertedClient",
      "Converted leads must have a client and conversion date"
    );
  }

  if (
    this.status !== "Converted" &&
    (this.convertedClient || this.convertedAt)
  ) {
    this.invalidate(
      "status",
      "Conversion details require Converted status"
    );
  }
});

// ======================================
// JSON Response Formatting
// ======================================

leadSchema.set("toJSON", {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

// ======================================
// Virtual Fields
// ======================================

leadSchema.virtual("isFollowUpOverdue").get(function () {
  if (
    !this.nextFollowUp ||
    ["Converted", "Lost"].includes(this.status)
  ) {
    return false;
  }

  return this.nextFollowUp.getTime() < Date.now();
});

// ======================================
// Export Model
// ======================================

const Lead =
  mongoose.models.Lead ||
  mongoose.model("Lead", leadSchema);

export default Lead;
