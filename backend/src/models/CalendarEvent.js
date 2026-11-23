
import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ======================================
// Calendar Constants
// ======================================

export const CALENDAR_EVENT_TYPES = [
  "Meeting",
  "Reminder",
  "Call",
  "Deadline",
  "Other",
];

export const CALENDAR_EVENT_VISIBILITIES = [
  "Private",
  "Team",
];

// ======================================
// Date and Time Validation
// ======================================

const isValidDateKey = (value) => {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const [year, month, day] = value
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const isValidTime = (value) =>
  value === "" ||
  /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

// ======================================
// Calendar Event Schema
// ======================================

const calendarEventSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, "Event title is required"],
      trim: true,
      minlength: [2, "Title is too short"],
      maxlength: [200, "Title is too long"],
    },

    type: {
      type: String,
      enum: CALENDAR_EVENT_TYPES,
      default: "Meeting",
      required: true,
    },

    // Store calendar dates without timezone shifts.
    // Format: YYYY-MM-DD

    date: {
      type: String,
      required: [true, "Event date is required"],
      validate: {
        validator: isValidDateKey,
        message: "Date must be a valid YYYY-MM-DD date",
      },
    },

    // Local wall-clock time: HH:mm
    // Empty string represents an all-day event.

    time: {
      type: String,
      default: "",
      validate: {
        validator: isValidTime,
        message: "Time must use HH:mm format",
      },
    },

    description: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },

    location: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },

    // User who created the event.

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    // Private: only the creator.
    // Team: accessible to authorized workspace users
    // when enforced by the controller.

    visibility: {
      type: String,
      enum: CALENDAR_EVENT_VISIBILITIES,
      default: "Private",
      required: true,
    },

    // Optional attendees. These must be User IDs.

    attendees: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: [],
      validate: {
        validator: (value) =>
          Array.isArray(value) &&
          value.length <= 100 &&
          new Set(value.map(String)).size ===
            value.length,
        message:
          "Attendees must be unique and cannot exceed 100 users",
      },
    },

    // Optional link to an existing project.
    // No duplicate project data is stored.

    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: "__v",
    strict: "throw",
    optimisticConcurrency: true,
    collection: "calendar_events",
  }
);

// ======================================
// Database Indexes
// ======================================

// Calendar range queries and date ordering.

calendarEventSchema.index({
  date: 1,
  time: 1,
});

// Personal calendar queries.

calendarEventSchema.index({
  createdBy: 1,
  date: 1,
});

// Team-wide calendar queries.

calendarEventSchema.index({
  visibility: 1,
  date: 1,
});

// Events involving an employee.

calendarEventSchema.index({
  attendees: 1,
  date: 1,
});

// Project-linked events.

calendarEventSchema.index({
  project: 1,
  date: 1,
});

// ======================================
// Model Export
// ======================================

const CalendarEvent =
  models.CalendarEvent ||
  model("CalendarEvent", calendarEventSchema);

export default CalendarEvent;
