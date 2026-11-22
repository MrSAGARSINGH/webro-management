
import mongoose from "mongoose";

import Client from "../models/Client.js";
import Lead from "../models/Lead.js";
import Project from "../models/Project.js";
import Task from "../models/Task.js";
import Employee from "../models/Employee.js";
import Payment from "../models/Payment.js";
import Invoice from "../models/Invoice.js";

// ======================================
// Helpers
// ======================================

const asyncHandler = (handler) => {
  return (req, res, next) => {
    Promise.resolve(
      handler(req, res, next)
    ).catch(next);
  };
};

const requireManagement = (req) => {
  if (
    !["admin", "manager"].includes(
      req.user?.role
    )
  ) {
    const error = new Error(
      "You do not have permission to view dashboard analytics"
    );

    error.status = 403;
    throw error;
  }
};

const getDateRange = (months = 6) => {
  const now = new Date();

  const start = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() - months + 1,
      1
    )
  );

  return { start, now };
};

const roundMoney = (amount) => {
  return (
    Math.round(
      (Number(amount) + Number.EPSILON) * 100
    ) / 100
  );
};

const getSum = async (
  Model,
  match,
  field
) => {
  const result = await Model.aggregate([
    {
      $match: match,
    },
    {
      $group: {
        _id: null,
        total: {
          $sum: `$${field}`,
        },
      },
    },
  ]);

  return roundMoney(
    result[0]?.total ?? 0
  );
};

const monthKey = (date) => {
  return [
    date.getUTCFullYear(),
    String(
      date.getUTCMonth() + 1
    ).padStart(2, "0"),
  ].join("-");
};

const buildMonthlySeries = (
  records,
  months = 6
) => {
  const now = new Date();
  const values = new Map();

  for (const record of records) {
    values.set(
      record._id,
      roundMoney(record.total)
    );
  }

  const series = [];

  for (
    let offset = months - 1;
    offset >= 0;
    offset--
  ) {
    const date = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() - offset,
        1
      )
    );

    const key = monthKey(date);

    series.push({
      month: key,
      total: values.get(key) ?? 0,
    });
  }

  return series;
};

const monthlyGroup = (
  dateField,
  amountField = null
) => {
  return {
    $group: {
      _id: {
        $dateToString: {
          format: "%Y-%m",
          date: `$${dateField}`,
          timezone: "UTC",
        },
      },
      total: amountField
        ? {
            $sum: `$${amountField}`,
          }
        : {
            $sum: 1,
          },
    },
  };
};

// ======================================
// GET /api/dashboard/overview
// ======================================

export const getDashboardOverview =
  asyncHandler(async (req, res) => {
    requireManagement(req);

    const [
      totalClients,
      activeClients,
      totalLeads,
      newLeads,
      totalProjects,
      activeProjects,
      completedProjects,
      totalTasks,
      pendingTasks,
      completedTasks,
      totalEmployees,
      activeEmployees,
      totalInvoices,
      overdueInvoices,
      totalRevenue,
      outstandingInvoices,
    ] = await Promise.all([
      Client.countDocuments(),

      Client.countDocuments({
        status: "Active",
      }),

      Lead.countDocuments(),

      Lead.countDocuments({
        status: "New",
      }),

      Project.countDocuments(),

      Project.countDocuments({
        status: "In Progress",
      }),

      Project.countDocuments({
        status: "Completed",
      }),

      Task.countDocuments(),

      Task.countDocuments({
        status: {
          $in: [
            "Todo",
            "In Progress",
            "In Review",
            "On Hold",
          ],
        },
      }),

      Task.countDocuments({
        status: "Completed",
      }),

      Employee.countDocuments(),

      Employee.countDocuments({
        status: "Active",
      }),

      Invoice.countDocuments(),

      Invoice.countDocuments({
        status: "Overdue",
      }),

      getSum(
        Payment,
        {
          status: {
            $in: [
              "Completed",
              "Partially Refunded",
            ],
          },
        },
        "amount"
      ),

      Invoice.aggregate([
        {
          $match: {
            status: {
              $in: [
                "Issued",
                "Partially Paid",
                "Overdue",
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $subtract: [
                  "$total",
                  "$paidAmount",
                ],
              },
            },
          },
        },
      ]),
    ]);

    return res.status(200).json({
      success: true,

      data: {
        clients: {
          total: totalClients,
          active: activeClients,
        },

        leads: {
          total: totalLeads,
          new: newLeads,
        },

        projects: {
          total: totalProjects,
          active: activeProjects,
          completed: completedProjects,
        },

        tasks: {
          total: totalTasks,
          pending: pendingTasks,
          completed: completedTasks,
        },

        employees: {
          total: totalEmployees,
          active: activeEmployees,
        },

        invoices: {
          total: totalInvoices,
          overdue: overdueInvoices,
          outstanding: roundMoney(
            outstandingInvoices[0]
              ?.total ?? 0
          ),
        },

        finance: {
          revenue: totalRevenue,
          currency: "INR",
        },
      },
    });
  });

// ======================================
// GET /api/dashboard/revenue
// ======================================

export const getRevenueAnalytics =
  asyncHandler(async (req, res) => {
    requireManagement(req);

    const months = 6;

    const { start } =
      getDateRange(months);

    const records =
      await Payment.aggregate([
        {
          $match: {
            status: {
              $in: [
                "Completed",
                "Partially Refunded",
              ],
            },

            createdAt: {
              $gte: start,
            },
          },
        },

        monthlyGroup(
          "createdAt",
          "amount"
        ),

        {
          $sort: {
            _id: 1,
          },
        },
      ]);

    const monthlyRevenue =
      buildMonthlySeries(
        records,
        months
      );

    const total = roundMoney(
      monthlyRevenue.reduce(
        (sum, item) =>
          sum + item.total,
        0
      )
    );

    return res.status(200).json({
      success: true,

      data: {
        currency: "INR",
        period: "last_6_months",
        total,
        monthlyRevenue,
      },
    });
  });

// ======================================
// GET /api/dashboard/leads
// ======================================

export const getLeadAnalytics =
  asyncHandler(async (req, res) => {
    requireManagement(req);

    const [byStatus, bySource] =
      await Promise.all([
        Lead.aggregate([
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
          {
            $sort: {
              count: -1,
            },
          },
        ]),

        Lead.aggregate([
          {
            $group: {
              _id: "$source",
              count: { $sum: 1 },
            },
          },
          {
            $sort: {
              count: -1,
            },
          },
        ]),
      ]);

    return res.status(200).json({
      success: true,

      data: {
        byStatus: byStatus.map(
          (item) => ({
            status: item._id,
            count: item.count,
          })
        ),

        bySource: bySource.map(
          (item) => ({
            source: item._id,
            count: item.count,
          })
        ),
      },
    });
  });

// ======================================
// GET /api/dashboard/projects
// ======================================

export const getProjectAnalytics =
  asyncHandler(async (req, res) => {
    requireManagement(req);

    const now = new Date();

    const [byStatus, overdue] =
      await Promise.all([
        Project.aggregate([
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
          {
            $sort: {
              count: -1,
            },
          },
        ]),

        Project.countDocuments({
          deadline: {
            $lt: now,
          },
          status: {
            $nin: [
              "Completed",
              "Cancelled",
            ],
          },
        }),
      ]);

    return res.status(200).json({
      success: true,

      data: {
        byStatus: byStatus.map(
          (item) => ({
            status: item._id,
            count: item.count,
          })
        ),

        overdue,
      },
    });
  });

// ======================================
// GET /api/dashboard/tasks
// ======================================

export const getTaskAnalytics =
  asyncHandler(async (req, res) => {
    requireManagement(req);

    const now = new Date();

    const [
      byStatus,
      byPriority,
      overdue,
    ] = await Promise.all([
      Task.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),

      Task.aggregate([
        {
          $group: {
            _id: "$priority",
            count: { $sum: 1 },
          },
        },
      ]),

      Task.countDocuments({
        dueDate: {
          $lt: now,
        },
        status: {
          $nin: [
            "Completed",
            "Cancelled",
          ],
        },
      }),
    ]);

    return res.status(200).json({
      success: true,

      data: {
        byStatus: byStatus.map(
          (item) => ({
            status: item._id,
            count: item.count,
          })
        ),

        byPriority: byPriority.map(
          (item) => ({
            priority: item._id,
            count: item.count,
          })
        ),

        overdue,
      },
    });
  });

// ======================================
// GET /api/dashboard/employees
// ======================================

export const getEmployeeAnalytics =
  asyncHandler(async (req, res) => {
    requireManagement(req);

    const [byDepartment, byStatus] =
      await Promise.all([
        Employee.aggregate([
          {
            $group: {
              _id: "$department",
              count: { $sum: 1 },
            },
          },
          {
            $sort: {
              count: -1,
            },
          },
        ]),

        Employee.aggregate([
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

    return res.status(200).json({
      success: true,

      data: {
        byDepartment:
          byDepartment.map(
            (item) => ({
              department: item._id,
              count: item.count,
            })
          ),

        byStatus: byStatus.map(
          (item) => ({
            status: item._id,
            count: item.count,
          })
        ),
      },
    });
  });

// ======================================
// GET /api/dashboard/activity
// ======================================

export const getRecentActivity =
  asyncHandler(async (req, res) => {
    requireManagement(req);

    const limit = 5;

    const [
      clients,
      leads,
      projects,
      tasks,
      payments,
    ] = await Promise.all([
      Client.find()
        .select(
          "name createdAt"
        )
        .sort({
          createdAt: -1,
        })
        .limit(limit)
        .lean(),

      Lead.find()
        .select(
          "name status createdAt"
        )
        .sort({
          createdAt: -1,
        })
        .limit(limit)
        .lean(),

      Project.find()
        .select(
          "name status createdAt"
        )
        .sort({
          createdAt: -1,
        })
        .limit(limit)
        .lean(),

      Task.find()
        .select(
          "title status createdAt"
        )
        .sort({
          createdAt: -1,
        })
        .limit(limit)
        .lean(),

      Payment.find({
        status: "Completed",
      })
        .select(
          "amount status createdAt"
        )
        .sort({
          createdAt: -1,
        })
        .limit(limit)
        .lean(),
    ]);

    const activity = [
      ...clients.map((item) => ({
        id: String(item._id),
        type: "client",
        title: item.name,
        action: "created",
        createdAt: item.createdAt,
      })),

      ...leads.map((item) => ({
        id: String(item._id),
        type: "lead",
        title: item.name,
        action: "created",
        status: item.status,
        createdAt: item.createdAt,
      })),

      ...projects.map((item) => ({
        id: String(item._id),
        type: "project",
        title: item.name,
        action: "created",
        status: item.status,
        createdAt: item.createdAt,
      })),

      ...tasks.map((item) => ({
        id: String(item._id),
        type: "task",
        title: item.title,
        action: "created",
        status: item.status,
        createdAt: item.createdAt,
      })),

      ...payments.map((item) => ({
        id: String(item._id),
        type: "payment",
        title: `Payment ₹${item.amount}`,
        action: "completed",
        status: item.status,
        createdAt: item.createdAt,
      })),
    ]
      .sort(
        (a, b) =>
          new Date(b.createdAt) -
          new Date(a.createdAt)
      )
      .slice(0, 10);

    return res.status(200).json({
      success: true,
      data: activity,
    });
  });
