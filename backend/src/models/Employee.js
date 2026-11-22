
import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ======================================
// Employee Constants
// ======================================

export const EMPLOYEE_DEPARTMENTS = [
  "Development",
  "Design",
  "Marketing",
  "Sales",
  "Operations",
  "Human Resources",
  "Finance",
  "Management",
  "Other",
];

export const EMPLOYMENT_TYPES = [
  "Full Time",
  "Part Time",
  "Internship",
  "Contract",
  "Freelance",
];

export const EMPLOYEE_STATUSES = [
  "Active",
  "On Leave",
  "Notice Period",
  "Resigned",
  "Terminated",
];

export const WORK_MODES = [
  "Office",
  "Remote",
  "Hybrid",
];

export const SALARY_TYPES = [
  "Monthly",
  "Hourly",
  "Annual",
];

// ======================================
// Emergency Contact Schema
// ======================================

const emergencyContactSchema = new Schema(
  {
    name: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },

    relationship: {
      type: String,
      trim: true,
      maxlength: 50,
      default: "",
    },

    phone: {
      type: String,
      trim: true,
      maxlength: 20,
      default: "",
    },
  },
  {
    _id: false,
  }
);

// ======================================
// Employee Schema
// ======================================

const employeeSchema = new Schema(
  {
    // ----------------------------------
    // User Account
    // ----------------------------------

    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    // ----------------------------------
    // Employee Identity
    // ----------------------------------

    employeeId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: [
        /^WEBRO-EMP-[A-Z0-9-]+$/,
        "Invalid employee ID format",
      ],
    },

    // ----------------------------------
    // Personal Information
    // ----------------------------------

    dateOfBirth: {
      type: Date,
      default: null,
    },

    gender: {
      type: String,
      enum: [
        "Male",
        "Female",
        "Other",
        "Prefer Not to Say",
      ],
      default: null,
    },

    address: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    city: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },

    state: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },

    country: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "India",
    },

    // ----------------------------------
    // Employment Details
    // ----------------------------------

    department: {
      type: String,
      enum: EMPLOYEE_DEPARTMENTS,
      required: true,
    },

    designation: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    employmentType: {
      type: String,
      enum: EMPLOYMENT_TYPES,
      default: "Full Time",
    },

    status: {
      type: String,
      enum: EMPLOYEE_STATUSES,
      default: "Active",
    },

    workMode: {
      type: String,
      enum: WORK_MODES,
      default: "Office",
    },

    joiningDate: {
      type: Date,
      required: true,
    },

    confirmationDate: {
      type: Date,
      default: null,
    },

    exitDate: {
      type: Date,
      default: null,
    },

    // ----------------------------------
    // Reporting Manager
    // ----------------------------------

    reportingManager: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ----------------------------------
    // Salary Information
    // ----------------------------------

    salary: {
      amount: {
        type: Number,
        min: 0,
        max: 999999999999,
        default: 0,
      },

      currency: {
        type: String,
        enum: ["INR"],
        default: "INR",
      },

      type: {
        type: String,
        enum: SALARY_TYPES,
        default: "Monthly",
      },
    },

    // ----------------------------------
    // Emergency Contact
    // ----------------------------------

    emergencyContact: {
      type: emergencyContactSchema,
      default: () => ({}),
    },

    // ----------------------------------
    // Skills
    // ----------------------------------

    skills: {
      type: [
        {
          type: String,
          trim: true,
          maxlength: 100,
        },
      ],
      default: [],
      validate: {
        validator: (skills) =>
          skills.length <= 50,
        message:
          "An employee cannot have more than 50 skills",
      },
    },

    // ----------------------------------
    // Additional Notes
    // ----------------------------------

    notes: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },

    // ----------------------------------
    // Audit Information
    // ----------------------------------

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
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
// Employee Validation
// ======================================

employeeSchema.pre("validate", function () {
  if (
    this.confirmationDate &&
    this.joiningDate &&
    this.confirmationDate < this.joiningDate
  ) {
    this.invalidate(
      "confirmationDate",
      "Confirmation date cannot be before joining date"
    );
  }

  if (
    this.exitDate &&
    this.joiningDate &&
    this.exitDate < this.joiningDate
  ) {
    this.invalidate(
      "exitDate",
      "Exit date cannot be before joining date"
    );
  }

  if (
    this.reportingManager &&
    this.user &&
    String(this.reportingManager) ===
      String(this.user)
  ) {
    this.invalidate(
      "reportingManager",
      "An employee cannot be their own reporting manager"
    );
  }

  if (
    this.dateOfBirth &&
    this.joiningDate &&
    this.dateOfBirth >= this.joiningDate
  ) {
    this.invalidate(
      "dateOfBirth",
      "Date of birth must be before joining date"
    );
  }

  if (
    ["Resigned", "Terminated"].includes(
      this.status
    ) &&
    !this.exitDate
  ) {
    this.invalidate(
      "exitDate",
      "Exit date is required for resigned or terminated employees"
    );
  }

  if (
    !["Resigned", "Terminated"].includes(
      this.status
    ) &&
    this.exitDate
  ) {
    this.invalidate(
      "exitDate",
      "Exit date is only allowed for resigned or terminated employees"
    );
  }

  const amount = this.salary?.amount;

  if (
    amount !== undefined &&
    amount !== null &&
    Math.round(amount * 100) !==
      amount * 100
  ) {
    this.invalidate(
      "salary.amount",
      "Salary amount supports at most two decimal places"
    );
  }
});

// ======================================
// Virtual Fields
// ======================================

employeeSchema.virtual("isActive").get(
  function () {
    return this.status === "Active";
  }
);

employeeSchema.virtual(
  "isCurrentlyEmployed"
).get(function () {
  return ![
    "Resigned",
    "Terminated",
  ].includes(this.status);
});

employeeSchema.virtual(
  "employmentDurationMonths"
).get(function () {
  if (!this.joiningDate) return 0;

  const endDate =
    this.exitDate || new Date();

  const start = new Date(
    this.joiningDate
  );

  const end = new Date(endDate);

  if (end < start) return 0;

  let months =
    (end.getUTCFullYear() -
      start.getUTCFullYear()) *
      12 +
    (end.getUTCMonth() -
      start.getUTCMonth());

  if (
    end.getUTCDate() <
    start.getUTCDate()
  ) {
    months -= 1;
  }

  return Math.max(0, months);
});

// ======================================
// Database Indexes
// ======================================

// One employee profile per user account
employeeSchema.index(
  { user: 1 },
  { unique: true }
);

// Department and employment status
employeeSchema.index({
  department: 1,
  status: 1,
});

// Reporting manager dashboard
employeeSchema.index({
  reportingManager: 1,
  status: 1,
});

// Employee joining reports
employeeSchema.index({
  joiningDate: -1,
});

// Employment type filtering
employeeSchema.index({
  employmentType: 1,
  status: 1,
});

// Employee directory
employeeSchema.index({
  designation: 1,
  department: 1,
});

// ======================================
// Export Employee Model
// ======================================

const Employee =
  models.Employee ||
  model("Employee", employeeSchema);

export default Employee;
