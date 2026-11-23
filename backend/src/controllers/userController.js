
import User from "../models/User.js";
import Employee from "../models/Employee.js";
import {
  AppError,
  asyncHandler,
} from "../middlewares/errorMiddleware.js";

// ======================================
// Constants
// ======================================

const ROLES = ["admin", "manager", "employee"];

const OBJECT_ID = /^[a-f\d]{24}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^$|^[6-9]\d{9}$/;

const OWN = Object.prototype.hasOwnProperty;

// ======================================
// Error Helpers
// ======================================

const fail = (message, code = "INVALID_INPUT") => {
  throw new AppError(message, 400, code);
};

const ensureObject = (body) => {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    fail("Request body must be an object");
  }
};

const allowFields = (body, allowed) => {
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) {
      fail(`Unexpected field: ${key}`);
    }
  }
};

const validateId = (id) => {
  if (!OBJECT_ID.test(id ?? "")) {
    fail("Invalid user ID", "INVALID_USER_ID");
  }

  return id;
};

// ======================================
// Safe User Response
// ======================================

const serializeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone ?? "",
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

// ======================================
// Field Validation
// ======================================

const textField = (value, name, min, max) => {
  if (typeof value !== "string") {
    fail(`${name} must be a string`);
  }

  const normalized = value.trim();

  if (
    normalized.length < min ||
    normalized.length > max
  ) {
    fail(
      `${name} must contain ${min} to ${max} characters`
    );
  }

  return normalized;
};

const parseFields = (
  body,
  { creating = false } = {}
) => {
  ensureObject(body);

  allowFields(
    body,
    creating
      ? ["name", "email", "phone", "role", "password"]
      : ["name", "email", "phone", "role"]
  );

  const data = {};

  if (creating || OWN.call(body, "name")) {
    data.name = textField(
      body.name,
      "Name",
      2,
      100
    );
  }

  if (creating || OWN.call(body, "email")) {
    data.email = textField(
      body.email,
      "Email",
      3,
      254
    ).toLowerCase();

    if (!EMAIL.test(data.email)) {
      fail("Enter a valid email address");
    }
  }

  if (OWN.call(body, "phone")) {
    data.phone = textField(
      body.phone,
      "Phone",
      0,
      10
    );

    if (!PHONE.test(data.phone)) {
      fail("Enter a valid Indian mobile number");
    }
  }

  if (OWN.call(body, "role")) {
    if (!ROLES.includes(body.role)) {
      fail("Invalid user role");
    }

    data.role = body.role;
  }

  if (creating) {
    if (
      typeof body.password !== "string" ||
      body.password.length < 12 ||
      Buffer.byteLength(
        body.password,
        "utf8"
      ) > 72
    ) {
      fail(
        "Password must be at least 12 characters and at most 72 UTF-8 bytes"
      );
    }
  }

  if (
    !creating &&
    Object.keys(data).length === 0
  ) {
    fail("Provide at least one field to update");
  }

  return data;
};

// ======================================
// Query Validation
// ======================================

const parseListQuery = (query) => {
  const allowed = [
    "page",
    "limit",
    "search",
    "role",
    "isActive",
  ];

  allowFields(query, allowed);

  const page =
    query.page === undefined
      ? 1
      : Number(query.page);

  const limit =
    query.limit === undefined
      ? 20
      : Number(query.limit);

  if (
    !Number.isInteger(page) ||
    page < 1 ||
    page > 100000 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    fail("Invalid pagination parameters");
  }

  const filter = {};

  if (query.role !== undefined) {
    if (!ROLES.includes(query.role)) {
      fail("Invalid role filter");
    }

    filter.role = query.role;
  }

  if (query.isActive !== undefined) {
    if (
      query.isActive !== "true" &&
      query.isActive !== "false"
    ) {
      fail("isActive must be true or false");
    }

    filter.isActive =
      query.isActive === "true";
  }

  if (query.search !== undefined) {
    const search = textField(
      query.search,
      "Search",
      1,
      100
    );

    const escaped = search.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    filter.$or = [
      {
        name: {
          $regex: escaped,
          $options: "i",
        },
      },
      {
        email: {
          $regex: escaped,
          $options: "i",
        },
      },
    ];
  }

  return { page, limit, filter };
};

// ======================================
// Database Helpers
// ======================================

const getUser = async (id) => {
  const user = await User.findById(
    validateId(id)
  );

  if (!user) {
    throw new AppError(
      "User not found",
      404,
      "USER_NOT_FOUND"
    );
  }

  return user;
};

const checkDuplicateEmail = async (
  email,
  excludeId = null
) => {
  if (!email) return;

  const filter = { email };

  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  const existing = await User.exists(filter);

  if (existing) {
    throw new AppError(
      "An account with this email already exists",
      409,
      "EMAIL_ALREADY_EXISTS"
    );
  }
};

const saveUser = async (user) => {
  try {
    await user.save();
  } catch (error) {
    if (
      error?.code === 11000 &&
      error?.keyPattern?.email
    ) {
      throw new AppError(
        "An account with this email already exists",
        409,
        "EMAIL_ALREADY_EXISTS"
      );
    }

    throw error;
  }
};

// ======================================
// Last Admin Protection
// ======================================

const preventLastAdminRemoval = async (
  user,
  nextRole,
  nextActive
) => {
  if (
    user.role !== "admin" ||
    !user.isActive
  ) {
    return;
  }

  if (
    nextRole === "admin" &&
    nextActive === true
  ) {
    return;
  }

  const otherAdmins =
    await User.countDocuments({
      _id: { $ne: user._id },
      role: "admin",
      isActive: true,
    });

  if (otherAdmins === 0) {
    throw new AppError(
      "Cannot remove the last active admin",
      409,
      "LAST_ADMIN_REQUIRED"
    );
  }
};

// ======================================
// GET /api/users
// ======================================

export const getUsers = asyncHandler(
  async (req, res) => {
    const { page, limit, filter } =
      parseListQuery(req.query);

    const [users, total] =
      await Promise.all([
        User.find(filter)
          .select(
            "name email phone role isActive createdAt lastLoginAt"
          )
          .sort({
            createdAt: -1,
            _id: -1,
          })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),

        User.countDocuments(filter),
      ]);

    return res.json({
      success: true,
      users,
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
  }
);

// ======================================
// GET /api/users/available-employees
// ======================================

export const getAvailableEmployees =
  asyncHandler(async (_req, res) => {
    const linkedIds =
      await Employee.distinct("user");

    const users = await User.find({
      _id: {
        $nin: linkedIds,
      },
      isActive: true,
      role: "employee",
    })
      .select("name email phone role")
      .sort({
        name: 1,
        _id: 1,
      })
      .lean();

    return res.json({
      success: true,
      users,
    });
  });

// ======================================
// POST /api/users
// ======================================

export const createUser = asyncHandler(
  async (req, res) => {
    const data = parseFields(
      req.body,
      { creating: true }
    );

    // Employee accounts default to employee role.
    // Role assignment must be restricted in routes.
    data.role = data.role || "employee";

    await checkDuplicateEmail(data.email);

    const user = new User(data);

    await user.setPassword(
      req.body.password
    );

    await saveUser(user);

    return res.status(201).json({
      success: true,
      message:
        "User created successfully",
      user: serializeUser(user),
    });
  }
);

// ======================================
// PATCH /api/users/:id
// ======================================

export const updateUser = asyncHandler(
  async (req, res) => {
    const data = parseFields(req.body);

    const user = await getUser(
      req.params.id
    );

    if (data.email) {
      await checkDuplicateEmail(
        data.email,
        user._id
      );
    }

    await preventLastAdminRemoval(
      user,
      data.role ?? user.role,
      user.isActive
    );

    if (
      String(user._id) ===
        String(req.user._id) &&
      data.role !== undefined &&
      data.role !== "admin"
    ) {
      throw new AppError(
        "Cannot remove your own admin role",
        409,
        "SELF_ROLE_CHANGE_DENIED"
      );
    }

    Object.assign(user, data);

    await saveUser(user);

    return res.json({
      success: true,
      message:
        "User updated successfully",
      user: serializeUser(user),
    });
  }
);

// ======================================
// PATCH /api/users/:id/status
// ======================================

export const updateUserStatus =
  asyncHandler(async (req, res) => {
    ensureObject(req.body);

    allowFields(
      req.body,
      ["isActive"]
    );

    if (
      typeof req.body.isActive !==
      "boolean"
    ) {
      fail(
        "isActive must be a boolean"
      );
    }

    const user = await getUser(
      req.params.id
    );

    if (
      String(user._id) ===
        String(req.user._id) &&
      !req.body.isActive
    ) {
      throw new AppError(
        "Cannot deactivate your own account",
        409,
        "SELF_DEACTIVATION_DENIED"
      );
    }

    await preventLastAdminRemoval(
      user,
      user.role,
      req.body.isActive
    );

    user.isActive =
      req.body.isActive;

    await saveUser(user);

    return res.json({
      success: true,
      message:
        "User status updated successfully",
      user: serializeUser(user),
    });
  });
