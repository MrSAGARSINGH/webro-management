
import mongoose from "mongoose";

import Task from "../models/Task.js";
import Project from "../models/Project.js";
import User from "../models/User.js";

// ======================================
// Helpers
// ======================================

const httpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const getUserId = (req) =>
  String(req.user._id ?? req.user.id);

const isManager = (req) =>
  ["admin", "manager"].includes(req.user.role);

const roundHours = (value) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const handleError = (error, res, next) => {
  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Task validation failed",
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
        "Task was modified by another request",
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
// Project Access
// ======================================

const canAccessProject = (project, userId) => {
  const managerId = project.projectManager
    ? String(project.projectManager)
    : null;

  const assignedIds = (
    project.assignedTo ?? []
  ).map(String);

  return (
    managerId === userId ||
    assignedIds.includes(userId)
  );
};

const getAccessibleProjectIds = async (
  userId
) => {
  const projects = await Project.find({
    $or: [
      { projectManager: userId },
      { assignedTo: userId },
    ],
  })
    .select("_id")
    .lean();

  return projects.map((project) => project._id);
};

const validateProjectAccess = async (
  projectId,
  req
) => {
  const project = await Project.findById(
    projectId
  ).select(
    "name status projectManager assignedTo"
  );

  if (!project) {
    throw httpError(404, "Project not found");
  }

  if (
    !isManager(req) &&
    !canAccessProject(project, getUserId(req))
  ) {
    throw httpError(
      403,
      "You do not have access to this project"
    );
  }

  return project;
};

// ======================================
// Employee Validation
// ======================================

const validateEmployee = async (
  employeeId,
  project
) => {
  if (!employeeId) return null;

  const employee = await User.findById(
    employeeId
  ).select("_id name role isActive");

  if (!employee || !employee.isActive) {
    throw httpError(
      400,
      "Assigned employee not found or inactive"
    );
  }

  const memberIds = (
    project.assignedTo ?? []
  ).map(String);

  if (
    String(project.projectManager ?? "") !==
      String(employeeId) &&
    !memberIds.includes(String(employeeId))
  ) {
    throw httpError(
      400,
      "Employee must belong to the project"
    );
  }

  return employee;
};

// ======================================
// Task Access
// ======================================

const getTaskOrThrow = async (id, req) => {
  const task = await Task.findById(id);

  if (!task) {
    throw httpError(404, "Task not found");
  }

  if (isManager(req)) {
    return task;
  }

  const userId = getUserId(req);

  const project = await Project.findById(
    task.project
  ).select("projectManager assignedTo");

  const projectAccess =
    project &&
    canAccessProject(project, userId);

  if (
    !projectAccess &&
    String(task.assignedTo ?? "") !== userId &&
    String(task.createdBy) !== userId
  ) {
    throw httpError(
      403,
      "You do not have access to this task"
    );
  }

  return task;
};

const canManageTask = (task, req) =>
  isManager(req) ||
  String(task.createdBy) === getUserId(req);

const canWorkOnTask = (task, req) =>
  isManager(req) ||
  String(task.assignedTo ?? "") ===
    getUserId(req);

const populateTask = (query) =>
  query
    .populate(
      "project",
      "name status client"
    )
    .populate(
      "assignedTo",
      "name email role"
    )
    .populate(
      "assignedBy",
      "name email"
    )
    .populate(
      "createdBy",
      "name email"
    )
    .populate(
      "completedBy",
      "name email"
    );

// ======================================
// Employee Visibility Filter
// ======================================

const getVisibilityFilter = async (req) => {
  if (isManager(req)) {
    return {};
  }

  const userId = getUserId(req);

  const projectIds =
    await getAccessibleProjectIds(userId);

  return {
    $or: [
      { assignedTo: userId },
      { createdBy: userId },
      { project: { $in: projectIds } },
    ],
  };
};

// ======================================
// GET /api/tasks
// ======================================

export const getTasks = async (
  req,
  res,
  next
) => {
  try {
    const query = req.validatedQuery;

    const filters = [];

    const visibility =
      await getVisibilityFilter(req);

    if (Object.keys(visibility).length) {
      filters.push(visibility);
    }

    const fieldFilters = {};

    for (const field of [
      "project",
      "assignedTo",
      "createdBy",
      "status",
      "priority",
      "type",
    ]) {
      if (query[field]) {
        fieldFilters[field] = query[field];
      }
    }

    if (Object.keys(fieldFilters).length) {
      filters.push(fieldFilters);
    }

    if (query.search) {
      const regex = new RegExp(
        escapeRegex(query.search),
        "i"
      );

      filters.push({
        $or: [
          { title: regex },
          { description: regex },
        ],
      });
    }

    if (query.fromDate || query.toDate) {
      const dueDate = {};

      if (query.fromDate) {
        dueDate.$gte = new Date(
          query.fromDate
        );
      }

      if (query.toDate) {
        dueDate.$lte = new Date(
          query.toDate
        );
      }

      filters.push({ dueDate });
    }

    if (query.overdue === "true") {
      filters.push({
        dueDate: { $lt: new Date() },
        status: {
          $nin: [
            "Completed",
            "Cancelled",
          ],
        },
      });
    }

    if (query.overdue === "false") {
      filters.push({
        $or: [
          { dueDate: null },
          {
            dueDate: {
              $gte: new Date(),
            },
          },
          {
            status: {
              $in: [
                "Completed",
                "Cancelled",
              ],
            },
          },
        ],
      });
    }

    const filter =
      filters.length > 0
        ? { $and: filters }
        : {};

    const {
      page,
      limit,
      sortBy,
      sortOrder,
    } = query;

    const [tasks, total] =
      await Promise.all([
        populateTask(
          Task.find(filter)
            .sort({
              [sortBy]:
                sortOrder === "asc" ? 1 : -1,
              _id: -1,
            })
            .skip((page - 1) * limit)
            .limit(limit)
        ),

        Task.countDocuments(filter),
      ]);

    return res.status(200).json({
      success: true,
      tasks,
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
// GET /api/tasks/stats
// ======================================

export const getTaskStats = async (
  req,
  res,
  next
) => {
  try {
    const filter =
      await getVisibilityFilter(req);

    const now = new Date();

    const [stats] = await Task.aggregate([
      { $match: filter },

      {
        $group: {
          _id: null,

          total: { $sum: 1 },

          todo: {
            $sum: {
              $cond: [
                { $eq: ["$status", "Todo"] },
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

          inReview: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    "$status",
                    "In Review",
                  ],
                },
                1,
                0,
              ],
            },
          },

          completed: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    "$status",
                    "Completed",
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
                {
                  $eq: [
                    "$status",
                    "On Hold",
                  ],
                },
                1,
                0,
              ],
            },
          },

          cancelled: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    "$status",
                    "Cancelled",
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
                      $lt: [
                        "$dueDate",
                        now,
                      ],
                    },
                    {
                      $ne: [
                        "$dueDate",
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

          totalEstimatedHours: {
            $sum: "$estimatedHours",
          },

          totalActualHours: {
            $sum: "$actualHours",
          },

          averageProgress: {
            $avg: "$progress",
          },
        },
      },
    ]);

    const result = stats ?? {
      total: 0,
      todo: 0,
      inProgress: 0,
      inReview: 0,
      completed: 0,
      onHold: 0,
      cancelled: 0,
      overdue: 0,
      totalEstimatedHours: 0,
      totalActualHours: 0,
      averageProgress: 0,
    };

    const { _id, ...cleanStats } = result;

    return res.status(200).json({
      success: true,
      stats: {
        ...cleanStats,
        averageProgress: Math.round(
          result.averageProgress ?? 0
        ),
        totalEstimatedHours: roundHours(
          result.totalEstimatedHours
        ),
        totalActualHours: roundHours(
          result.totalActualHours
        ),
      },
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// GET /api/tasks/:id
// ======================================

export const getTaskById = async (
  req,
  res,
  next
) => {
  try {
    const task = await getTaskOrThrow(
      req.validatedParams.id,
      req
    );

    await task.populate([
      {
        path: "project",
        select: "name status client",
      },
      {
        path: "assignedTo",
        select: "name email role",
      },
      {
        path: "assignedBy",
        select: "name email",
      },
      {
        path: "createdBy",
        select: "name email",
      },
      {
        path: "completedBy",
        select: "name email",
      },
    ]);

    return res.status(200).json({
      success: true,
      task,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// POST /api/tasks
// ======================================

export const createTask = async (
  req,
  res,
  next
) => {
  try {
    if (!isManager(req)) {
      throw httpError(
        403,
        "Only admins and managers can create tasks"
      );
    }

    const data = { ...req.body };

    const project =
      await validateProjectAccess(
        data.project,
        req
      );

    if (
      ["Completed", "Cancelled"].includes(
        project.status
      )
    ) {
      throw httpError(
        409,
        "Cannot create tasks for a closed project"
      );
    }

    await validateEmployee(
      data.assignedTo,
      project
    );

    const task = await Task.create({
      ...data,

      status: "Todo",
      progress: 0,
      actualHours: 0,

      assignedBy: data.assignedTo
        ? getUserId(req)
        : null,

      createdBy: getUserId(req),

      checklist: (
        data.checklist ?? []
      ).map((item) => ({
        title: item.title,
        isCompleted: false,
        completedAt: null,
        completedBy: null,
      })),
    });

    return res.status(201).json({
      success: true,
      message:
        "Task created successfully",
      task,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// PATCH /api/tasks/:id
// ======================================

export const updateTask = async (
  req,
  res,
  next
) => {
  try {
    const task = await getTaskOrThrow(
      req.validatedParams.id,
      req
    );

    if (!canManageTask(task, req)) {
      throw httpError(
        403,
        "You cannot edit this task"
      );
    }

    if (
      ["Completed", "Cancelled"].includes(
        task.status
      )
    ) {
      throw httpError(
        409,
        "Closed tasks cannot be edited"
      );
    }

    const data = { ...req.body };

    const nextStartDate =
      "startDate" in data
        ? data.startDate
        : task.startDate;

    const nextDueDate =
      "dueDate" in data
        ? data.dueDate
        : task.dueDate;

    if (
      nextStartDate &&
      nextDueDate &&
      new Date(nextDueDate) <
        new Date(nextStartDate)
    ) {
      throw httpError(
        400,
        "Due date cannot be before start date"
      );
    }

    task.set(data);

    await task.save();

    return res.status(200).json({
      success: true,
      message:
        "Task updated successfully",
      task,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// PATCH /api/tasks/:id/assign
// ======================================

export const assignTask = async (
  req,
  res,
  next
) => {
  try {
    if (!isManager(req)) {
      throw httpError(
        403,
        "Only admins and managers can assign tasks"
      );
    }

    const task = await getTaskOrThrow(
      req.validatedParams.id,
      req
    );

    if (
      ["Completed", "Cancelled"].includes(
        task.status
      )
    ) {
      throw httpError(
        409,
        "Closed tasks cannot be reassigned"
      );
    }

    const project = await Project.findById(
      task.project
    ).select(
      "projectManager assignedTo"
    );

    if (!project) {
      throw httpError(
        404,
        "Project not found"
      );
    }

    const { assignedTo } = req.body;

    await validateEmployee(
      assignedTo,
      project
    );

    task.assignedTo = assignedTo;
    task.assignedBy = assignedTo
      ? getUserId(req)
      : null;

    await task.save();

    return res.status(200).json({
      success: true,
      message: assignedTo
        ? "Task assigned successfully"
        : "Task unassigned successfully",
      task,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// PATCH /api/tasks/:id/status
// ======================================

export const updateTaskStatus = async (
  req,
  res,
  next
) => {
  try {
    const task = await getTaskOrThrow(
      req.validatedParams.id,
      req
    );

    if (!canWorkOnTask(task, req)) {
      throw httpError(
        403,
        "You cannot change this task status"
      );
    }

    const {
      status,
      progress,
    } = req.body;

    if (
      task.status === "Cancelled" &&
      !isManager(req)
    ) {
      throw httpError(
        403,
        "Only managers can reopen cancelled tasks"
      );
    }

    if (
      status === "Cancelled" &&
      !isManager(req)
    ) {
      throw httpError(
        403,
        "Only managers can cancel tasks"
      );
    }

    task.status = status;

    if (status === "Completed") {
      task.progress = 100;
      task.completedAt = new Date();
      task.completedBy = getUserId(req);
    } else {
      task.progress =
        progress !== undefined
          ? progress
          : task.progress === 100
            ? 0
            : task.progress;

      task.completedAt = null;
      task.completedBy = null;
    }

    await task.save();

    return res.status(200).json({
      success: true,
      message:
        "Task status updated successfully",
      task,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// PATCH /api/tasks/:id/progress
// ======================================

export const updateTaskProgress = async (
  req,
  res,
  next
) => {
  try {
    const task = await getTaskOrThrow(
      req.validatedParams.id,
      req
    );

    if (!canWorkOnTask(task, req)) {
      throw httpError(
        403,
        "You cannot update task progress"
      );
    }

    if (
      ["Completed", "Cancelled"].includes(
        task.status
      )
    ) {
      throw httpError(
        409,
        "Cannot change progress of a closed task"
      );
    }

    const { progress } = req.body;

    if (progress === 100) {
      throw httpError(
        400,
        "Use the status endpoint to complete a task"
      );
    }

    task.progress = progress;

    if (
      progress > 0 &&
      task.status === "Todo"
    ) {
      task.status = "In Progress";
    }

    await task.save();

    return res.status(200).json({
      success: true,
      message:
        "Task progress updated successfully",
      task,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// PATCH /api/tasks/:id/hours
// ======================================

export const updateTaskHours = async (
  req,
  res,
  next
) => {
  try {
    const task = await getTaskOrThrow(
      req.validatedParams.id,
      req
    );

    if (!canWorkOnTask(task, req)) {
      throw httpError(
        403,
        "You cannot update task hours"
      );
    }

    if (task.status === "Cancelled") {
      throw httpError(
        409,
        "Cannot log hours on cancelled tasks"
      );
    }

    task.actualHours = req.body.actualHours;

    await task.save();

    return res.status(200).json({
      success: true,
      message:
        "Task hours updated successfully",
      task,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// POST /api/tasks/:id/checklist
// ======================================

export const addTaskChecklist = async (
  req,
  res,
  next
) => {
  try {
    const task = await getTaskOrThrow(
      req.validatedParams.id,
      req
    );

    if (!canManageTask(task, req)) {
      throw httpError(
        403,
        "You cannot modify this checklist"
      );
    }

    if (
      ["Completed", "Cancelled"].includes(
        task.status
      )
    ) {
      throw httpError(
        409,
        "Cannot modify checklist of closed task"
      );
    }

    if (task.checklist.length >= 100) {
      throw httpError(
        400,
        "Checklist limit reached"
      );
    }

    task.checklist.push({
      title: req.body.title,
      isCompleted: false,
      completedAt: null,
      completedBy: null,
    });

    await task.save();

    return res.status(201).json({
      success: true,
      message:
        "Checklist item added successfully",
      task,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// PATCH /api/tasks/:id/checklist/:itemId
// ======================================

export const updateTaskChecklist = async (
  req,
  res,
  next
) => {
  try {
    const task = await getTaskOrThrow(
      req.validatedParams.id,
      req
    );

    if (
      !canManageTask(task, req) &&
      !canWorkOnTask(task, req)
    ) {
      throw httpError(
        403,
        "You cannot update this checklist"
      );
    }

    if (
      ["Completed", "Cancelled"].includes(
        task.status
      )
    ) {
      throw httpError(
        409,
        "Cannot modify checklist of closed task"
      );
    }

    const item = task.checklist.id(
      req.validatedParams.itemId
    );

    if (!item) {
      throw httpError(
        404,
        "Checklist item not found"
      );
    }

    const {
      title,
      isCompleted,
    } = req.body;

    if (title !== undefined) {
      item.title = title;
    }

    if (isCompleted !== undefined) {
      item.isCompleted = isCompleted;

      item.completedAt = isCompleted
        ? new Date()
        : null;

      item.completedBy = isCompleted
        ? getUserId(req)
        : null;
    }

    await task.save();

    return res.status(200).json({
      success: true,
      message:
        "Checklist item updated successfully",
      task,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// DELETE /api/tasks/:id/checklist/:itemId
// ======================================

export const deleteTaskChecklist = async (
  req,
  res,
  next
) => {
  try {
    const task = await getTaskOrThrow(
      req.validatedParams.id,
      req
    );

    if (!canManageTask(task, req)) {
      throw httpError(
        403,
        "You cannot delete checklist items"
      );
    }

    if (
      ["Completed", "Cancelled"].includes(
        task.status
      )
    ) {
      throw httpError(
        409,
        "Cannot modify checklist of closed task"
      );
    }

    const item = task.checklist.id(
      req.validatedParams.itemId
    );

    if (!item) {
      throw httpError(
        404,
        "Checklist item not found"
      );
    }

    task.checklist.pull(item._id);

    await task.save();

    return res.status(200).json({
      success: true,
      message:
        "Checklist item deleted successfully",
      task,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// DELETE /api/tasks/:id
// ======================================

export const deleteTask = async (
  req,
  res,
  next
) => {
  try {
    if (!isManager(req)) {
      throw httpError(
        403,
        "Only admins and managers can delete tasks"
      );
    }

    const task = await getTaskOrThrow(
      req.validatedParams.id,
      req
    );

    if (task.status !== "Todo") {
      throw httpError(
        409,
        "Only Todo tasks can be deleted"
      );
    }

    await task.deleteOne();

    return res.status(200).json({
      success: true,
      message:
        "Task deleted successfully",
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};
