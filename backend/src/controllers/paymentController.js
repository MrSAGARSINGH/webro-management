import mongoose from "mongoose";

import Payment from "../models/Payment.js";
import PaymentRefund from "../models/PaymentRefund.js";
import Client from "../models/Client.js";
import Project from "../models/Project.js";

const canManagePayments = (req) =>
  ["admin", "manager"].includes(req.user.role);

const getUserId = (req) =>
  String(req.user._id ?? req.user.id);

const createError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const roundMoney = (amount) =>
  Math.round(amount * 100) / 100;

const handleError = (error, res, next) => {
  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "Duplicate transaction or reference number",
    });
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Payment validation failed",
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

  return next(error);
};

const populatePayment = (query) =>
  query
    .populate(
      "client",
      "name company phone email"
    )
    .populate(
      "project",
      "name status budget client"
    )
    .populate(
      "createdBy",
      "name email"
    )
    .populate(
      "verifiedBy",
      "name email"
    );

const requireManager = (req) => {
  if (!canManagePayments(req)) {
    throw createError(
      403,
      "Only admins and managers can manage payments"
    );
  }
};

const validateReferences = async (clientId, projectId) => {
  const client = await Client.findById(clientId)
    .select("_id")
    .lean();

  if (!client) {
    throw createError(404, "Client not found");
  }

  if (projectId) {
    const project = await Project.findById(projectId)
      .select("_id client")
      .lean();

    if (!project) {
      throw createError(404, "Project not found");
    }

    if (String(project.client) !== String(clientId)) {
      throw createError(
        400,
        "Project does not belong to the selected client"
      );
    }
  }
};

const buildFilter = (query) => {
  const filter = {};

  for (const field of [
    "client",
    "project",
    "status",
    "paymentMethod",
    "paymentType",
    "currency",
    "createdBy",
    "verifiedBy",
  ]) {
    if (query[field]) {
      filter[field] = query[field];
    }
  }

  if (query.search) {
    const regex = new RegExp(
      escapeRegex(query.search),
      "i"
    );

    filter.$or = [
      { transactionId: regex },
      { referenceNumber: regex },
      { description: regex },
    ];
  }

  if (query.fromDate || query.toDate) {
    filter.createdAt = {};

    if (query.fromDate) {
      filter.createdAt.$gte = new Date(query.fromDate);
    }

    if (query.toDate) {
      filter.createdAt.$lte = new Date(query.toDate);
    }
  }

  if (query.overdue === "true") {
    filter.status = "Pending";
    filter.dueDate = {
      $lt: new Date(),
    };
  }

  if (query.overdue === "false") {
    filter.$and = [
      {
        $or: [
          { status: { $ne: "Pending" } },
          { dueDate: null },
          { dueDate: { $gte: new Date() } },
        ],
      },
    ];
  }

  return filter;
};

// ======================================
// POST /api/payments
// ======================================

export const createPayment = async (req, res, next) => {
  try {
    requireManager(req);

    const data = { ...req.body };

    await validateReferences(
      data.client,
      data.project
    );

    const payment = await Payment.create({
      ...data,
      status: "Pending",
      paymentDate: null,
      refundedAmount: 0,
      refundedAt: null,
      verifiedBy: null,
      verifiedAt: null,
      createdBy: getUserId(req),
    });

    const result = await populatePayment(
      Payment.findById(payment._id)
    );

    return res.status(201).json({
      success: true,
      message: "Payment record created",
      payment: result,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// GET /api/payments
// ======================================

export const getPayments = async (req, res, next) => {
  try {
    requireManager(req);

    const {
      page,
      limit,
      sortBy,
      sortOrder,
    } = req.validatedQuery;

    const filter = buildFilter(req.validatedQuery);

    const [payments, total] = await Promise.all([
      populatePayment(
        Payment.find(filter)
          .sort({
            [sortBy]: sortOrder === "asc" ? 1 : -1,
            _id: -1,
          })
          .skip((page - 1) * limit)
          .limit(limit)
      ),
      Payment.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      payments,
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
// GET /api/payments/stats
// ======================================

export const getPaymentStats = async (req, res, next) => {
  try {
    requireManager(req);

    const now = new Date();

    const [result] = await Payment.aggregate([
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

          completed: {
            $sum: {
              $cond: [
                { $eq: ["$status", "Completed"] },
                1,
                0,
              ],
            },
          },

          failed: {
            $sum: {
              $cond: [
                { $eq: ["$status", "Failed"] },
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

          refunded: {
            $sum: {
              $cond: [
                {
                  $in: [
                    "$status",
                    ["Refunded", "Partially Refunded"],
                  ],
                },
                1,
                0,
              ],
            },
          },

          grossRevenue: {
            $sum: {
              $cond: [
                {
                  $in: [
                    "$status",
                    [
                      "Completed",
                      "Refunded",
                      "Partially Refunded",
                    ],
                  ],
                },
                "$amount",
                0,
              ],
            },
          },

          totalRefunded: {
            $sum: "$refundedAmount",
          },

          pendingAmount: {
            $sum: {
              $cond: [
                { $eq: ["$status", "Pending"] },
                "$amount",
                0,
              ],
            },
          },

          overdueAmount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", "Pending"] },
                    { $ne: ["$dueDate", null] },
                    { $lt: ["$dueDate", now] },
                  ],
                },
                "$amount",
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
      completed: 0,
      failed: 0,
      cancelled: 0,
      refunded: 0,
      grossRevenue: 0,
      totalRefunded: 0,
      pendingAmount: 0,
      overdueAmount: 0,
    };

    return res.status(200).json({
      success: true,
      stats: {
        total: stats.total,
        pending: stats.pending,
        completed: stats.completed,
        failed: stats.failed,
        cancelled: stats.cancelled,
        refunded: stats.refunded,
        grossRevenue: roundMoney(stats.grossRevenue),
        totalRefunded: roundMoney(stats.totalRefunded),
        netRevenue: roundMoney(
          stats.grossRevenue - stats.totalRefunded
        ),
        pendingAmount: roundMoney(stats.pendingAmount),
        overdueAmount: roundMoney(stats.overdueAmount),
      },
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// GET /api/payments/:id
// ======================================

export const getPaymentById = async (req, res, next) => {
  try {
    requireManager(req);

    const payment = await populatePayment(
      Payment.findById(req.validatedParams.id)
    );

    if (!payment) {
      throw createError(404, "Payment not found");
    }

    const refunds = await PaymentRefund.find({
      payment: payment._id,
    })
      .populate("processedBy", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      payment,
      refunds,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// PATCH /api/payments/:id
// ======================================

export const updatePayment = async (req, res, next) => {
  try {
    requireManager(req);

    const payment = await Payment.findById(
      req.validatedParams.id
    );

    if (!payment) {
      throw createError(404, "Payment not found");
    }

    if (payment.status !== "Pending") {
      throw createError(
        409,
        "Only pending payments can be edited"
      );
    }

    payment.set(req.body);

    await payment.save();

    const result = await populatePayment(
      Payment.findById(payment._id)
    );

    return res.status(200).json({
      success: true,
      message: "Payment updated",
      payment: result,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// PATCH /api/payments/:id/verify
// ======================================

export const verifyPayment = async (req, res, next) => {
  try {
    requireManager(req);

    const payment = await Payment.findById(
      req.validatedParams.id
    );

    if (!payment) {
      throw createError(404, "Payment not found");
    }

    if (payment.status !== "Pending") {
      throw createError(
        409,
        "Only pending payments can be verified"
      );
    }

    // IMPORTANT:
    // This endpoint records an authorized
    // manual verification. It does not
    // independently confirm bank settlement.
    //
    // For payment gateway transactions,
    // verify with the provider before calling
    // this workflow.

    payment.status = "Completed";
    payment.paymentDate = new Date(
      req.body.paymentDate
    );
    payment.verifiedBy = getUserId(req);
    payment.verifiedAt = new Date();

    if (req.body.notes !== undefined) {
      payment.notes = req.body.notes;
    }

    await payment.save();

    const result = await populatePayment(
      Payment.findById(payment._id)
    );

    return res.status(200).json({
      success: true,
      message: "Payment marked as verified",
      payment: result,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// PATCH /api/payments/:id/fail
// ======================================

export const failPayment = async (req, res, next) => {
  try {
    requireManager(req);

    const payment = await Payment.findById(
      req.validatedParams.id
    );

    if (!payment) {
      throw createError(404, "Payment not found");
    }

    if (payment.status !== "Pending") {
      throw createError(
        409,
        "Only pending payments can be marked failed"
      );
    }

    payment.status = "Failed";
    payment.notes = req.body.reason;

    await payment.save();

    return res.status(200).json({
      success: true,
      message: "Payment marked as failed",
      payment,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// PATCH /api/payments/:id/cancel
// ======================================

export const cancelPayment = async (req, res, next) => {
  try {
    requireManager(req);

    const payment = await Payment.findById(
      req.validatedParams.id
    );

    if (!payment) {
      throw createError(404, "Payment not found");
    }

    if (payment.status !== "Pending") {
      throw createError(
        409,
        "Only pending payments can be cancelled"
      );
    }

    payment.status = "Cancelled";
    payment.notes = req.body.reason;

    await payment.save();

    return res.status(200).json({
      success: true,
      message: "Payment cancelled",
      payment,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// POST /api/payments/:id/refund
// ======================================

export const refundPayment = async (req, res, next) => {
  try {
    requireManager(req);

    const paymentId = req.validatedParams.id;

    const {
      amount,
      reason,
      referenceNumber,
    } = req.body;

    if (!referenceNumber) {
      throw createError(
        400,
        "A unique refund reference number is required"
      );
    }

    const session = await mongoose.startSession();

    let updatedPayment;

    try {
      await session.withTransaction(async () => {
        const payment = await Payment.findById(
          paymentId
        ).session(session);

        if (!payment) {
          throw createError(404, "Payment not found");
        }

        if (
          ![
            "Completed",
            "Partially Refunded",
          ].includes(payment.status)
        ) {
          throw createError(
            409,
            "Payment is not eligible for refund"
          );
        }

        const remaining = roundMoney(
          payment.amount - payment.refundedAmount
        );

        if (amount > remaining) {
          throw createError(
            400,
            "Refund exceeds remaining payment amount"
          );
        }

        const duplicate = await PaymentRefund.exists({
          referenceNumber,
        }).session(session);

        if (duplicate) {
          throw createError(
            409,
            "Refund reference already exists"
          );
        }

        await PaymentRefund.create(
          [
            {
              payment: payment._id,
              amount,
              reason,
              referenceNumber,
              processedBy: getUserId(req),
            },
          ],
          { session }
        );

        const totalRefunded = roundMoney(
          payment.refundedAmount + amount
        );

        payment.refundedAmount = totalRefunded;
        payment.refundedAt = new Date();
        payment.refundReason = reason;

        payment.status =
          totalRefunded >= payment.amount
            ? "Refunded"
            : "Partially Refunded";

        await payment.save({ session });

        updatedPayment = payment;
      });
    } finally {
      await session.endSession();
    }

    return res.status(200).json({
      success: true,
      message: "Refund recorded successfully",
      payment: updatedPayment,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};