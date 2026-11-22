
import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ======================================
// Constants
// ======================================

export const PROJECT_STATUSES = [
  "Planning",
  "In Progress",
  "On Hold",
  "In Review",
  "Completed",
  "Cancelled",
];

export const PROJECT_PRIORITIES = [
  "Low",
  "Medium",
  "High",
  "Urgent",
];

export const PROJECT_TYPES = [
  "Website Development",
  "E-commerce Development",
  "Web Application",
  "SEO",
  "Website Maintenance",
  "Branding",
  "Other",
];

export const MILESTONE_STATUSES = [
  "Pending",
  "In Progress",
  "Completed",
];

// ======================================
// Milestone Schema
// ======================================

const milestoneSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 150,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    status: {
      type: String,
      enum: MILESTONE_STATUSES,
      default: "Pending",
    },

    dueDate: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    order: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  {
    _id: true,
    timestamps: true,
  }
);

milestoneSchema.pre("validate", function () {
  if (this.status === "Completed") {
    if (!this.completedAt) {
      this.invalidate(
        "completedAt",
        "Completed milestone requires completedAt"
      );
    }
  } else if (this.completedAt) {
    this.invalidate(
      "completedAt",
      "Only completed milestones can have completedAt"
    );
  }
});

// ======================================
// Project Schema
// ======================================

const projectSchema = new Schema(
  {
    name: {
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

    client: {
      type: Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },

    type: {
      type: String,
      enum: PROJECT_TYPES,
      required: true,
    },

    status: {
      type: String,
      enum: PROJECT_STATUSES,
      default: "Planning",
    },

    priority: {
      type: String,
      enum: PROJECT_PRIORITIES,
      default: "Medium",
    },

    projectManager: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    assignedTo: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: [],
    },

    startDate: {
      type: Date,
      default: null,
    },

    deadline: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    budget: {
      type: Number,
      min: 0,
      max: 999999999999,
      default: 0,
    },

    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    milestones: {
      type: [milestoneSchema],
      default: [],
    },

    repositoryUrl: {
      type: String,
      trim: true,
      maxlength: 2048,
      default: "",
    },

    liveUrl: {
      type: String,
      trim: true,
      maxlength: 2048,
      default: "",
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 5000,
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

projectSchema.pre("validate", function () {
  // Deadline cannot be before start date.
  if (
    this.startDate &&
    this.deadline &&
    this.deadline.getTime() <
      this.startDate.getTime()
  ) {
    this.invalidate(
      "deadline",
      "Deadline cannot be before start date"
    );
  }

  // Completed project requires completion date.
  if (this.status === "Completed") {
    if (!this.completedAt) {
      this.invalidate(
        "completedAt",
        "Completed project requires completedAt"
      );
    }

    if (this.progress !== 100) {
      this.invalidate(
        "progress",
        "Completed project must have 100% progress"
      );
    }
  } else if (this.completedAt) {
    this.invalidate(
      "completedAt",
      "Only completed projects can have completedAt"
    );
  }

  // Prevent duplicate employee assignments.
  const employeeIds = this.assignedTo.map(
    (employeeId) => String(employeeId)
  );

  if (
    new Set(employeeIds).size !== employeeIds.length
  ) {
    this.invalidate(
      "assignedTo",
      "Duplicate employee assignments are not allowed"
    );
  }

  // Validate milestone deadlines.
  if (this.startDate || this.deadline) {
    this.milestones.forEach((milestone, index) => {
      if (!milestone.dueDate) return;

      if (
        this.startDate &&
        milestone.dueDate < this.startDate
      ) {
        this.invalidate(
          `milestones.${index}.dueDate`,
          "Milestone cannot be before project start date"
        );
      }

      if (
        this.deadline &&
        milestone.dueDate > this.deadline
      ) {
        this.invalidate(
          `milestones.${index}.dueDate`,
          "Milestone cannot be after project deadline"
        );
      }
    });
  }
});

// ======================================
// Virtual Fields
// ======================================

projectSchema.virtual("isOverdue").get(function () {
  return (
    this.deadline instanceof Date &&
    this.deadline.getTime() < Date.now() &&
    !["Completed", "Cancelled"].includes(this.status)
  );
});

projectSchema.virtual("remainingDays").get(function () {
  if (!this.deadline) return null;

  if (
    ["Completed", "Cancelled"].includes(this.status)
  ) {
    return null;
  }

  const difference =
    this.deadline.getTime() - Date.now();

  return Math.ceil(
    difference / (1000 * 60 * 60 * 24)
  );
});

projectSchema.virtual("completedMilestones").get(
  function () {
    return this.milestones.filter(
      (milestone) =>
        milestone.status === "Completed"
    ).length;
  }
);

projectSchema.virtual("totalMilestones").get(
  function () {
    return this.milestones.length;
  }
);

// ======================================
// Database Indexes
// ======================================

// Client's projects
projectSchema.index({
  client: 1,
  createdAt: -1,
});

// Projects by status
projectSchema.index({
  status: 1,
  createdAt: -1,
});

// Assigned employee projects
projectSchema.index({
  assignedTo: 1,
  status: 1,
});

// Project manager's projects
projectSchema.index({
  projectManager: 1,
  status: 1,
});

// Upcoming deadlines
projectSchema.index({
  deadline: 1,
  status: 1,
});

// Priority
projectSchema.index({
  priority: 1,
  createdAt: -1,
});

// Recent projects
projectSchema.index({
  createdAt: -1,
});

// ======================================
// Export Model
// ======================================

const Project =
  models.Project || model("Project", projectSchema);

export default Project;
