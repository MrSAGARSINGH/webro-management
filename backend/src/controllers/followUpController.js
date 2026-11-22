
import mongoose from "mongoose";

import FollowUp from "../models/FollowUp.js";
import Lead from "../models/Lead.js";
import Client from "../models/Client.js";
import Call from "../models/Call.js";
import User from "../models/User.js";

// ======================================
// Helpers
// ======================================

const canManageAll = (req) =>
  ["admin", "manager"].includes(req.user.role);

const getUserId = (req) =>
  String(req.user._id ?? req.user.id);

const httpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

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
      message: "Follow-up validation failed",
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

  return next(error);
};

const accessFilter = (req) =>
  canManageAll(req)
    ? {}
    : { assignedTo: getUserId(req) };

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const populateFollowUp = (query) =>
  query
    .populate("lead", "name company phone status assignedTo")
    .populate("client", "name company phone status assignedTo")
    .populate("call", "contactType status calledAt")
    .populate("assignedTo", "name email role")
    .populate("createdBy", "name email")
    .populate("completedBy", "name email");

// ======================================
// India Timezone Date Boundaries
// ======================================

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const getTodayRangeIST = () => {
  const now = Date.now();

  const start =
    Math.floor((now + IST_OFFSET_MS) / DAY_MS) *
      DAY_MS -
    IST_OFFSET_MS;

  return {
    start: new Date(start),
    end: new Date(start + DAY_MS),
  };
};

// ======================================
// Contact Access
// ======================================

const validateContactAccess = async (
  req,
  contactType,
  referenceId
) => {
  if (!referenceId) {
    throw httpError(
      400,
      `${contactType} reference is required`
    );
  }

  const Model =
    contactType === "Lead" ? Lead : Client;

  const contact = await Model.findById(referenceId)
    .select("_id assignedTo")
    .lean();

  if (!contact) {
    throw httpError(404, `${contactType} not found`);
  }

  if (
    !canManageAll(req) &&
    String(contact.assignedTo ?? "") !== getUserId(req)
  ) {
    throw httpError(
      403,
      "You do not have access to this contact"
    );
  }

  return contact;
};

// ======================================
// Employee Validation
// ======================================

const validateAssignedUser = async (assignedTo) => {
  const user = await User.exists({
    _id: assignedTo,
    isActive: true,
  });

  if (!user) {
    throw httpError(
      400,
      "Assigned employee does not exist or is inactive"
    );
  }
};

// ======================================
// Call Reference Validation
// ======================================

const validateCallReference = async ({
  req,
  callId,
  contactType,
  referenceId,
}) => {
  if (!callId) return;

  const call = await Call.findById(callId)
    .select("contactType lead client calledBy")
    .lean();

  if (!call) {
    throw httpError(404, "Referenced call not found");
  }

  const callContactId =
    contactType === "Lead" ? call.lead : call.client;

  if (
    call.contactType !== contactType ||
    String(callContactId ?? "") !==
      String(referenceId)
  ) {
    throw httpError(
      400,
      "Call must belong to the same Lead or Client"
    );
  }

  if (
    !canManageAll(req) &&
    String(call.calledBy) !== getUserId(req)
  ) {
    throw httpError(
      403,
      "You do not have access to this call"
    );
  }
};

// ======================================
// Build Filters
// ======================================

const buildFilter = (req) => {
  const query = req.validatedQuery;
  const filter = { ...accessFilter(req) };

  for (const field of [
    "status",
    "priority",
    "type",
    "contactType",
    "lead",
    "client",
    "call",
  ]) {
    if (query[field]) {
      filter[field] = query[field];
    }
  }

  if (query.assignedTo && canManageAll(req)) {
    filter.assignedTo = query.assignedTo;
  }

  if (query.search) {
    const regex = new RegExp(
      escapeRegex(query.search),
      "i"
    );

    filter.$or = [
      { title: regex },
      { description: regex },
    ];
  }

  const now = new Date();

  if (query.due === "today") {
    const { start, end } = getTodayRangeIST();

    filter.scheduledAt = {
      $gte: start,
      $lt: end,
    };
  } else if (query.due === "upcoming") {
    filter.status = {
      $in: ["Pending", "In Progress"],
    };

    filter.scheduledAt = {
      $gte: now,
    };
  } else if (query.due === "overdue") {
    filter.status = {
      $in: ["Pending", "In Progress"],
    };

    filter.scheduledAt = {
      $lt: now,
    };
  } else if (query.fromDate || query.toDate) {
    filter.scheduledAt = {};

    if (query.fromDate) {
      filter.scheduledAt.$gte = new Date(
        query.fromDate
      );
    }

    if (query.toDate) {
      filter.scheduledAt.$lte = new Date(
        query.toDate
      );
    }
  }

  return filter;
};

// ======================================
// Validate Final Follow-up State
// ======================================

const validateFinalState = async (req, data) => {
  const referenceId =
    data.contactType === "Lead"
      ? data.lead
      : data.client;

  await validateContactAccess(
    req,
    data.contactType,
    referenceId
  );

  await validateAssignedUser(data.assignedTo);

  if (!canManageAll(req)) {
    if (
      String(data.assignedTo) !== getUserId(req)
    ) {
      throw httpError(
        403,
        "Employees can only assign follow-ups to themselves"
      );
    }
  }

  await validateCallReference({
    req,
    callId: data.call,
    contactType: data.contactType,
    referenceId,
  });

  if (
    data.reminderAt &&
    new Date(data.reminderAt).getTime() >
      new Date(data.scheduledAt).getTime()
  ) {
    throw httpError(
      400,
      "Reminder cannot be after scheduled time"
    );
  }
};

// ======================================
// POST /api/follow-ups
// ======================================

export const createFollowUp = async (
  req,
  res,
  next
) => {
  try {
    const data = { ...req.body };
    const userId = getUserId(req);

    if (!canManageAll(req)) {
      if (
        data.assignedTo &&
        String(data.assignedTo) !== userId
      ) {
        throw httpError(
          403,
          "Employees cannot assign follow-ups to others"
        );
      }

      data.assignedTo = userId;
    }

    await validateFinalState(req, data);

    const followUp = await FollowUp.create({
      ...data,
      status: "Pending",
      createdBy: userId,
    });

    const result = await populateFollowUp(
      FollowUp.findById(followUp._id)
    );

    return res.status(201).json({
      success: true,
      message: "Follow-up created successfully",
      followUp: result,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// GET /api/follow-ups
// ======================================

export const getFollowUps = async (
  req,
  res,
  next
) => {
  try {
    const {
      page,
      limit,
      sortBy,
      sortOrder,
    } = req.validatedQuery;

    const filter = buildFilter(req);
    const skip = (page - 1) * limit;

    const sort = {
      [sortBy]: sortOrder === "asc" ? 1 : -1,
      _id: -1,
    };

    const [followUps, total] = await Promise.all([
      populateFollowUp(
        FollowUp.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
      ),
      FollowUp.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      followUps,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// GET /api/follow-ups/stats
// ======================================

export const getFollowUpStats = async (
  req,
  res,
  next
) => {
  try {
    const now = new Date();
    const { start, end } = getTodayRangeIST();

    const match = canManageAll(req)
      ? {}
      : {
          assignedTo: new mongoose.Types.ObjectId(
            getUserId(req)
          ),
        };

    const [result] = await FollowUp.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,

          total: { $sum: 1 },

          pending: {
            $sum: {
              $cond: [
                { $eq: ["$status", "Pending"] },
                1,
                0,
              ],
            },
          },

          inProgress: {
            $sum: {
              $cond: [
                { $eq: ["$status", "In Progress"] },
                1,
                0,
              ],
            },
          },

          completed: {
            $sum: {
              $cond: [
                { $eq: ["$status", "Completed"] },
                1,
                0,
              ],
            },
          },

          cancelled: {
            $sum: {
              $cond: [
                { $eq: ["$status", "Cancelled"] },
                1,
                0,
              ],
            },
          },

          dueToday: {
            $sum: {
              $cond: [
                {
                  $and: [
                    {
                      $in: [
                        "$status",
                        ["Pending", "In Progress"],
                      ],
                    },
                    {
                      $gte: ["$scheduledAt", start],
                    },
                    {
                      $lt: ["$scheduledAt", end],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },

          overdue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    {
                      $in: [
                        "$status",
                        ["Pending", "In Progress"],
                      ],
                    },
                    {
                      $lt: ["$scheduledAt", now],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const stats = result ?? {
      total: 0,
      pending: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
      dueToday: 0,
      overdue: 0,
    };

    const { _id, ...publicStats } = stats;

    const completionRate = stats.total
      ? Number(
          (
            (stats.completed / stats.total) *
            100
          ).toFixed(2)
        )
      : 0;

    return res.status(200).json({
      success: true,
      stats: {
        ...publicStats,
        completionRate,
      },
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// GET /api/follow-ups/:id
// ======================================

export const getFollowUpById = async (
  req,
  res,
  next
) => {
  try {
    const followUp = await populateFollowUp(
      FollowUp.findOne({
        _id: req.validatedParams.id,
        ...accessFilter(req),
      })
    );

    if (!followUp) {
      throw httpError(404, "Follow-up not found");
    }

    return res.status(200).json({
      success: true,
      followUp,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// PATCH /api/follow-ups/:id
// ======================================

export const updateFollowUp = async (
  req,
  res,
  next
) => {
  try {
    const followUp = await FollowUp.findOne({
      _id: req.validatedParams.id,
      ...accessFilter(req),
    });

    if (!followUp) {
      throw httpError(404, "Follow-up not found");
    }

    if (
      ["Completed", "Cancelled"].includes(
        followUp.status
      )
    ) {
      throw httpError(
        409,
        "Completed or cancelled follow-ups cannot be edited"
      );
    }

    const data = { ...req.body };

    if (
      !canManageAll(req) &&
      "assignedTo" in data &&
      String(data.assignedTo) !== getUserId(req)
    ) {
      throw httpError(
        403,
        "Employees cannot reassign follow-ups"
      );
    }

    const nextContactType =
      data.contactType ?? followUp.contactType;

    const nextLead =
      "lead" in data ? data.lead : followUp.lead;

    const nextClient =
      "client" in data ? data.client : followUp.client;

    const nextCall =
      "call" in data ? data.call : followUp.call;

    const nextAssignedTo =
      "assignedTo" in data
        ? data.assignedTo
        : followUp.assignedTo;

    const nextScheduledAt =
      "scheduledAt" in data
        ? data.scheduledAt
        : followUp.scheduledAt;

    const nextReminderAt =
      "reminderAt" in data
        ? data.reminderAt
        : followUp.reminderAt;

    // Clear the opposite contact reference when
    // switching Lead <-> Client.
    if (nextContactType === "Lead") {
      data.client = null;
    } else {
      data.lead = null;
    }

    const finalState = {
      contactType: nextContactType,
      lead:
        nextContactType === "Lead"
          ? nextLead
          : null,
      client:
        nextContactType === "Client"
          ? nextClient
          : null,
      call: nextCall,
      assignedTo: nextAssignedTo,
      scheduledAt: nextScheduledAt,
      reminderAt: nextReminderAt,
    };

    await validateFinalState(req, finalState);

    followUp.set(data);

    // Rescheduling resets reminder delivery state.
    if (
      "scheduledAt" in data ||
      "reminderAt" in data
    ) {
      followUp.reminderSentAt = null;
    }

    await followUp.save();

    const result = await populateFollowUp(
      FollowUp.findById(followUp._id)
    );

    return res.status(200).json({
      success: true,
      message: "Follow-up updated successfully",
      followUp: result,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// PATCH /api/follow-ups/:id/status
// ======================================

export const updateFollowUpStatus = async (
  req,
  res,
  next
) => {
  try {
    const followUp = await FollowUp.findOne({
      _id: req.validatedParams.id,
      ...accessFilter(req),
    });

    if (!followUp) {
      throw httpError(404, "Follow-up not found");
    }

    const {
      status,
      completionNotes,
      cancellationReason,
    } = req.body;

    if (
      ["Completed", "Cancelled"].includes(
        followUp.status
      )
    ) {
      throw httpError(
        409,
        "Finalized follow-ups cannot change status"
      );
    }

    if (status === "Completed") {
      followUp.status = "Completed";
      followUp.completedAt = new Date();
      followUp.completedBy = getUserId(req);
      followUp.completionNotes =
        completionNotes ?? "";
    } else if (status === "Cancelled") {
      followUp.status = "Cancelled";
      followUp.cancelledAt = new Date();
      followUp.cancellationReason =
        cancellationReason ?? "";
    } else {
      followUp.status = status;
    }

    await followUp.save();

    const result = await populateFollowUp(
      FollowUp.findById(followUp._id)
    );

    return res.status(200).json({
      success: true,
      message: "Follow-up status updated successfully",
      followUp: result,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// DELETE /api/follow-ups/:id
// ======================================

export const deleteFollowUp = async (
  req,
  res,
  next
) => {
  try {
    const followUp = await FollowUp.findOne({
      _id: req.validatedParams.id,
      ...accessFilter(req),
    });

    if (!followUp) {
      throw httpError(404, "Follow-up not found");
    }

    await followUp.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Follow-up deleted successfully",
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};
