
import mongoose from "mongoose";

const { Schema } = mongoose;

export const CLIENT_STATUSES = [
  "Active",
  "On Hold",
  "Completed",
  "Inactive",
];

export const CLIENT_SERVICES = [
  "Website Development",
  "E-commerce Development",
  "Web Application",
  "SEO",
  "Website Maintenance",
  "Branding",
  "Other",
];

const clientSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Client name is required"],
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
      enum: CLIENT_SERVICES,
      required: [true, "Service is required"],
    },

    status: {
      type: String,
      enum: CLIENT_STATUSES,
      default: "Active",
    },

    projectName: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },

    contractAmount: {
      type: Number,
      min: [0, "Contract amount cannot be negative"],
      default: 0,
    },

    receivedAmount: {
      type: Number,
      min: [0, "Received amount cannot be negative"],
      default: 0,
    },

    startDate: {
      type: Date,
      default: null,
    },

    deadline: {
      type: Date,
      default: null,
    },

    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
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
  }
);

// Client listing and filtering
clientSchema.index({ status: 1, createdAt: -1 });

// Assigned employee's clients
clientSchema.index({ assignedTo: 1, createdAt: -1 });

// Recent clients
clientSchema.index({ createdAt: -1 });

// Validate project dates
clientSchema.pre("validate", function () {
  if (
    this.startDate &&
    this.deadline &&
    this.deadline < this.startDate
  ) {
    this.invalidate(
      "deadline",
      "Deadline cannot be earlier than start date"
    );
  }

  if (this.receivedAmount > this.contractAmount) {
    this.invalidate(
      "receivedAmount",
      "Received amount cannot exceed contract amount"
    );
  }
});

clientSchema.set("toJSON", {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

// Derived outstanding balance
clientSchema.virtual("pendingAmount").get(function () {
  return Math.max(
    0,
    this.contractAmount - this.receivedAmount
  );
});

const Client =
  mongoose.models.Client ||
  mongoose.model("Client", clientSchema);

export default Client;
