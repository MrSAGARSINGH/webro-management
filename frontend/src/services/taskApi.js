
const API_URL = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api"
).replace(/\/+$/, "");

// ======================================
// Response Handler
// ======================================

async function parseResponse(response) {
  const result = await response
    .json()
    .catch(() => null);

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
// CSRF Protection
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

  for (const [key, value] of Object.entries(params)) {
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

function taskPath(id) {
  if (!id || typeof id !== "string") {
    throw new Error("Valid task ID is required.");
  }

  return `/tasks/${encodeURIComponent(id)}`;
}

// ======================================
// Task API
// ======================================

export const taskApi = {
  // GET /api/tasks
  getAll(params = {}, signal) {
    return request(
      `/tasks${buildQuery(params)}`,
      { signal }
    );
  },

  // GET /api/tasks/stats
  getStats(signal) {
    return request("/tasks/stats", {
      signal,
    });
  },

  // GET /api/tasks/:id
  getById(id, signal) {
    return request(taskPath(id), {
      signal,
    });
  },

  // POST /api/tasks
  create(data) {
    return mutate(
      "/tasks",
      "POST",
      data
    );
  },

  // PATCH /api/tasks/:id
  update(id, data) {
    return mutate(
      taskPath(id),
      "PATCH",
      data
    );
  },

  // PATCH /api/tasks/:id/assign
  assign(id, assignedTo) {
    return mutate(
      `${taskPath(id)}/assign`,
      "PATCH",
      { assignedTo: assignedTo || null }
    );
  },

  // PATCH /api/tasks/:id/status
  updateStatus(id, status, progress) {
    return mutate(
      `${taskPath(id)}/status`,
      "PATCH",
      {
        status,
        ...(progress !== undefined
          ? { progress }
          : {}),
      }
    );
  },

  // PATCH /api/tasks/:id/progress
  updateProgress(id, progress) {
    return mutate(
      `${taskPath(id)}/progress`,
      "PATCH",
      { progress }
    );
  },

  // PATCH /api/tasks/:id/hours
  updateHours(id, actualHours) {
    return mutate(
      `${taskPath(id)}/hours`,
      "PATCH",
      { actualHours }
    );
  },

  // POST /api/tasks/:id/checklist
  addChecklistItem(id, title) {
    return mutate(
      `${taskPath(id)}/checklist`,
      "POST",
      { title }
    );
  },

  // PATCH /api/tasks/:id/checklist/:itemId
  updateChecklistItem(id, itemId, data) {
    return mutate(
      `${taskPath(id)}/checklist/${encodeURIComponent(
        itemId
      )}`,
      "PATCH",
      data
    );
  },

  // DELETE /api/tasks/:id/checklist/:itemId
  deleteChecklistItem(id, itemId) {
    return mutate(
      `${taskPath(id)}/checklist/${encodeURIComponent(
        itemId
      )}`,
      "DELETE"
    );
  },

  // DELETE /api/tasks/:id
  remove(id) {
    return mutate(
      taskPath(id),
      "DELETE"
    );
  },
};
