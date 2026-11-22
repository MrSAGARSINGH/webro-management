
import mongoose from "mongoose";

import Call from "../models/Call.js";
import Lead from "../models/Lead.js";
import Client from "../models/Client.js";

// ======================================
// Helpers
// ======================================

const canManageAll = (req) =>
  ["admin", "manager"].includes(req.user.role);

const getUserId = (req) =>
  String(req.user._id ?? req.user.id);

const objectId = (id) =>
  new mongoose.Types.ObjectId(String(id));

const httpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const sendError = (error, res, next) => {
  if (error.status >= 400 && error.status < 500) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
    });
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Call validation failed",
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

  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "Duplicate record",
    });
  }

  return next(error);
};

const accessFilter = (req) =>
  canManageAll(req)
    ? {}
    : { calledBy: getUserId(req) };

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const populateCall = (query) =>
  query
    .populate("lead", "name company phone status assignedTo")
    .populate("client", "name company phone status assignedTo")
    .populate("calledBy", "name email role")
    .populate("createdBy", "name email role");

// ======================================
// Contact Access Validation
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
    .select("_id name phone assignedTo")
    .lean();

  if (!contact) {
    throw httpError(
      404,
      `${contactType} not found`
    );
  }

  if (!canManageAll(req)) {
    if (
      String(contact.assignedTo ?? "") !== getUserId(req)
    ) {
      throw httpError(
        403,
        "You cannot log calls for this contact"
      );
    }
  }

  return contact;
};

// ======================================
// Build Search Filters
// ======================================

const buildFilter = (req) => {
  const query = req.validatedQuery;
  const filter = { ...accessFilter(req) };

  for (const field of [
    "contactType",
    "direction",
    "status",
    "outcome",
    "lead",
    "client",
  ]) {
    if (query[field]) {
      filter[field] = query[field];
    }
  }

  // Employees cannot override their own scope.
  if (query.calledBy && canManageAll(req)) {
    filter.calledBy = query.calledBy;
  }

  if (query.search) {
    const regex = new RegExp(
      escapeRegex(query.search),
      "i"
    );

    filter.$or = [
      { contactName: regex },
      { phone: regex },
      { notes: regex },
    ];
  }

  if (query.fromDate || query.toDate) {
    filter.calledAt = {};

    if (query.fromDate) {
      filter.calledAt.$gte = new Date(
        query.fromDate
      );
    }

    if (query.toDate) {
      filter.calledAt.$lte = new Date(
        query.toDate
      );
    }
  }

  return filter;
};

// ======================================
// POST /api/calls
// ======================================

export const createCall = async (req, res, next) => {
  try {
    const data = { ...req.body };

    const referenceId =
      data.contactType === "Lead"
        ? data.lead
        : data.client;

    const contact = await validateContactAccess(
      req,
      data.contactType,
      referenceId
    );

    // Prevent spoofing contact information.
    data.contactName = contact.name;
    data.phone = contact.phone;

    const userId = getUserId(req);

    const call = await Call.create({
      ...data,
      calledBy: userId,
      createdBy: userId,
    });

    await populateCall(Call.findById(call._id))
      .then((populated) => {
        if (populated) {
          res.status(201).json({
            success: true,
            message: "Call logged successfully",
            call: populated,
          });
        } else {
          res.status(201).json({
            success: true,
            message: "Call logged successfully",
            call,
          });
        }
      });
  } catch (error) {
    return sendError(error, res, next);
  }
};

// ======================================
// GET /api/calls
// ======================================

export const getCalls = async (req, res, next) => {
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

    const [calls, total] = await Promise.all([
      populateCall(
        Call.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
      ),
      Call.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      calls,
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
    return sendError(error, res, next);
  }
};

// ======================================
// GET /api/calls/stats
// ======================================

export const getCallStats = async (req, res, next) => {
  try {
    const match = canManageAll(req)
      ? {}
      : {
          calledBy: objectId(getUserId(req)),
        };

    const [result] = await Call.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,

          totalCalls: { $sum: 1 },

          completedCalls: {
            $sum: {
              $cond: [
                { $eq: ["$status", "Completed"] },
                1,
                0,
              ],
            },
          },

          noAnswerCalls: {
            $sum: {
              $cond: [
                { $eq: ["$status", "No Answer"] },
                1,
                0,
              ],
            },
          },

          busyCalls: {
            $sum: {
              $cond: [
                { $eq: ["$status", "Busy"] },
                1,
                0,
              ],
            },
          },

          failedCalls: {
            $sum: {
              $cond: [
                { $eq: ["$status", "Failed"] },
                1,
                0,
              ],
            },
          },

          cancelledCalls: {
            $sum: {
              $cond: [
                { $eq: ["$status", "Cancelled"] },
                1,
                0,
              ],
            },
          },

          interestedCalls: {
            $sum: {
              $cond: [
                { $eq: ["$outcome", "Interested"] },
                1,
                0,
              ],
            },
          },

          followUpRequired: {
            $sum: {
              $cond: [
                {
                  $in: [
                    "$outcome",
                    [
                      "Callback Requested",
                      "Follow Up Required",
                    ],
                  ],
                },
                1,
                0,
              ],
            },
          },

          totalDurationSeconds: {
            $sum: "$durationSeconds",
          },
        },
      },
    ]);

    const stats = result ?? {
      totalCalls: 0,
      completedCalls: 0,
      noAnswerCalls: 0,
      busyCalls: 0,
      failedCalls: 0,
      cancelledCalls: 0,
      interestedCalls: 0,
      followUpRequired: 0,
      totalDurationSeconds: 0,
    };

    const { _id, ...publicStats } = stats;

    const completionRate = stats.totalCalls
      ? Number(
          (
            (stats.completedCalls / stats.totalCalls) *
            100
          ).toFixed(2)
        )
      : 0;

    const averageDurationSeconds =
      stats.completedCalls > 0
        ? Math.round(
            stats.totalDurationSeconds /
              stats.completedCalls
          )
        : 0;

    return res.status(200).json({
      success: true,
      stats: {
        ...publicStats,
        completionRate,
        averageDurationSeconds,
      },
    });
  } catch (error) {
    return sendError(error, res, next);
  }
};

// ======================================
// GET /api/calls/:id
// ======================================

export const getCallById = async (
  req,
  res,
  next
) => {
  try {
    const call = await populateCall(
      Call.findOne({
        _id: req.validatedParams.id,
        ...accessFilter(req),
      })
    );

    if (!call) {
      return res.status(404).json({
        success: false,
        message: "Call not found",
      });
    }

    return res.status(200).json({
      success: true,
      call,
    });
  } catch (error) {
    return sendError(error, res, next);
  }
};

// ======================================
// PATCH /api/calls/:id
// ======================================

export const updateCall = async (
  req,
  res,
  next
) => {
  try {
    const call = await Call.findOne({
      _id: req.validatedParams.id,
      ...accessFilter(req),
    });

    if (!call) {
      return res.status(404).json({
        success: false,
        message: "Call not found",
      });
    }

    const data = { ...req.body };

    const nextContactType =
      data.contactType ?? call.contactType;

    const nextReferenceId =
      nextContactType === "Lead"
        ? ("lead" in data ? data.lead : call.lead)
        : ("client" in data ? data.client : call.client);

    const referenceChanged =
      "contactType" in data ||
      "lead" in data ||
      "client" in data;

    if (referenceChanged) {
      const contact = await validateContactAccess(
        req,
        nextContactType,
        nextReferenceId
      );

      data.contactName = contact.name;
      data.phone = contact.phone;

      if (nextContactType === "Lead") {
        data.client = null;
      } else {
        data.lead = null;
      }
    } else {
      // Contact details are managed by Lead/Client.
      delete data.contactName;
      delete data.phone;
    }

    // Final merged state is validated by Mongoose.
    call.set(data);
    await call.save();

    const updatedCall = await populateCall(
      Call.findById(call._id)
    );

    return res.status(200).json({
      success: true,
      message: "Call updated successfully",
      call: updatedCall,
    });
  } catch (error) {
    return sendError(error, res, next);
  }
};

// ======================================
// DELETE /api/calls/:id
// ======================================

export const deleteCall = async (
  req,
  res,
  next
) => {
  try {
    const call = await Call.findOne({
      _id: req.validatedParams.id,
      ...accessFilter(req),
    });

    if (!call) {
      return res.status(404).json({
        success: false,
        message: "Call not found",
      });
    }

    await call.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Call deleted successfully",
    });
  } catch (error) {
    return sendError(error, res, next);
  }
};
