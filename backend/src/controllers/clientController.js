
import mongoose from "mongoose";

import Client from "../models/Client.js";
import User from "../models/User.js";

// ----------------------------------
// Helpers
// ----------------------------------

const getClientId = (req) => req.params.id;

const sendNotFound = (res) =>
  res.status(404).json({
    success: false,
    message: "Client not found",
  });

const handleClientError = (error, res, next) => {
  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Client validation failed",
      errors: Object.values(error.errors).map((item) => ({
        field: item.path,
        message: item.message,
      })),
    });
  }

  if (error.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid field value",
    });
  }

  return next(error);
};

const validateAssignedUser = async (assignedTo) => {
  if (!assignedTo) return true;

  const employee = await User.exists({
    _id: assignedTo,
    isActive: true,
  });

  return Boolean(employee);
};

const buildClientFilter = (query) => {
  const filter = {};

  if (query.status) {
    filter.status = query.status;
  }

  if (query.service) {
    filter.service = query.service;
  }

  if (query.assignedTo) {
    filter.assignedTo = query.assignedTo;
  }

  if (query.search) {
    // Escape regex metacharacters supplied by users.
    const escaped = query.search.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    const regex = new RegExp(escaped, "i");

    filter.$or = [
      { name: regex },
      { company: regex },
      { email: regex },
      { phone: regex },
      { projectName: regex },
    ];
  }

  return filter;
};

const populateClient = (query) =>
  query
    .populate("assignedTo", "name email role")
    .populate("createdBy", "name email");

// ----------------------------------
// POST /api/clients
// ----------------------------------

export const createClient = async (req, res, next) => {
  try {
    const data = req.body;

    if (!(await validateAssignedUser(data.assignedTo))) {
      return res.status(400).json({
        success: false,
        message: "Assigned employee does not exist or is inactive",
      });
    }

    const client = await Client.create({
      ...data,
      createdBy: req.user.id,
    });

    await client.populate([
      { path: "assignedTo", select: "name email role" },
      { path: "createdBy", select: "name email" },
    ]);

    return res.status(201).json({
      success: true,
      message: "Client created successfully",
      client,
    });
  } catch (error) {
    return handleClientError(error, res, next);
  }
};

// ----------------------------------
// GET /api/clients
// ----------------------------------

export const getClients = async (req, res, next) => {
  try {
    // Query parameters must be validated by route middleware.
    const {
      page,
      limit,
      search,
      status,
      service,
      assignedTo,
      sortBy,
      sortOrder,
    } = req.validatedQuery;

    const filter = buildClientFilter({
      search,
      status,
      service,
      assignedTo,
    });

    const skip = (page - 1) * limit;

    const sort = {
      [sortBy]: sortOrder === "asc" ? 1 : -1,
      _id: -1,
    };

    const [clients, total] = await Promise.all([
      populateClient(
        Client.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
      ),
      Client.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      clients,
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
    next(error);
  }
};

// ----------------------------------
// GET /api/clients/stats
// ----------------------------------

export const getClientStats = async (req, res, next) => {
  try {
    const [summary] = await Client.aggregate([
      {
        $group: {
          _id: null,
          totalClients: { $sum: 1 },

          activeClients: {
            $sum: {
              $cond: [{ $eq: ["$status", "Active"] }, 1, 0],
            },
          },

          completedClients: {
            $sum: {
              $cond: [{ $eq: ["$status", "Completed"] }, 1, 0],
            },
          },

          onHoldClients: {
            $sum: {
              $cond: [{ $eq: ["$status", "On Hold"] }, 1, 0],
            },
          },

          inactiveClients: {
            $sum: {
              $cond: [{ $eq: ["$status", "Inactive"] }, 1, 0],
            },
          },

          totalContractAmount: {
            $sum: "$contractAmount",
          },

          totalReceivedAmount: {
            $sum: "$receivedAmount",
          },
        },
      },
    ]);

    const stats = summary || {
      totalClients: 0,
      activeClients: 0,
      completedClients: 0,
      onHoldClients: 0,
      inactiveClients: 0,
      totalContractAmount: 0,
      totalReceivedAmount: 0,
    };

    const {
      _id,
      ...publicStats
    } = stats;

    return res.status(200).json({
      success: true,
      stats: {
        ...publicStats,
        totalPendingAmount: Math.max(
          0,
          publicStats.totalContractAmount -
            publicStats.totalReceivedAmount
        ),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ----------------------------------
// GET /api/clients/:id
// ----------------------------------

export const getClientById = async (req, res, next) => {
  try {
    const client = await populateClient(
      Client.findById(getClientId(req))
    );

    if (!client) {
      return sendNotFound(res);
    }

    return res.status(200).json({
      success: true,
      client,
    });
  } catch (error) {
    return handleClientError(error, res, next);
  }
};

// ----------------------------------
// PATCH /api/clients/:id
// ----------------------------------

export const updateClient = async (req, res, next) => {
  try {
    const client = await Client.findById(
      getClientId(req)
    );

    if (!client) {
      return sendNotFound(res);
    }

    if (
      Object.prototype.hasOwnProperty.call(
        req.body,
        "assignedTo"
      ) &&
      !(await validateAssignedUser(req.body.assignedTo))
    ) {
      return res.status(400).json({
        success: false,
        message: "Assigned employee does not exist or is inactive",
      });
    }

    // Apply validated fields and validate the complete document.
    // This also checks cross-field rules on partial updates.
    client.set(req.body);

    await client.save();

    await client.populate([
      { path: "assignedTo", select: "name email role" },
      { path: "createdBy", select: "name email" },
    ]);

    return res.status(200).json({
      success: true,
      message: "Client updated successfully",
      client,
    });
  } catch (error) {
    return handleClientError(error, res, next);
  }
};

// ----------------------------------
// DELETE /api/clients/:id
// ----------------------------------

export const deleteClient = async (req, res, next) => {
  try {
    const client = await Client.findByIdAndDelete(
      getClientId(req)
    );

    if (!client) {
      return sendNotFound(res);
    }

    return res.status(200).json({
      success: true,
      message: "Client deleted successfully",
    });
  } catch (error) {
    return handleClientError(error, res, next);
  }
};
