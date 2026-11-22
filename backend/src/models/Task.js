
import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ======================================
// Task Constants
// ======================================

export const TASK_STATUSES = [
  "Todo",
  "In Progress",
  "In Review",
  "Completed",
  "On Hold",
  "Cancelled",
];

export const TASK_PRIORITIES = [
  "Low",
  "Medium",
  "High",
  "Urgent",
];

export const TASK_TYPES = [
  "Frontend",
  "Backend",
  "UI/UX Design",
  "Database",
  "Testing",
  "Deployment",
  "Bug Fix",
  "SEO",
  "Content",
  "Maintenance",
  "Other",
];

// ======================================
// Task Checklist Schema
// ======================================

const checklistItemSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 200,
    },

    isCompleted: {
      type: Boolean,
      default: false,
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
  },
  {
    _id: true,
    timestamps: false,
    versionKey: false,
  }
);

// ======================================
// Task Schema
// ======================================

const taskSchema = new Schema(
  {
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
      maxlength: 10000,
      default: "",
    },

    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },

    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    type: {
      type: String,
      enum: TASK_TYPES,
      default: "Other",
    },

    status: {
      type: String,
      enum: TASK_STATUSES,
      default: "Todo",
    },

    priority: {
      type: String,
      enum: TASK_PRIORITIES,
      default: "Medium",
    },

    startDate: {
      type: Date,
      default: null,
    },

    dueDate: {
      type: Date,
      default: null,
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

    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    estimatedHours: {
      type: Number,
      min: 0,
      max: 100000,
      default: 0,
    },

    actualHours: {
      type: Number,
      min: 0,
      max: 100000,
      default: 0,
    },

    checklist: {
      type: [checklistItemSchema],
      default: [],
      validate: {
        validator: (items) => items.length <= 100,
        message:
          "A task cannot contain more than 100 checklist items",
      },
    },

    tags: {
      type: [
        {
          type: String,
          trim: true,
          maxlength: 50,
        },
      ],
      default: [],
      validate: {
        validator: (tags) => tags.length <= 20,
        message:
          "A task cannot have more than 20 tags",
      },
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

    versionKey: "__v",

    optimisticConcurrency: true,

    toJSON: {
      virtuals: true,

      transform(_doc, ret) {
        ret.id = ret._id.toString();

        delete ret._id;
        delete ret.__v;

        return ret;
      },
    },
  }
);

// ======================================
// Task Validation
// ======================================

taskSchema.pre("validate", function () {
  if (
    this.startDate &&
    this.dueDate &&
    this.dueDate < this.startDate
  ) {
    this.invalidate(
      "dueDate",
      "Due date cannot be before start date"
    );
  }

  if (
    this.status === "Completed" &&
    this.progress !== 100
  ) {
    this.invalidate(
      "progress",
      "Completed tasks must have 100% progress"
    );
  }

  if (
    this.status !== "Completed" &&
    this.progress === 100
  ) {
    this.invalidate(
      "progress",
      "Tasks with 100% progress must be completed"
    );
  }

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
        "Completion user is required"
      );
    }
  }

  if (
    this.status !== "Completed" &&
    (this.completedAt || this.completedBy)
  ) {
    this.invalidate(
      "completedAt",
      "Only completed tasks can have completion details"
    );
  }

  for (const item of this.checklist) {
    if (item.isCompleted) {
      if (!item.completedAt || !item.completedBy) {
        item.invalidate(
          "completedAt",
          "Completed checklist items require completion date and user"
        );
      }
    } else if (item.completedAt || item.completedBy) {
      item.invalidate(
        "completedAt",
        "Incomplete checklist items cannot have completion details"
      );
    }
  }
});

// ======================================
// Virtual Fields
// ======================================

taskSchema.virtual("isOverdue").get(function () {
  return (
    this.dueDate instanceof Date &&
    this.dueDate.getTime() < Date.now() &&
    !["Completed", "Cancelled"].includes(
      this.status
    )
  );
});

taskSchema.virtual("checklistProgress").get(
  function () {
    if (this.checklist.length === 0) {
      return 0;
    }

    const completed =
      this.checklist.filter(
        (item) => item.isCompleted
      ).length;

    return Math.round(
      (completed / this.checklist.length) * 100
    );
  }
);

taskSchema.virtual("remainingHours").get(
  function () {
    return Math.max(
      0,
      this.estimatedHours - this.actualHours
    );
  }
);

// ======================================
// Database Indexes
// ======================================

// Project-wise tasks
taskSchema.index({
  project: 1,
  createdAt: -1,
});

// Employee task dashboard
taskSchema.index({
  assignedTo: 1,
  status: 1,
  dueDate: 1,
});

// Priority-based filtering
taskSchema.index({
  priority: 1,
  dueDate: 1,
});

// Task status reporting
taskSchema.index({
  status: 1,
  createdAt: -1,
});

// Overdue task queries
taskSchema.index({
  dueDate: 1,
  status: 1,
});

// Creator-based filtering
taskSchema.index({
  createdBy: 1,
  createdAt: -1,
});

// ======================================
// Export Task Model
// ======================================

const Task =
  models.Task || model("Task", taskSchema);

export default Task;
