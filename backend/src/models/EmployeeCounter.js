
import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ======================================
// Employee Counter Schema
// ======================================

const employeeCounterSchema = new Schema(
  {
    // Unique counter identifier
    key: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      default: "employee",
    },

    // Last allocated sequence number
    sequence: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
  },
  {
    timestamps: true,
    versionKey: "__v",
  }
);

// ======================================
// Database Indexes
// ======================================

// Unique index is already created by
// unique: true on the "key" field.

// ======================================
// Atomic Sequence Generator
// ======================================

employeeCounterSchema.statics.getNextSequence =
  async function (session = null) {
    const options = {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    };

    if (session) {
      options.session = session;
    }

    const counter =
      await this.findOneAndUpdate(
        { key: "employee" },
        {
          $inc: {
            sequence: 1,
          },
          $setOnInsert: {
            key: "employee",
          },
        },
        options
      );

    if (
      !counter ||
      !Number.isSafeInteger(counter.sequence) ||
      counter.sequence < 1
    ) {
      throw new Error(
        "Failed to generate employee sequence"
      );
    }

    return counter.sequence;
  };

// ======================================
// Employee ID Generator
// ======================================

employeeCounterSchema.statics.generateEmployeeId =
  async function (session = null) {
    const sequence =
      await this.getNextSequence(session);

    const paddedNumber = String(
      sequence
    ).padStart(4, "0");

    return `WEBRO-EMP-${paddedNumber}`;
  };

// ======================================
// Export Model
// ======================================

const EmployeeCounter =
  models.EmployeeCounter ||
  model(
    "EmployeeCounter",
    employeeCounterSchema
  );

export default EmployeeCounter;
