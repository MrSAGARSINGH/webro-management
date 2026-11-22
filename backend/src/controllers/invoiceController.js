
import mongoose from "mongoose";

import Invoice from "../models/Invoice.js";
import InvoiceCounter from "../models/InvoiceCounter.js";
import InvoicePaymentAllocation from "../models/InvoicePaymentAllocation.js";
import Payment from "../models/Payment.js";
import Client from "../models/Client.js";
import Project from "../models/Project.js";

// ======================================
// Helpers
// ======================================

const errorWithStatus = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const getUserId = (req) =>
  String(req.user._id ?? req.user.id);

const requireManager = (req) => {
  if (
    !["admin", "manager"].includes(req.user.role)
  ) {
    throw errorWithStatus(
      403,
      "Only admins and managers can manage invoices"
    );
  }
};

const roundMoney = (value) =>
  Math.round(value * 100) / 100;

const toPaise = (value) =>
  Math.round(value * 100);

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const handleError = (error, res, next) => {
  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "Duplicate invoice or allocation",
    });
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Invoice validation failed",
      errors: Object.values(error.errors).map(
        (item) => ({
          field: item.path,
          message: item.message,
        })
      ),
    });
  }

  if (error.name === "VersionError") {
    return res.status(409).json({
      success: false,
      message:
        "Invoice was modified by another request",
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

const populateInvoice = (query) =>
  query
    .populate(
      "client",
      "name company email phone"
    )
    .populate(
      "project",
      "name status client"
    )
    .populate(
      "createdBy",
      "name email"
    )
    .populate(
      "issuedBy",
      "name email"
    );

// ======================================
// Validate Client / Project
// ======================================

const validateReferences = async (
  clientId,
  projectId
) => {
  const client = await Client.findById(clientId)
    .select("name company email phone")
    .lean();

  if (!client) {
    throw errorWithStatus(
      404,
      "Client not found"
    );
  }

  if (projectId) {
    const project = await Project.findById(
      projectId
    )
      .select("client")
      .lean();

    if (!project) {
      throw errorWithStatus(
        404,
        "Project not found"
      );
    }

    if (
      String(project.client) !== String(clientId)
    ) {
      throw errorWithStatus(
        400,
        "Project does not belong to client"
      );
    }
  }

  return client;
};

// ======================================
// Invoice Number Generation
// ======================================

const generateInvoiceNumber = async (
  session
) => {
  const year = new Date().getUTCFullYear();

  const counter = await InvoiceCounter.findOneAndUpdate(
    { _id: `WEBRO-${year}` },
    { $inc: { sequence: 1 } },
    {
      new: true,
      upsert: true,
      session,
    }
  );

  return `WEBRO-${year}-${String(
    counter.sequence
  ).padStart(6, "0")}`;
};

// ======================================
// GET /api/invoices
// ======================================

export const getInvoices = async (
  req,
  res,
  next
) => {
  try {
    requireManager(req);

    const query = req.validatedQuery;

    const filter = {};

    for (const field of [
      "client",
      "project",
      "status",
      "currency",
      "createdBy",
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

      filter.invoiceNumber = regex;
    }

    if (query.fromDate || query.toDate) {
      filter.createdAt = {};

      if (query.fromDate) {
        filter.createdAt.$gte =
          new Date(query.fromDate);
      }

      if (query.toDate) {
        filter.createdAt.$lte =
          new Date(query.toDate);
      }
    }

    if (query.overdue === "true") {
      filter.status = {
        $in: [
          "Issued",
          "Partially Paid",
          "Overdue",
        ],
      };

      filter.dueDate = {
        $lt: new Date(),
      };
    }

    if (query.overdue === "false") {
      filter.$or = [
        { dueDate: null },
        { dueDate: { $gte: new Date() } },
        {
          status: {
            $in: [
              "Draft",
              "Paid",
              "Cancelled",
            ],
          },
        },
      ];
    }

    const {
      page,
      limit,
      sortBy,
      sortOrder,
    } = query;

    const [invoices, total] =
      await Promise.all([
        populateInvoice(
          Invoice.find(filter)
            .sort({
              [sortBy]:
                sortOrder === "asc" ? 1 : -1,
              _id: -1,
            })
            .skip((page - 1) * limit)
            .limit(limit)
        ),

        Invoice.countDocuments(filter),
      ]);

    return res.status(200).json({
      success: true,
      invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(
          total / limit
        ),
        hasNextPage:
          page * limit < total,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// GET /api/invoices/stats
// ======================================

export const getInvoiceStats = async (
  req,
  res,
  next
) => {
  try {
    requireManager(req);

    const now = new Date();

    const [result] = await Invoice.aggregate([
      {
        $group: {
          _id: null,

          total: { $sum: 1 },

          draft: {
            $sum: {
              $cond: [
                { $eq: ["$status", "Draft"] },
                1,
                0,
              ],
            },
          },

          issued: {
            $sum: {
              $cond: [
                { $eq: ["$status", "Issued"] },
                1,
                0,
              ],
            },
          },

          paid: {
            $sum: {
              $cond: [
                { $eq: ["$status", "Paid"] },
                1,
                0,
              ],
            },
          },

          partiallyPaid: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    "$status",
                    "Partially Paid",
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
                    { $lt: ["$dueDate", now] },
                    {
                      $in: [
                        "$status",
                        [
                          "Issued",
                          "Partially Paid",
                          "Overdue",
                        ],
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },

          totalInvoiced: {
            $sum: {
              $cond: [
                {
                  $in: [
                    "$status",
                    [
                      "Issued",
                      "Partially Paid",
                      "Paid",
                      "Overdue",
                    ],
                  ],
                },
                "$grandTotal",
                0,
              ],
            },
          },

          totalReceived: {
            $sum: {
              $cond: [
                {
                  $in: [
                    "$status",
                    [
                      "Issued",
                      "Partially Paid",
                      "Paid",
                      "Overdue",
                    ],
                  ],
                },
                "$paidAmount",
                0,
              ],
            },
          },
        },
      },
    ]);

    const stats = result ?? {
      total: 0,
      draft: 0,
      issued: 0,
      paid: 0,
      partiallyPaid: 0,
      overdue: 0,
      totalInvoiced: 0,
      totalReceived: 0,
    };

    return res.status(200).json({
      success: true,
      stats: {
        ...stats,
        _id: undefined,
        totalOutstanding: roundMoney(
          stats.totalInvoiced -
            stats.totalReceived
        ),
      },
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// GET /api/invoices/:id
// ======================================

export const getInvoiceById = async (
  req,
  res,
  next
) => {
  try {
    requireManager(req);

    const invoice = await populateInvoice(
      Invoice.findById(
        req.validatedParams.id
      )
    );

    if (!invoice) {
      throw errorWithStatus(
        404,
        "Invoice not found"
      );
    }

    const allocations =
      await InvoicePaymentAllocation.find({
        invoice: invoice._id,
      })
        .populate(
          "payment",
          "amount status paymentDate transactionId"
        )
        .populate(
          "allocatedBy",
          "name email"
        )
        .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      invoice,
      allocations,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// POST /api/invoices
// ======================================

export const createInvoice = async (
  req,
  res,
  next
) => {
  try {
    requireManager(req);

    const data = { ...req.body };

    const client = await validateReferences(
      data.client,
      data.project
    );

    const session =
      await mongoose.startSession();

    let invoice;

    try {
      await session.withTransaction(
        async () => {
          const invoiceNumber =
            await generateInvoiceNumber(
              session
            );

          const [created] =
            await Invoice.create(
              [
                {
                  ...data,

                  invoiceNumber,

                  status: "Draft",

                  paidAmount: 0,

                  paidAt: null,

                  issuedBy: null,

                  createdBy: getUserId(req),

                  billingDetails: {
                    businessName:
                      data.billingDetails
                        ?.businessName ||
                      client.company ||
                      client.name,

                    billingAddress:
                      data.billingDetails
                        ?.billingAddress ||
                      "",

                    email:
                      data.billingDetails
                        ?.email ||
                      client.email ||
                      "",

                    phone:
                      data.billingDetails
                        ?.phone ||
                      client.phone ||
                      "",

                    gstin:
                      data.billingDetails
                        ?.gstin ||
                      "",
                  },
                },
              ],
              { session }
            );

          invoice = created;
        }
      );
    } finally {
      await session.endSession();
    }

    return res.status(201).json({
      success: true,
      message:
        "Draft invoice created successfully",
      invoice,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// PATCH /api/invoices/:id
// ======================================

export const updateInvoice = async (
  req,
  res,
  next
) => {
  try {
    requireManager(req);

    const invoice = await Invoice.findById(
      req.validatedParams.id
    );

    if (!invoice) {
      throw errorWithStatus(
        404,
        "Invoice not found"
      );
    }

    if (invoice.status !== "Draft") {
      throw errorWithStatus(
        409,
        "Only draft invoices can be edited"
      );
    }

    const data = { ...req.body };

    const clientId =
      data.client ?? invoice.client;

    const projectId =
      "project" in data
        ? data.project
        : invoice.project;

    await validateReferences(
      clientId,
      projectId
    );

    invoice.set(data);

    await invoice.save();

    return res.status(200).json({
      success: true,
      message:
        "Invoice updated successfully",
      invoice,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// PATCH /api/invoices/:id/issue
// ======================================

export const issueInvoice = async (
  req,
  res,
  next
) => {
  try {
    requireManager(req);

    const invoice = await Invoice.findById(
      req.validatedParams.id
    );

    if (!invoice) {
      throw errorWithStatus(
        404,
        "Invoice not found"
      );
    }

    if (invoice.status !== "Draft") {
      throw errorWithStatus(
        409,
        "Only draft invoices can be issued"
      );
    }

    if (invoice.items.length === 0) {
      throw errorWithStatus(
        400,
        "Invoice requires at least one item"
      );
    }

    invoice.issueDate = new Date(
      req.body.issueDate
    );

    invoice.dueDate = new Date(
      req.body.dueDate
    );

    invoice.issuedBy = getUserId(req);

    invoice.status = "Issued";

    await invoice.save();

    return res.status(200).json({
      success: true,
      message:
        "Invoice issued successfully",
      invoice,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// PATCH /api/invoices/:id/cancel
// ======================================

export const cancelInvoice = async (
  req,
  res,
  next
) => {
  try {
    requireManager(req);

    const invoice = await Invoice.findById(
      req.validatedParams.id
    );

    if (!invoice) {
      throw errorWithStatus(
        404,
        "Invoice not found"
      );
    }

    if (
      ["Paid", "Cancelled"].includes(
        invoice.status
      )
    ) {
      throw errorWithStatus(
        409,
        "Invoice cannot be cancelled"
      );
    }

    if (invoice.paidAmount > 0) {
      throw errorWithStatus(
        409,
        "Invoice has payments and cannot be cancelled"
      );
    }

    invoice.status = "Cancelled";

    invoice.cancelledAt = new Date();

    invoice.cancellationReason =
      req.body.reason;

    await invoice.save();

    return res.status(200).json({
      success: true,
      message:
        "Invoice cancelled successfully",
      invoice,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// POST /api/invoices/:id/payments
// ======================================

export const allocateInvoicePayment = async (
  req,
  res,
  next
) => {
  try {
    requireManager(req);

    const {
      paymentId,
      amount,
    } = req.body;

    const session =
      await mongoose.startSession();

    let updatedInvoice;

    try {
      await session.withTransaction(
        async () => {
          const invoice =
            await Invoice.findById(
              req.validatedParams.id
            ).session(session);

          if (!invoice) {
            throw errorWithStatus(
              404,
              "Invoice not found"
            );
          }

          if (
            ![
              "Issued",
              "Partially Paid",
              "Overdue",
            ].includes(invoice.status)
          ) {
            throw errorWithStatus(
              409,
              "Invoice cannot accept payments"
            );
          }

          const payment =
            await Payment.findById(
              paymentId
            ).session(session);

          if (!payment) {
            throw errorWithStatus(
              404,
              "Payment not found"
            );
          }

          if (
            ![
              "Completed",
              "Partially Refunded",
            ].includes(payment.status)
          ) {
            throw errorWithStatus(
              409,
              "Payment is not eligible for allocation"
            );
          }

          if (
            String(payment.client) !==
            String(invoice.client)
          ) {
            throw errorWithStatus(
              400,
              "Payment and invoice clients do not match"
            );
          }

          if (
            payment.project &&
            invoice.project &&
            String(payment.project) !==
              String(invoice.project)
          ) {
            throw errorWithStatus(
              400,
              "Payment and invoice projects do not match"
            );
          }

          const existing =
            await InvoicePaymentAllocation.exists({
              invoice: invoice._id,
              payment: payment._id,
            }).session(session);

          if (existing) {
            throw errorWithStatus(
              409,
              "Payment already allocated to this invoice"
            );
          }

          const allocations =
            await InvoicePaymentAllocation.aggregate([
              {
                $match: {
                  payment: payment._id,
                },
              },
              {
                $group: {
                  _id: null,
                  total: {
                    $sum: "$amount",
                  },
                },
              },
            ]).session(session);

          const alreadyAllocated =
            allocations[0]?.total ?? 0;

          const availablePaise =
            toPaise(payment.amount) -
            toPaise(payment.refundedAmount) -
            toPaise(alreadyAllocated);

          if (
            toPaise(amount) >
            availablePaise
          ) {
            throw errorWithStatus(
              400,
              "Allocation exceeds available payment balance"
            );
          }

          const invoiceBalancePaise =
            toPaise(invoice.grandTotal) -
            toPaise(invoice.paidAmount);

          if (
            toPaise(amount) >
            invoiceBalancePaise
          ) {
            throw errorWithStatus(
              400,
              "Allocation exceeds invoice balance"
            );
          }

          await InvoicePaymentAllocation.create(
            [
              {
                invoice: invoice._id,
                payment: payment._id,
                amount,
                allocatedBy:
                  getUserId(req),
              },
            ],
            { session }
          );

          invoice.paidAmount =
            roundMoney(
              invoice.paidAmount + amount
            );

          if (
            toPaise(invoice.paidAmount) ===
            toPaise(invoice.grandTotal)
          ) {
            invoice.status = "Paid";
            invoice.paidAt = new Date();
          } else {
            invoice.status =
              "Partially Paid";
            invoice.paidAt = null;
          }

          await invoice.save({
            session,
          });

          updatedInvoice = invoice;
        }
      );
    } finally {
      await session.endSession();
    }

    return res.status(200).json({
      success: true,
      message:
        "Payment allocated successfully",
      invoice: updatedInvoice,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};
