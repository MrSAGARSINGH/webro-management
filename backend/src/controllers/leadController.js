
import mongoose from "mongoose";

import Lead from "../models/Lead.js";
import Client from "../models/Client.js";
import User from "../models/User.js";

// ======================================
// Helpers
// ======================================

const canManageAll = (req) =>
  ["admin", "manager"].includes(req.user.role);

const notFound = (res) =>
  res.status(404).json({
    success: false,
    message: "Lead not found",
  });

const badRequest = (res, message) =>
  res.status(400).json({
    success: false,
    message,
  });

const forbidden = (res) =>
  res.status(403).json({
    success: false,
    message: "You do not have permission to perform this action",
  });

const handleError = (error, res, next) => {
  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Lead validation failed",
      errors: Object.values(error.errors).map((item) => ({
        field: item.path,
        message: item.message,
      })),
    });
  }

  if (error.name === "CastError") {
    return badRequest(res, "Invalid field value");
  }

  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "A duplicate record already exists",
    });
  }

  return next(error);
};

const validateAssignedUser = async (assignedTo) => {
  if (!assignedTo) return true;

  const user = await User.exists({
    _id: assignedTo,
    isActive: true,
  });

  return Boolean(user);
};

const accessFilter = (req) => {
  if (canManageAll(req)) {
    return {};
  }

  return {
    assignedTo: req.user.id,
  };
};

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildFilter = (req) => {
  const query = req.validatedQuery;
  const filter = accessFilter(req);

  for (const key of [
    "status",
    "source",
    "priority",
    "service",
  ]) {
    if (query[key]) {
      filter[key] = query[key];
    }
  }

  // Only admin and manager can filter by
  // another employee's assignedTo ID.
  if (query.assignedTo && canManageAll(req)) {
    filter.assignedTo = query.assignedTo;
  }

  if (query.search) {
    const regex = new RegExp(
      escapeRegex(query.search),
      "i"
    );

    filter.$or = [
      { name: regex },
      { company: regex },
      { phone: regex },
      { email: regex },
    ];
  }

  return filter;
};

const populateLead = (query) =>
  query
    .populate("assignedTo", "name email role")
    .populate("createdBy", "name email")
    .populate("convertedClient", "name company status");

// ======================================
// POST /api/leads
// ======================================

export const createLead = async (req, res, next) => {
  try {
    const data = { ...req.body };

    if (!canManageAll(req)) {
      if (
        data.assignedTo &&
        data.assignedTo !== req.user.id
      ) {
        return forbidden(res);
      }

      data.assignedTo = req.user.id;
    }

    if (!(await validateAssignedUser(data.assignedTo))) {
      return badRequest(
        res,
        "Assigned employee does not exist or is inactive"
      );
    }

    if (data.lostReason && data.status !== "Lost") {
      return badRequest(
        res,
        "Lost reason requires Lost status"
      );
    }

    const lead = await Lead.create({
      ...data,
      createdBy: req.user.id,
    });

    await lead.populate([
      {
        path: "assignedTo",
        select: "name email role",
      },
      {
        path: "createdBy",
        select: "name email",
      },
    ]);

    return res.status(201).json({
      success: true,
      message: "Lead created successfully",
      lead,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// GET /api/leads
// ======================================

export const getLeads = async (req, res, next) => {
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

    const [leads, total] = await Promise.all([
      populateLead(
        Lead.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
      ),
      Lead.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      leads,
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
// GET /api/leads/stats
// ======================================

export const getLeadStats = async (req, res, next) => {
  try {
    const match = canManageAll(req)
      ? {}
      : {
          assignedTo: new mongoose.Types.ObjectId(
            req.user.id
          ),
        };

    const [result] = await Lead.aggregate([
      {
        $match: match,
      },
      {
        $group: {
          _id: null,

          totalLeads: {
            $sum: 1,
          },

          newLeads: {
            $sum: {
              $cond: [
                { $eq: ["$status", "New"] },
                1,
                0,
              ],
            },
          },

          contactedLeads: {
            $sum: {
              $cond: [
                { $eq: ["$status", "Contacted"] },
                1,
                0,
              ],
            },
          },

          interestedLeads: {
            $sum: {
              $cond: [
                { $eq: ["$status", "Interested"] },
                1,
                0,
              ],
            },
          },

          followUpLeads: {
            $sum: {
              $cond: [
                { $eq: ["$status", "Follow Up"] },
                1,
                0,
              ],
            },
          },

          qualifiedLeads: {
            $sum: {
              $cond: [
                { $eq: ["$status", "Qualified"] },
                1,
                0,
              ],
            },
          },

          convertedLeads: {
            $sum: {
              $cond: [
                { $eq: ["$status", "Converted"] },
                1,
                0,
              ],
            },
          },

          lostLeads: {
            $sum: {
              $cond: [
                { $eq: ["$status", "Lost"] },
                1,
                0,
              ],
            },
          },

          pipelineValue: {
            $sum: {
              $cond: [
                {
                  $in: [
                    "$status",
                    ["Converted", "Lost"],
                  ],
                },
                0,
                "$estimatedValue",
              ],
            },
          },
        },
      },
    ]);

    const stats = result || {
      totalLeads: 0,
      newLeads: 0,
      contactedLeads: 0,
      interestedLeads: 0,
      followUpLeads: 0,
      qualifiedLeads: 0,
      convertedLeads: 0,
      lostLeads: 0,
      pipelineValue: 0,
    };

    const { _id, ...publicStats } = stats;

    const conversionRate = publicStats.totalLeads
      ? Number(
          (
            (publicStats.convertedLeads /
              publicStats.totalLeads) *
            100
          ).toFixed(2)
        )
      : 0;

    return res.status(200).json({
      success: true,
      stats: {
        ...publicStats,
        conversionRate,
      },
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// GET /api/leads/:id
// ======================================

export const getLeadById = async (req, res, next) => {
  try {
    const lead = await populateLead(
      Lead.findOne({
        _id: req.validatedParams.id,
        ...accessFilter(req),
      })
    );

    if (!lead) {
      return notFound(res);
    }

    return res.status(200).json({
      success: true,
      lead,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// PATCH /api/leads/:id
// ======================================

export const updateLead = async (req, res, next) => {
  try {
    const lead = await Lead.findOne({
      _id: req.validatedParams.id,
      ...accessFilter(req),
    });

    if (!lead) {
      return notFound(res);
    }

    if (lead.status === "Converted") {
      return res.status(409).json({
        success: false,
        message: "Converted leads cannot be edited",
      });
    }

    const data = { ...req.body };

    if (!canManageAll(req) && "assignedTo" in data) {
      return forbidden(res);
    }

    if (
      "assignedTo" in data &&
      !(await validateAssignedUser(data.assignedTo))
    ) {
      return badRequest(
        res,
        "Assigned employee does not exist or is inactive"
      );
    }

    const nextStatus = data.status ?? lead.status;
    const nextLostReason =
  nextStatus !== "Lost" && lead.status === "Lost"
    ? (data.lostReason ?? "")
    : (data.lostReason ?? lead.lostReason);

    if (
      nextStatus !== "Lost" &&
      nextLostReason
    ) {
      return badRequest(
        res,
        "Lost reason requires Lost status"
      );
    }

    // Clear stale lost reason when reopening.
    if (
      nextStatus !== "Lost" &&
      lead.status === "Lost"
    ) {
      data.lostReason = "";
    }

    lead.set(data);

    await lead.save();

    await lead.populate([
      {
        path: "assignedTo",
        select: "name email role",
      },
      {
        path: "createdBy",
        select: "name email",
      },
      {
        path: "convertedClient",
        select: "name company status",
      },
    ]);

    return res.status(200).json({
      success: true,
      message: "Lead updated successfully",
      lead,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// DELETE /api/leads/:id
// ======================================

export const deleteLead = async (req, res, next) => {
  try {
    const lead = await Lead.findOne({
      _id: req.validatedParams.id,
      ...accessFilter(req),
    });

    if (!lead) {
      return notFound(res);
    }

    if (lead.status === "Converted") {
      return res.status(409).json({
        success: false,
        message: "Converted leads cannot be deleted",
      });
    }

    await lead.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Lead deleted successfully",
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// POST /api/leads/:id/convert
// ======================================

export const convertLead = async (req, res, next) => {
  let session;

  try {
    session = await mongoose.startSession();

    let convertedLead;
    let createdClient;

    await session.withTransaction(async () => {
      const lead = await Lead.findOne({
        _id: req.validatedParams.id,
        ...accessFilter(req),
      }).session(session);

      if (!lead) {
        const error = new Error("Lead not found");
        error.status = 404;
        throw error;
      }

      if (
        lead.status === "Converted" ||
        lead.convertedClient
      ) {
        const error = new Error(
          "Lead has already been converted"
        );
        error.status = 409;
        throw error;
      }

      if (lead.status === "Lost") {
        const error = new Error(
          "Lost leads must be reopened before conversion"
        );
        error.status = 409;
        throw error;
      }

      const {
        projectName,
        contractAmount,
        startDate,
        deadline,
        notes,
      } = req.body;

      const [client] = await Client.create(
        [
          {
            name: lead.name,
            company: lead.company,
            phone: lead.phone,
            email: lead.email,
            service: lead.service,
            status: "Active",
            projectName,
            contractAmount,
            receivedAmount: 0,
            startDate,
            deadline,
            assignedTo: lead.assignedTo,
            notes,
            createdBy: req.user.id,
          },
        ],
        { session }
      );

      lead.status = "Converted";
      lead.convertedClient = client._id;
      lead.convertedAt = new Date();
      lead.nextFollowUp = null;

      await lead.save({ session });

      createdClient = client;
      convertedLead = lead;
    });

    return res.status(201).json({
      success: true,
      message: "Lead converted to client successfully",
      lead: convertedLead,
      client: createdClient,
    });
  } catch (error) {
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

    return handleError(error, res, next);
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};
