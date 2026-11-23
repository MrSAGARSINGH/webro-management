
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
  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
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
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }

    throw new Error(
      "Unable to connect to Calendar API. Check backend connection."
    );
  }

  return parseResponse(response);
}

// ======================================
// CSRF Protection
// ======================================

async function getCsrfToken(signal) {
  const result = await request("/auth/csrf", {
    signal,
  });

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

async function mutate(
  path,
  method,
  body,
  { signal } = {}
) {
  const csrfToken = await getCsrfToken(signal);

  return request(path, {
    method,
    body,
    signal,
    headers: {
      "X-CSRF-Token": csrfToken,
    },
  });
}

// ======================================
// Date Validation
// ======================================

function isValidDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const [year, month, day] = value
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

// ======================================
// Query Builder
// ======================================

function buildQuery(params = {}) {
  const query = new URLSearchParams();

  for (const key of [
    "startDate",
    "endDate",
    "type",
    "project",
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

  return query.toString();
}

// ======================================
// Calendar API
// ======================================

export const calendarApi = {
  // ------------------------------------
  // Get events within a date range
  // ------------------------------------

  async getEvents(
    {
      startDate,
      endDate,
      type,
      project,
    } = {},
    { signal } = {}
  ) {
    if (
      !isValidDate(startDate) ||
      !isValidDate(endDate)
    ) {
      throw new Error(
        "Valid startDate and endDate are required (YYYY-MM-DD)."
      );
    }

    if (startDate > endDate) {
      throw new Error(
        "startDate cannot be later than endDate."
      );
    }

    const start = Date.parse(
      `${startDate}T00:00:00.000Z`
    );

    const end = Date.parse(
      `${endDate}T00:00:00.000Z`
    );

    if ((end - start) / 86400000 > 366) {
      throw new Error(
        "Calendar range cannot exceed 366 days."
      );
    }

    const query = buildQuery({
      startDate,
      endDate,
      type,
      project,
    });

    return request(`/calendar/events?${query}`, {
      signal,
    });
  },

  // ------------------------------------
  // Get a single event
  // ------------------------------------

  async getById(id, { signal } = {}) {
    if (!id) {
      throw new Error("Event ID is required.");
    }

    return request(
      `/calendar/events/${encodeURIComponent(id)}`,
      { signal }
    );
  },

  // ------------------------------------
  // Create a calendar event
  // ------------------------------------

  async create(data, { signal } = {}) {
    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data)
    ) {
      throw new Error(
        "Valid event data is required."
      );
    }

    return mutate(
      "/calendar/events",
      "POST",
      data,
      { signal }
    );
  },

  // ------------------------------------
  // Update a calendar event
  // ------------------------------------

  async update(id, data, { signal } = {}) {
    if (!id) {
      throw new Error("Event ID is required.");
    }

    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      Object.keys(data).length === 0
    ) {
      throw new Error(
        "At least one event field is required."
      );
    }

    return mutate(
      `/calendar/events/${encodeURIComponent(id)}`,
      "PATCH",
      data,
      { signal }
    );
  },

  // ------------------------------------
  // Delete a calendar event
  // ------------------------------------

  async remove(id, { signal } = {}) {
    if (!id) {
      throw new Error("Event ID is required.");
    }

    return mutate(
      `/calendar/events/${encodeURIComponent(id)}`,
      "DELETE",
      undefined,
      { signal }
    );
  },
};

export default calendarApi;
