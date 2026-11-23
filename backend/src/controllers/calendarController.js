
import mongoose from "mongoose";

import CalendarEvent from "../models/CalendarEvent.js";
import User from "../models/User.js";
import Project from "../models/Project.js";

const { Types } = mongoose;

const EVENT_TYPES = [
  "Meeting",
  "Reminder",
  "Call",
  "Deadline",
  "Other",
];

const VISIBILITIES = ["Private", "Team"];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const httpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const getUserId = (req) =>
  String(req.user._id ?? req.user.id);

const isManager = (req) =>
  ["admin", "manager"].includes(req.user.role);

const isValidId = (value) =>
  typeof value === "string" &&
  Types.ObjectId.isValid(value) &&
  String(new Types.ObjectId(value)) ===
    value.toLowerCase();

const isValidDate = (value) => {
  if (
    typeof value !== "string" ||
    !DATE_PATTERN.test(value)
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

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(
    object,
    key
  );

const allowedFields = new Set([
  "title",
  "type",
  "date",
  "time",
  "description",
  "location",
  "visibility",
  "attendees",
  "project",
]);

const normalizePayload = (
  body,
  { partial = false } = {}
) => {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    throw httpError(
      400,
      "A valid event object is required"
    );
  }

  const unknown = Object.keys(body).filter(
    (key) => !allowedFields.has(key)
  );

  if (unknown.length > 0) {
    throw httpError(
      400,
      `Unsupported event fields: ${unknown.join(", ")}`
    );
  }

  if (partial && Object.keys(body).length === 0) {
    throw httpError(
      400,
      "At least one event field is required"
    );
  }

  const result = {};

  const stringFields = {
    title: 200,
    description: 5000,
    location: 300,
  };

  for (const [field, max] of Object.entries(
    stringFields
  )) {
    if (!hasOwn(body, field)) continue;

    if (typeof body[field] !== "string") {
      throw httpError(
        400,
        `${field} must be a string`
      );
    }

    const value = body[field].trim();

    if (
      value.length > max ||
      (field === "title" && value.length < 2)
    ) {
      throw httpError(
        400,
        `Invalid ${field} length`
      );
    }

    result[field] = value;
  }

  if (hasOwn(body, "type")) {
    if (!EVENT_TYPES.includes(body.type)) {
      throw httpError(400, "Invalid event type");
    }

    result.type = body.type;
  }

  if (hasOwn(body, "visibility")) {
    if (!VISIBILITIES.includes(body.visibility)) {
      throw httpError(
        400,
        "Invalid event visibility"
      );
    }

    result.visibility = body.visibility;
  }

  if (hasOwn(body, "date")) {
    if (!isValidDate(body.date)) {
      throw httpError(
        400,
        "Date must be valid YYYY-MM-DD"
      );
    }

    result.date = body.date;
  }

  if (hasOwn(body, "time")) {
    if (
      typeof body.time !== "string" ||
      (body.time !== "" &&
        !TIME_PATTERN.test(body.time))
    ) {
      throw httpError(
        400,
        "Time must use HH:mm format"
      );
    }

    result.time = body.time;
  }

  if (hasOwn(body, "attendees")) {
    if (
      !Array.isArray(body.attendees) ||
      body.attendees.length > 100
    ) {
      throw httpError(
        400,
        "Attendees must be an array of at most 100 users"
      );
    }

    const ids = body.attendees.map((value) => {
      if (!isValidId(value)) {
        throw httpError(
          400,
          "Invalid attendee ID"
        );
      }

      return value.toLowerCase();
    });

    if (new Set(ids).size !== ids.length) {
      throw httpError(
        400,
        "Duplicate attendees are not allowed"
      );
    }

    result.attendees = ids;
  }

  if (hasOwn(body, "project")) {
    if (
      body.project !== null &&
      !isValidId(body.project)
    ) {
      throw httpError(
        400,
        "Invalid project ID"
      );
    }

    result.project = body.project;
  }

  if (!partial) {
    if (!result.title || !result.date) {
      throw httpError(
        400,
        "Title and date are required"
      );
    }
  }

  return result;
};

const accessFilter = (req) => {
  const userId = getUserId(req);

  if (isManager(req)) {
    return {
      $or: [
        { visibility: "Team" },
        { createdBy: userId },
        { attendees: userId },
      ],
    };
  }

  return {
    $or: [
      { createdBy: userId },
      { attendees: userId },
      {
        visibility: "Team",
      },
    ],
  };
};

const canRead = (event, req) => {
  const userId = getUserId(req);

  return (
    String(event.createdBy) === userId ||
    event.attendees.some(
      (id) => String(id) === userId
    ) ||
    event.visibility === "Team"
  );
};

const canWrite = (event, req) => {
  const userId = getUserId(req);

  return (
    String(event.createdBy) === userId ||
    (isManager(req) &&
      event.visibility === "Team")
  );
};

const validateReferences = async (
  payload,
  req,
  existingEvent = null
) => {
  const attendeeIds = hasOwn(payload, "attendees")
    ? payload.attendees
    : existingEvent?.attendees?.map(String) || [];

  if (hasOwn(payload, "attendees")) {
    const count = await User.countDocuments({
      _id: { $in: attendeeIds },
      isActive: true,
    });

    if (count !== attendeeIds.length) {
      throw httpError(
        400,
        "One or more attendees are invalid or inactive"
      );
    }
  }

  if (
    hasOwn(payload, "project") &&
    payload.project !== null
  ) {
    const project = await Project.findById(
      payload.project
    )
      .select("projectManager assignedTo")
      .lean();

    if (!project) {
      throw httpError(404, "Project not found");
    }

    if (!isManager(req)) {
      const userId = getUserId(req);

      const assigned = (
        project.assignedTo || []
      ).some(
        (id) => String(id) === userId
      );

      const manages =
        String(project.projectManager || "") ===
        userId;

      if (!assigned && !manages) {
        throw httpError(
          403,
          "You cannot associate this project"
        );
      }
    }
  }

  const visibility = hasOwn(
    payload,
    "visibility"
  )
    ? payload.visibility
    : existingEvent?.visibility || "Private";

  if (
    visibility === "Team" &&
    !isManager(req)
  ) {
    throw httpError(
      403,
      "Only Admin or Manager can create team events"
    );
  }
};

const populateEvent = (query) =>
  query
    .populate("createdBy", "name email role")
    .populate("attendees", "name email role")
    .populate("project", "name status");

const handleError = (error, res, next) => {
  if (
    Number.isInteger(error.status) &&
    error.status >= 400 &&
    error.status < 500
  ) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
    });
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Calendar event validation failed",
      errors: Object.values(error.errors).map(
        (item) => ({
          field: item.path,
          message: item.message,
        })
      ),
    });
  }

  if (error.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid reference ID",
    });
  }

  if (error.name === "VersionError") {
    return res.status(409).json({
      success: false,
      message:
        "Calendar event was modified by another request",
    });
  }

  return next(error);
};

// ======================================
// GET /api/calendar/events
// ======================================

export const getCalendarEvents = async (
  req,
  res,
  next
) => {
  try {
    const {
      startDate,
      endDate,
      type,
      project,
    } = req.query;

    if (
      !isValidDate(startDate) ||
      !isValidDate(endDate)
    ) {
      throw httpError(
        400,
        "startDate and endDate are required in YYYY-MM-DD format"
      );
    }

    if (startDate > endDate) {
      throw httpError(
        400,
        "startDate cannot exceed endDate"
      );
    }

    const start = new Date(
      `${startDate}T00:00:00.000Z`
    );

    const end = new Date(
      `${endDate}T00:00:00.000Z`
    );

    const dayRange =
      (end.getTime() - start.getTime()) /
      86400000;

    if (dayRange > 366) {
      throw httpError(
        400,
        "Calendar range cannot exceed 366 days"
      );
    }

    if (
      type !== undefined &&
      !EVENT_TYPES.includes(type)
    ) {
      throw httpError(400, "Invalid event type");
    }

    if (
      project !== undefined &&
      !isValidId(project)
    ) {
      throw httpError(400, "Invalid project ID");
    }

    const filter = {
      $and: [
        accessFilter(req),
        {
          date: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      ],
    };

    if (type) filter.type = type;
    if (project) filter.project = project;

    const events = await populateEvent(
      CalendarEvent.find(filter)
        .sort({
          date: 1,
          time: 1,
          _id: 1,
        })
        .limit(5000)
    );

    return res.status(200).json({
      success: true,
      count: events.length,
      events,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// GET /api/calendar/events/:id
// ======================================

export const getCalendarEventById = async (
  req,
  res,
  next
) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      throw httpError(400, "Invalid event ID");
    }

    const event = await CalendarEvent.findById(
      id
    );

    if (!event) {
      throw httpError(404, "Event not found");
    }

    if (!canRead(event, req)) {
      throw httpError(404, "Event not found");
    }

    await event.populate([
      {
        path: "createdBy",
        select: "name email role",
      },
      {
        path: "attendees",
        select: "name email role",
      },
      {
        path: "project",
        select: "name status",
      },
    ]);

    return res.status(200).json({
      success: true,
      event,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// POST /api/calendar/events
// ======================================

export const createCalendarEvent = async (
  req,
  res,
  next
) => {
  try {
    const payload = normalizePayload(
      req.body
    );

    await validateReferences(payload, req);

    const event = await CalendarEvent.create({
      ...payload,
      createdBy: getUserId(req),
    });

    await event.populate([
      {
        path: "createdBy",
        select: "name email role",
      },
      {
        path: "attendees",
        select: "name email role",
      },
      {
        path: "project",
        select: "name status",
      },
    ]);

    return res.status(201).json({
      success: true,
      message: "Calendar event created",
      event,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// PATCH /api/calendar/events/:id
// ======================================

export const updateCalendarEvent = async (
  req,
  res,
  next
) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      throw httpError(400, "Invalid event ID");
    }

    const payload = normalizePayload(
      req.body,
      { partial: true }
    );

    const event = await CalendarEvent.findById(
      id
    );

    if (!event) {
      throw httpError(404, "Event not found");
    }

    if (!canWrite(event, req)) {
      throw httpError(
        403,
        "You cannot edit this event"
      );
    }

    await validateReferences(
      payload,
      req,
      event
    );

    Object.assign(event, payload);

    await event.save();

    await event.populate([
      {
        path: "createdBy",
        select: "name email role",
      },
      {
        path: "attendees",
        select: "name email role",
      },
      {
        path: "project",
        select: "name status",
      },
    ]);

    return res.status(200).json({
      success: true,
      message: "Calendar event updated",
      event,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// DELETE /api/calendar/events/:id
// ======================================

export const deleteCalendarEvent = async (
  req,
  res,
  next
) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      throw httpError(400, "Invalid event ID");
    }

    const event = await CalendarEvent.findById(
      id
    );

    if (!event) {
      throw httpError(404, "Event not found");
    }

    if (!canWrite(event, req)) {
      throw httpError(
        403,
        "You cannot delete this event"
      );
    }

    await event.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Calendar event deleted",
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};
