
const API_URL = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api"
).replace(/\/+$/, "");

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

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...options.headers,
    },
  });

  return parseResponse(response);
}

async function getCsrfToken() {
  const result = await request("/auth/csrf");

  if (typeof result.csrfToken !== "string") {
    throw new Error("CSRF token missing from response");
  }

  return result.csrfToken;
}

async function mutate(path, method, body) {
  const csrfToken = await getCsrfToken();

  return request(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body) }),
  });
}

export const projectApi = {
  async getAll(params = {}) {
    const query = new URLSearchParams({
      page: String(params.page ?? 1),
      limit: String(params.limit ?? 10),
    });

    for (const key of [
      "search",
      "status",
      "priority",
      "type",
      "client",
      "assignedTo",
      "sortBy",
      "sortOrder",
    ]) {
      if (params[key] !== undefined && params[key] !== "") {
        query.set(key, String(params[key]));
      }
    }

    return request(`/projects?${query.toString()}`);
  },

  async getById(id) {
    return request(`/projects/${encodeURIComponent(id)}`);
  },

  async getStats() {
    return request("/projects/stats");
  },

  async create(data) {
    return mutate("/projects", "POST", data);
  },

  async update(id, data) {
    return mutate(
      `/projects/${encodeURIComponent(id)}`,
      "PATCH",
      data
    );
  },

  async updateStatus(id, status) {
    return mutate(
      `/projects/${encodeURIComponent(id)}/status`,
      "PATCH",
      { status }
    );
  },

  async remove(id) {
    return mutate(
      `/projects/${encodeURIComponent(id)}`,
      "DELETE"
    );
  },
};
