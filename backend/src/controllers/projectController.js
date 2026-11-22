
import mongoose from "mongoose";

import Project from "../models/Project.js";
import Client from "../models/Client.js";
import User from "../models/User.js";

// ======================================
// Constants
// ======================================

const ACTIVE_STATUSES = [
  "Planning",
  "In Progress",
  "On Hold",
  "In Review",
];

const MAX_MILESTONES = 100;

// ======================================
// General Helpers
// ======================================

const isManager = (req) =>
  ["admin", "manager"].includes(req.user.role);

const userId = (req) =>
  String(req.user._id ?? req.user.id);

const fail = (status, message) => {
  const error = new Error(message);
  error.status = status;
  throw error;
};

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toObjectId = (id) =>
  new mongoose.Types.ObjectId(String(id));

const respondError = (error, res, next) => {
  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Project validation failed",
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
      message: "Invalid ID",
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

// ======================================
// Project Access Control
// ======================================

const accessFilter = (req) => {
  if (isManager(req)) return {};

  const id = toObjectId(userId(req));

  return {
    $or: [
      { assignedTo: id },
      { projectManager: id },
    ],
  };
};

const projectFilterById = (req, id) => ({
  _id: id,
  ...accessFilter(req),
});

// ======================================
// Populate Project References
// ======================================

const populateProject = (query) =>
  query
    .populate(
      "client",
      "name company email phone status"
    )
    .populate(
      "projectManager",
      "name email role isActive"
    )
    .populate(
      "assignedTo",
      "name email role isActive"
    )
    .populate(
      "createdBy",
      "name email role"
    );

// ======================================
// Validate Client
// ======================================

const validateClient = async (clientId) => {
  const client = await Client.findById(clientId)
    .select("_id")
    .lean();

  if (!client) {
    fail(404, "Client not found");
  }

  return client;
};

// ======================================
// Validate Employees
// ======================================

const validateEmployees = async (
  assignedTo = [],
  projectManager = null
) => {
  const ids = [
    ...assignedTo.map(String),
    ...(projectManager
      ? [String(projectManager)]
      : []),
  ];

  const uniqueIds = [
    ...new Set(ids.map((id) => id.toLowerCase())),
  ];

  if (uniqueIds.length === 0) return;

  const users = await User.find({
    _id: { $in: uniqueIds },
    isActive: true,
  })
    .select("_id role")
    .lean();

  if (users.length !== uniqueIds.length) {
    fail(
      400,
      "One or more assigned users are inactive or do not exist"
    );
  }

  if (projectManager) {
    const manager = users.find(
      (user) =>
        String(user._id) ===
        String(projectManager)
    );

    if (
      !manager ||
      !["admin", "manager"].includes(
        manager.role
      )
    ) {
      fail(
        400,
        "Project manager must have admin or manager role"
      );
    }
  }
};

// ======================================
// Validate Project Dates
// ======================================

const validateDates = (project) => {
  if (
    project.startDate &&
    project.deadline &&
    new Date(project.deadline) <
      new Date(project.startDate)
  ) {
    fail(
      400,
      "Deadline cannot be before start date"
    );
  }

  for (const milestone of project.milestones) {
    if (!milestone.dueDate) continue;

    if (
      project.startDate &&
      milestone.dueDate < project.startDate
    ) {
      fail(
        400,
        "Milestone cannot be before project start date"
      );
    }

    if (
      project.deadline &&
      milestone.dueDate > project.deadline
    ) {
      fail(
        400,
        "Milestone cannot be after project deadline"
      );
    }
  }
};

// ======================================
// Build Project Filters
// ======================================

const buildFilters = (req) => {
  const query = req.validatedQuery;
  const filter = { ...accessFilter(req) };

  for (const field of [
    "client",
    "status",
    "priority",
    "type",
  ]) {
    if (query[field]) {
      filter[field] = query[field];
    }
  }

  if (query.projectManager) {
    filter.projectManager =
      query.projectManager;
  }

  if (query.assignedTo) {
    filter.assignedTo = query.assignedTo;
  }

  if (query.search) {
    const regex = new RegExp(
      escapeRegex(query.search),
      "i"
    );

    const searchCondition = [
      { name: regex },
      { description: regex },
    ];

    if (filter.$or) {
      filter.$and = [
        { $or: filter.$or },
        { $or: searchCondition },
      ];

      delete filter.$or;
    } else {
      filter.$or = searchCondition;
    }
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
    filter.deadline = {
      $lt: new Date(),
    };

    filter.status = {
      $nin: ["Completed", "Cancelled"],
    };
  }

  if (query.overdue === "false") {
    filter.$and = [
      ...(filter.$and ?? []),
      {
        $or: [
          { deadline: null },
          { deadline: { $gte: new Date() } },
          {
            status: {
              $in: ["Completed", "Cancelled"],
            },
          },
        ],
      },
    ];
  }

  return filter;
};

// ======================================
// GET /api/projects
// ======================================

export const getProjects = async (
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

    const filter = buildFilters(req);

    const skip = (page - 1) * limit;

    const sort = {
      [sortBy]: sortOrder === "asc" ? 1 : -1,
      _id: -1,
    };

    const [projects, total] =
      await Promise.all([
        populateProject(
          Project.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limit)
        ),

        Project.countDocuments(filter),
      ]);

    return res.status(200).json({
      success: true,
      projects,
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
    return respondError(error, res, next);
  }
};

// ======================================
// GET /api/projects/stats
// ======================================

export const getProjectStats = async (
  req,
  res,
  next
) => {
  try {
    const match = accessFilter(req);

    const now = new Date();

    const [stats] = await Project.aggregate([
      { $match: match },

      {
        $group: {
          _id: null,

          total: { $sum: 1 },

          planning: {
            $sum: {
              $cond: [
                { $eq: ["$status", "Planning"] },
                1,
                0,
              ],
            },
          },

          inProgress: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    "$status",
                    "In Progress",
                  ],
                },
                1,
                0,
              ],
            },
          },

          onHold: {
            $sum: {
              $cond: [
                { $eq: ["$status", "On Hold"] },
                1,
                0,
              ],
            },
          },

          inReview: {
            $sum: {
              $cond: [
                { $eq: ["$status", "In Review"] },
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

          overdue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $lt: ["$deadline", now] },
                    {
                      $ne: [
                        "$deadline",
                        null,
                      ],
                    },
                    {
                      $not: [
                        {
                          $in: [
                            "$status",
                            [
                              "Completed",
                              "Cancelled",
                            ],
                          ],
                        },
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },

          totalBudget: {
            $sum: "$budget",
          },

          averageProgress: {
            $avg: "$progress",
          },
        },
      },
    ]);

    const result = stats ?? {
      total: 0,
      planning: 0,
      inProgress: 0,
      onHold: 0,
      inReview: 0,
      completed: 0,
      cancelled: 0,
      overdue: 0,
      totalBudget: 0,
      averageProgress: 0,
    };

    const { _id, ...publicStats } = result;

    return res.status(200).json({
      success: true,
      stats: {
        ...publicStats,
        averageProgress: Number(
          result.averageProgress.toFixed(2)
        ),
        completionRate: result.total
          ? Number(
              (
                (result.completed / result.total) *
                100
              ).toFixed(2)
            )
          : 0,
      },
    });
  } catch (error) {
    return respondError(error, res, next);
  }
};

// ======================================
// GET /api/projects/:id
// ======================================

export const getProjectById = async (
  req,
  res,
  next
) => {
  try {
    const project = await populateProject(
      Project.findOne(
        projectFilterById(
          req,
          req.validatedParams.id
        )
      )
    );

    if (!project) {
      fail(404, "Project not found");
    }

    return res.status(200).json({
      success: true,
      project,
    });
  } catch (error) {
    return respondError(error, res, next);
  }
};

// ======================================
// POST /api/projects
// ======================================

export const createProject = async (
  req,
  res,
  next
) => {
  try {
    if (!isManager(req)) {
      fail(
        403,
        "Only admins and managers can create projects"
      );
    }

    const data = { ...req.body };

    await validateClient(data.client);

    await validateEmployees(
      data.assignedTo ?? [],
      data.projectManager
    );

    const milestones = (
      data.milestones ?? []
    ).map((milestone) => ({
      ...milestone,
      status: "Pending",
      completedAt: null,
    }));

    const project = new Project({
      ...data,
      milestones,
      status: "Planning",
      completedAt: null,
      createdBy: userId(req),
    });

    validateDates(project);

    await project.save();

    const result = await populateProject(
      Project.findById(project._id)
    );

    return res.status(201).json({
      success: true,
      message: "Project created successfully",
      project: result,
    });
  } catch (error) {
    return respondError(error, res, next);
  }
};

// ======================================
// PATCH /api/projects/:id
// ======================================

export const updateProject = async (
  req,
  res,
  next
) => {
  try {
    if (!isManager(req)) {
      fail(
        403,
        "Only admins and managers can edit projects"
      );
    }

    const project = await Project.findById(
      req.validatedParams.id
    );

    if (!project) {
      fail(404, "Project not found");
    }

    if (
      ["Completed", "Cancelled"].includes(
        project.status
      )
    ) {
      fail(
        409,
        "Finalized projects cannot be edited"
      );
    }

    const data = { ...req.body };

    const nextClient =
      data.client ?? project.client;

    const nextAssignedTo =
      data.assignedTo ?? project.assignedTo;

    const nextManager =
      "projectManager" in data
        ? data.projectManager
        : project.projectManager;

    await validateClient(nextClient);

    await validateEmployees(
      nextAssignedTo,
      nextManager
    );

    project.set(data);

    validateDates(project);

    await project.save();

    const result = await populateProject(
      Project.findById(project._id)
    );

    return res.status(200).json({
      success: true,
      message: "Project updated successfully",
      project: result,
    });
  } catch (error) {
    return respondError(error, res, next);
  }
};

// ======================================
// PATCH /api/projects/:id/status
// ======================================

export const updateProjectStatus = async (
  req,
  res,
  next
) => {
  try {
    if (!isManager(req)) {
      fail(
        403,
        "Only admins and managers can change project status"
      );
    }

    const project = await Project.findById(
      req.validatedParams.id
    );

    if (!project) {
      fail(404, "Project not found");
    }

    if (
      ["Completed", "Cancelled"].includes(
        project.status
      )
    ) {
      fail(
        409,
        "Finalized projects cannot change status"
      );
    }

    const { status } = req.body;

    if (status === "Completed") {
      const unfinishedMilestones =
        project.milestones.some(
          (milestone) =>
            milestone.status !== "Completed"
        );

      if (unfinishedMilestones) {
        fail(
          409,
          "Complete all milestones before completing the project"
        );
      }

      project.status = "Completed";
      project.progress = 100;
      project.completedAt = new Date();
    } else if (status === "Cancelled") {
      project.status = "Cancelled";
      project.completedAt = null;
    } else if (ACTIVE_STATUSES.includes(status)) {
      project.status = status;
      project.completedAt = null;
    } else {
      fail(400, "Invalid project status");
    }

    await project.save();

    const result = await populateProject(
      Project.findById(project._id)
    );

    return res.status(200).json({
      success: true,
      message: "Project status updated successfully",
      project: result,
    });
  } catch (error) {
    return respondError(error, res, next);
  }
};

// ======================================
// POST /api/projects/:id/milestones
// ======================================

export const addMilestone = async (
  req,
  res,
  next
) => {
  try {
    if (!isManager(req)) {
      fail(
        403,
        "Only admins and managers can add milestones"
      );
    }

    const project = await Project.findById(
      req.validatedParams.id
    );

    if (!project) {
      fail(404, "Project not found");
    }

    if (
      ["Completed", "Cancelled"].includes(
        project.status
      )
    ) {
      fail(
        409,
        "Cannot add milestones to a finalized project"
      );
    }

    if (
      project.milestones.length >= MAX_MILESTONES
    ) {
      fail(
        400,
        "Maximum 100 milestones allowed"
      );
    }

    project.milestones.push({
      ...req.body,
      status: "Pending",
      completedAt: null,
    });

    validateDates(project);

    await project.save();

    const milestone =
      project.milestones[
        project.milestones.length - 1
      ];

    return res.status(201).json({
      success: true,
      message: "Milestone added successfully",
      milestone,
    });
  } catch (error) {
    return respondError(error, res, next);
  }
};

// ======================================
// PATCH /api/projects/:id/milestones/:milestoneId
// ======================================

export const updateMilestone = async (
  req,
  res,
  next
) => {
  try {
    if (!isManager(req)) {
      fail(
        403,
        "Only admins and managers can edit milestones"
      );
    }

    const project = await Project.findById(
      req.validatedParams.id
    );

    if (!project) {
      fail(404, "Project not found");
    }

    if (
      ["Completed", "Cancelled"].includes(
        project.status
      )
    ) {
      fail(
        409,
        "Cannot edit milestones of a finalized project"
      );
    }

    const milestone = project.milestones.id(
      req.validatedParams.milestoneId
    );

    if (!milestone) {
      fail(404, "Milestone not found");
    }

    milestone.set(req.body);

    validateDates(project);

    await project.save();

    return res.status(200).json({
      success: true,
      message: "Milestone updated successfully",
      milestone,
    });
  } catch (error) {
    return respondError(error, res, next);
  }
};

// ======================================
// PATCH /api/projects/:id/milestones/:milestoneId/status
// ======================================

export const updateMilestoneStatus = async (
  req,
  res,
  next
) => {
  try {
    const project = await Project.findOne(
      projectFilterById(
        req,
        req.validatedParams.id
      )
    );

    if (!project) {
      fail(404, "Project not found");
    }

    if (
      ["Completed", "Cancelled"].includes(
        project.status
      )
    ) {
      fail(
        409,
        "Cannot update milestones of a finalized project"
      );
    }

    const milestone = project.milestones.id(
      req.validatedParams.milestoneId
    );

    if (!milestone) {
      fail(404, "Milestone not found");
    }

    const { status } = req.body;

    milestone.status = status;

    milestone.completedAt =
      status === "Completed"
        ? new Date()
        : null;

    await project.save();

    return res.status(200).json({
      success: true,
      message: "Milestone status updated",
      milestone,
    });
  } catch (error) {
    return respondError(error, res, next);
  }
};

// ======================================
// DELETE /api/projects/:id/milestones/:milestoneId
// ======================================

export const deleteMilestone = async (
  req,
  res,
  next
) => {
  try {
    if (!isManager(req)) {
      fail(
        403,
        "Only admins and managers can delete milestones"
      );
    }

    const project = await Project.findById(
      req.validatedParams.id
    );

    if (!project) {
      fail(404, "Project not found");
    }

    if (
      ["Completed", "Cancelled"].includes(
        project.status
      )
    ) {
      fail(
        409,
        "Cannot delete milestones of a finalized project"
      );
    }

    const milestone = project.milestones.id(
      req.validatedParams.milestoneId
    );

    if (!milestone) {
      fail(404, "Milestone not found");
    }

    project.milestones.pull(milestone._id);

    await project.save();

    return res.status(200).json({
      success: true,
      message: "Milestone deleted successfully",
    });
  } catch (error) {
    return respondError(error, res, next);
  }
};

// ======================================
// DELETE /api/projects/:id
// ======================================

export const deleteProject = async (
  req,
  res,
  next
) => {
  try {
    if (req.user.role !== "admin") {
      fail(
        403,
        "Only admins can delete projects"
      );
    }

    const project = await Project.findById(
      req.validatedParams.id
    );

    if (!project) {
      fail(404, "Project not found");
    }

    await project.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Project deleted successfully",
    });
  } catch (error) {
    return respondError(error, res, next);
  }
};
