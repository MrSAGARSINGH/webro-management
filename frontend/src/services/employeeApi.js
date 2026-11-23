
const API_URL = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api"
).replace(/\/+$/, "");

// ======================================
// Response Handler
// ======================================

async function parseResponse(response) {
  const result = await response.json().catch(() => null);

  if (!response.ok || result?.success !== true) {
    const error = new Error(
      result?.message ||
        `Request failed (${response.status})`
    );

    error.status = response.status;
    error.code = result?.code;
    error.details = result?.errors;

    throw error;
  }

  return result;
}

// ======================================
// HTTP Request
// ======================================

async function request(
  path,
  {
    method = "GET",
    body,
    signal,
    headers = {},
  } = {}
) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    credentials: "include",
    signal,
    headers: {
      Accept: "application/json",
      ...(body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
      ...headers,
    },
    ...(body !== undefined
      ? { body: JSON.stringify(body) }
      : {}),
  });

  return parseResponse(response);
}

// ======================================
// CSRF Token
// ======================================

async function getCsrfToken() {
  const result = await request("/auth/csrf");

  if (
    typeof result.csrfToken !== "string" ||
    !result.csrfToken
  ) {
    throw new Error(
      "CSRF token missing from response"
    );
  }

  return result.csrfToken;
}

// ======================================
// Protected Mutation
// ======================================

async function mutate(path, method, body) {
  const csrfToken = await getCsrfToken();

  return request(path, {
    method,
    body,
    headers: {
      "X-CSRF-Token": csrfToken,
    },
  });
}

// ======================================
// Query Builder
// ======================================

function buildQuery(params = {}) {
  const query = new URLSearchParams();

  const allowed = [
    "page",
    "limit",
    "search",
    "department",
    "employmentType",
    "status",
    "workMode",
    "reportingManager",
    "fromDate",
    "toDate",
    "sortBy",
    "sortOrder",
  ];

  for (const key of allowed) {
    const value = params[key];

    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      query.set(key, String(value));
    }
  }

  const search = query.toString();

  return search ? `?${search}` : "";
}

// ======================================
// Date Conversion
// ======================================

export function toEmployeeISODate(value) {
  if (!value) return null;

  if (typeof value !== "string") {
    throw new Error("Invalid date value");
  }

  // Already a valid ISO datetime
  if (
    /^\d{4}-\d{2}-\d{2}T/.test(value)
  ) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new Error("Invalid ISO date");
    }

    return date.toISOString();
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(
      "Date must use YYYY-MM-DD format"
    );
  }

  const date = new Date(`${value}T12:00:00`);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !==
      Number(value.slice(0, 4)) ||
    date.getMonth() + 1 !==
      Number(value.slice(5, 7)) ||
    date.getDate() !==
      Number(value.slice(8, 10))
  ) {
    throw new Error("Invalid employee date");
  }

  return date.toISOString();
}

// ======================================
// Employee API
// ======================================

export const employeeApi = {
  // GET /api/employees
  async getAll(params = {}, { signal } = {}) {
    return request(
      `/employees${buildQuery(params)}`,
      { signal }
    );
  },

  // GET /api/employees/stats
  async getStats({ signal } = {}) {
    return request("/employees/stats", {
      signal,
    });
  },

  // GET /api/employees/:id
  async getById(id, { signal } = {}) {
    return request(
      `/employees/${encodeURIComponent(id)}`,
      { signal }
    );
  },

  // POST /api/employees
  async create(data) {
    return mutate(
      "/employees",
      "POST",
      data
    );
  },

  // PATCH /api/employees/:id
  async update(id, data) {
    return mutate(
      `/employees/${encodeURIComponent(id)}`,
      "PATCH",
      data
    );
  },

  // PATCH /api/employees/:id/salary
  async updateSalary(id, salary) {
    return mutate(
      `/employees/${encodeURIComponent(id)}/salary`,
      "PATCH",
      {
        amount: salary.amount,
        currency: salary.currency || "INR",
        type: salary.type || "Monthly",
      }
    );
  },

  // PATCH /api/employees/:id/status
  async updateStatus(id, status, exitDate) {
    const data = { status };

    if (
      status === "Resigned" ||
      status === "Terminated"
    ) {
      if (!exitDate) {
        throw new Error(
          "Exit date is required"
        );
      }

      data.exitDate =
        toEmployeeISODate(exitDate);
    }

    return mutate(
      `/employees/${encodeURIComponent(id)}/status`,
      "PATCH",
      data
    );
  },

  // PATCH /api/employees/:id/manager
  async updateManager(id, reportingManager) {
    return mutate(
      `/employees/${encodeURIComponent(id)}/manager`,
      "PATCH",
      {
        reportingManager:
          reportingManager || null,
      }
    );
  },

  // GET /api/users/available-employees
  async getAvailableUsers({ signal } = {}) {
    return request(
      "/users/available-employees",
      { signal }
    );
  },

  // GET /api/users
  async getUsers(
    params = {},
    { signal } = {}
  ) {
    const query = new URLSearchParams();

    for (const key of [
      "page",
      "limit",
      "search",
      "role",
      "isActive",
    ]) {
      const value = params[key];

      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        query.set(key, String(value));
      }
    }

    const suffix = query.toString();

    return request(
      `/users${suffix ? `?${suffix}` : ""}`,
      { signal }
    );
  },

  // POST /api/users
  async createUser(data) {
    return mutate(
      "/users",
      "POST",
      data
    );
  },
};

export default employeeApi;
