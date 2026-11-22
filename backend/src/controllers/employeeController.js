
import mongoose from "mongoose";

import Employee from "../models/Employee.js";
import EmployeeCounter from "../models/EmployeeCounter.js";
import User from "../models/User.js";

// ======================================
// Helpers
// ======================================

const httpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const userIdOf = (req) =>
  String(req.user._id ?? req.user.id);

const isAdmin = (req) =>
  req.user.role === "admin";

const isManager = (req) =>
  ["admin", "manager"].includes(req.user.role);

const isDuplicateKey = (error) =>
  error.code === 11000;

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const PRIVATE_FIELDS = [
  "salary",
  "dateOfBirth",
  "gender",
  "address",
  "city",
  "state",
  "country",
  "emergencyContact",
  "notes",
];

const sanitizeEmployee = (
  employee,
  showPrivate = false
) => {
  const data =
    typeof employee.toJSON === "function"
      ? employee.toJSON()
      : { ...employee };

  if (!showPrivate) {
    for (const field of PRIVATE_FIELDS) {
      delete data[field];
    }
  }

  return data;
};

const handleError = (error, res, next) => {
  if (isDuplicateKey(error)) {
    return res.status(409).json({
      success: false,
      message:
        "Employee account or employee ID already exists",
    });
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Employee validation failed",
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
        "Employee was modified by another request",
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
// Access Control
// ======================================

const canViewEmployee = (employee, req) => {
  if (isManager(req)) return true;

  return (
    String(employee.user?._id ?? employee.user) ===
    userIdOf(req)
  );
};

const getEmployeeOrThrow = async (
  id,
  req
) => {
  const employee = await Employee.findById(id);

  if (!employee) {
    throw httpError(404, "Employee not found");
  }

  if (!canViewEmployee(employee, req)) {
    throw httpError(
      403,
      "You cannot access this employee"
    );
  }

  return employee;
};

const validateActiveUser = async (
  userId,
  label = "User"
) => {
  const user = await User.findById(userId)
    .select("_id name email role isActive");

  if (!user || !user.isActive) {
    throw httpError(
      400,
      `${label} not found or inactive`
    );
  }

  return user;
};

const validateReportingManager = async (
  managerId,
  employeeUserId
) => {
  if (!managerId) return null;

  if (
    String(managerId) ===
    String(employeeUserId)
  ) {
    throw httpError(
      400,
      "Employee cannot report to themselves"
    );
  }

  const manager =
    await validateActiveUser(
      managerId,
      "Reporting manager"
    );

  if (
    !["admin", "manager"].includes(
      manager.role
    )
  ) {
    throw httpError(
      400,
      "Reporting manager must have an admin or manager role"
    );
  }

  return manager;
};

// ======================================
// Date Validation
// ======================================

const validateDates = (data) => {
  const joiningDate = data.joiningDate
    ? new Date(data.joiningDate)
    : null;

  const confirmationDate =
    data.confirmationDate
      ? new Date(data.confirmationDate)
      : null;

  const exitDate = data.exitDate
    ? new Date(data.exitDate)
    : null;

  const dateOfBirth = data.dateOfBirth
    ? new Date(data.dateOfBirth)
    : null;

  if (
    joiningDate &&
    confirmationDate &&
    confirmationDate < joiningDate
  ) {
    throw httpError(
      400,
      "Confirmation date cannot be before joining date"
    );
  }

  if (
    joiningDate &&
    exitDate &&
    exitDate < joiningDate
  ) {
    throw httpError(
      400,
      "Exit date cannot be before joining date"
    );
  }

  if (
    joiningDate &&
    dateOfBirth &&
    dateOfBirth >= joiningDate
  ) {
    throw httpError(
      400,
      "Date of birth must be before joining date"
    );
  }
};

// ======================================
// Employee Population
// ======================================

const populateEmployee = (query) =>
  query
    .populate(
      "user",
      "name email phone role isActive"
    )
    .populate(
      "reportingManager",
      "name email role"
    )
    .populate(
      "createdBy",
      "name email"
    )
    .populate(
      "updatedBy",
      "name email"
    );

// ======================================
// GET /api/employees
// ======================================

export const getEmployees = async (
  req,
  res,
  next
) => {
  try {
    const query = req.validatedQuery;

    const {
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      fromDate,
      toDate,
    } = query;

    const filter = {};

    if (!isManager(req)) {
      filter.user = userIdOf(req);
    }

    for (const field of [
      "department",
      "employmentType",
      "status",
      "workMode",
      "reportingManager",
    ]) {
      if (query[field]) {
        filter[field] = query[field];
      }
    }

    if (fromDate || toDate) {
      filter.joiningDate = {};

      if (fromDate) {
        filter.joiningDate.$gte =
          new Date(fromDate);
      }

      if (toDate) {
        filter.joiningDate.$lte =
          new Date(toDate);
      }
    }

    if (search) {
      const regex = new RegExp(
        escapeRegex(search),
        "i"
      );

      const matchingUsers = await User.find({
        $or: [
          { name: regex },
          { email: regex },
        ],
      })
        .select("_id")
        .lean();

      filter.$or = [
        { employeeId: regex },
        { designation: regex },
        {
          user: {
            $in: matchingUsers.map(
              (user) => user._id
            ),
          },
        },
      ];
    }

    const [employees, total] =
      await Promise.all([
        populateEmployee(
          Employee.find(filter)
            .sort({
              [sortBy]:
                sortOrder === "asc" ? 1 : -1,
              _id: -1,
            })
            .skip((page - 1) * limit)
            .limit(limit)
        ),

        Employee.countDocuments(filter),
      ]);

    return res.status(200).json({
      success: true,

      employees: employees.map(
        (employee) =>
          sanitizeEmployee(
            employee,
            isAdmin(req)
          )
      ),

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
// GET /api/employees/stats
// ======================================

export const getEmployeeStats = async (
  req,
  res,
  next
) => {
  try {
    if (!isManager(req)) {
      throw httpError(
        403,
        "Only admins and managers can view employee statistics"
      );
    }

    const [
      total,
      active,
      onLeave,
      noticePeriod,
      resigned,
      terminated,
      departmentStats,
    ] = await Promise.all([
      Employee.countDocuments(),

      Employee.countDocuments({
        status: "Active",
      }),

      Employee.countDocuments({
        status: "On Leave",
      }),

      Employee.countDocuments({
        status: "Notice Period",
      }),

      Employee.countDocuments({
        status: "Resigned",
      }),

      Employee.countDocuments({
        status: "Terminated",
      }),

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
    ]);

    return res.status(200).json({
      success: true,

      stats: {
        total,
        active,
        onLeave,
        noticePeriod,
        resigned,
        terminated,

        currentlyEmployed:
          active + onLeave + noticePeriod,

        departments:
          departmentStats.map(
            (item) => ({
              department: item._id,
              count: item.count,
            })
          ),
      },
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// GET /api/employees/:id
// ======================================

export const getEmployeeById = async (
  req,
  res,
  next
) => {
  try {
    const employee =
      await getEmployeeOrThrow(
        req.validatedParams.id,
        req
      );

    await employee.populate([
      {
        path: "user",
        select:
          "name email phone role isActive",
      },
      {
        path: "reportingManager",
        select: "name email role",
      },
      {
        path: "createdBy",
        select: "name email",
      },
      {
        path: "updatedBy",
        select: "name email",
      },
    ]);

    const ownProfile =
      String(employee.user?._id) ===
      userIdOf(req);

    return res.status(200).json({
      success: true,

      employee: sanitizeEmployee(
        employee,
        isAdmin(req) || ownProfile
      ),
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// POST /api/employees
// ======================================

export const createEmployee = async (
  req,
  res,
  next
) => {
  try {
    if (!isAdmin(req)) {
      throw httpError(
        403,
        "Only admins can create employee profiles"
      );
    }

    const data = { ...req.body };

    await validateActiveUser(data.user);

    await validateReportingManager(
      data.reportingManager,
      data.user
    );

    const existing =
      await Employee.exists({
        user: data.user,
      });

    if (existing) {
      throw httpError(
        409,
        "Employee profile already exists for this user"
      );
    }

    validateDates(data);

    // Allocate an atomic sequence.
    // Gaps are acceptable if creation fails.
    const employeeId =
      await EmployeeCounter.generateEmployeeId();

    const employee =
      await Employee.create({
        ...data,
        employeeId,
        createdBy: userIdOf(req),
        updatedBy: userIdOf(req),
      });

    return res.status(201).json({
      success: true,
      message:
        "Employee created successfully",
      employee: sanitizeEmployee(
        employee,
        true
      ),
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// PATCH /api/employees/:id
// ======================================

export const updateEmployee = async (
  req,
  res,
  next
) => {
  try {
    if (!isAdmin(req)) {
      throw httpError(
        403,
        "Only admins can update employee profiles"
      );
    }

    const employee =
      await getEmployeeOrThrow(
        req.validatedParams.id,
        req
      );

    const data = { ...req.body };

    if (
      "reportingManager" in data
    ) {
      await validateReportingManager(
        data.reportingManager,
        employee.user
      );
    }

    validateDates({
      joiningDate:
        data.joiningDate ??
        employee.joiningDate,

      confirmationDate:
        "confirmationDate" in data
          ? data.confirmationDate
          : employee.confirmationDate,

      dateOfBirth:
        "dateOfBirth" in data
          ? data.dateOfBirth
          : employee.dateOfBirth,

      exitDate: employee.exitDate,
    });

    employee.set(data);

    employee.updatedBy =
      userIdOf(req);

    await employee.save();

    return res.status(200).json({
      success: true,
      message:
        "Employee updated successfully",
      employee: sanitizeEmployee(
        employee,
        true
      ),
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// PATCH /api/employees/:id/salary
// ======================================

export const updateEmployeeSalary = async (
  req,
  res,
  next
) => {
  try {
    if (!isAdmin(req)) {
      throw httpError(
        403,
        "Only admins can update salaries"
      );
    }

    const employee =
      await getEmployeeOrThrow(
        req.validatedParams.id,
        req
      );

    employee.salary = {
      amount: req.body.amount,
      currency: req.body.currency,
      type: req.body.type,
    };

    employee.updatedBy =
      userIdOf(req);

    await employee.save();

    return res.status(200).json({
      success: true,
      message:
        "Employee salary updated successfully",
      employee: sanitizeEmployee(
        employee,
        true
      ),
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// PATCH /api/employees/:id/manager
// ======================================

export const updateReportingManager = async (
  req,
  res,
  next
) => {
  try {
    if (!isAdmin(req)) {
      throw httpError(
        403,
        "Only admins can update reporting managers"
      );
    }

    const employee =
      await getEmployeeOrThrow(
        req.validatedParams.id,
        req
      );

    const { reportingManager } =
      req.body;

    await validateReportingManager(
      reportingManager,
      employee.user
    );

    employee.reportingManager =
      reportingManager;

    employee.updatedBy =
      userIdOf(req);

    await employee.save();

    return res.status(200).json({
      success: true,
      message:
        "Reporting manager updated successfully",
      employee: sanitizeEmployee(
        employee,
        true
      ),
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// PATCH /api/employees/:id/status
// ======================================

export const updateEmployeeStatus = async (
  req,
  res,
  next
) => {
  try {
    if (!isAdmin(req)) {
      throw httpError(
        403,
        "Only admins can change employment status"
      );
    }

    const employee =
      await getEmployeeOrThrow(
        req.validatedParams.id,
        req
      );

    const { status, exitDate } =
      req.body;

    validateDates({
      joiningDate: employee.joiningDate,
      exitDate: exitDate ?? null,
    });

    const exiting = [
      "Resigned",
      "Terminated",
    ].includes(status);

    if (
      exiting &&
      String(employee.user) ===
        userIdOf(req)
    ) {
      throw httpError(
        403,
        "You cannot deactivate your own account"
      );
    }

    // Employee and login account must be
    // updated together.
    // MongoDB transactions require a
    // replica set or sharded cluster.
    const session =
      await mongoose.startSession();

    try {
      await session.withTransaction(
        async () => {
          const currentEmployee =
            await Employee.findById(
              employee._id
            ).session(session);

          if (!currentEmployee) {
            throw httpError(
              404,
              "Employee not found"
            );
          }

          currentEmployee.status =
            status;

          currentEmployee.exitDate =
            exiting
              ? new Date(exitDate)
              : null;

          currentEmployee.updatedBy =
            userIdOf(req);

          await currentEmployee.save({
            session,
          });

          const user =
            await User.findById(
              currentEmployee.user
            ).session(session);

          if (!user) {
            throw httpError(
              404,
              "Linked user not found"
            );
          }

          user.isActive = !exiting;

          await user.save({
            session,
          });
        }
      );
    } finally {
      await session.endSession();
    }

    const updatedEmployee =
      await Employee.findById(
        employee._id
      );

    return res.status(200).json({
      success: true,
      message:
        "Employment status updated successfully",
      employee: sanitizeEmployee(
        updatedEmployee,
        true
      ),
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// DELETE /api/employees/:id
// ======================================

export const deleteEmployee = async (
  req,
  res,
  next
) => {
  try {
    if (!isAdmin(req)) {
      throw httpError(
        403,
        "Only admins can delete employee profiles"
      );
    }

    const employee =
      await getEmployeeOrThrow(
        req.validatedParams.id,
        req
      );

    if (
      !["Resigned", "Terminated"].includes(
        employee.status
      )
    ) {
      throw httpError(
        409,
        "Only exited employee profiles can be deleted"
      );
    }

    // Preserve historical HR records.
    // Hard deletion is intentionally disabled.
    throw httpError(
      405,
      "Employee deletion is disabled. Retain exited employee records for audit purposes."
    );
  } catch (error) {
    return handleError(error, res, next);
  }
};
