
const API_URL = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api"
).replace(/\/+$/, "");

// ======================================
// Allowed Settings Fields
// ======================================

const COMPANY_FIELDS = [
  "name",
  "email",
  "phone",
  "website",
  "address",
  "gstin",
];

const PREFERENCE_FIELDS = [
  "theme",
  "accent",
  "currency",
  "dateFormat",
  "compactMode",
];

const NOTIFICATION_FIELDS = [
  "taskReminders",
  "followUpReminders",
  "paymentReminders",
  "projectDeadlines",
  "desktopNotifications",
];

// ======================================
// Error Handling
// ======================================

function createApiError(
  message,
  status = null,
  details = null,
  code = null
) {
  const error = new Error(message);

  error.name = "SettingsApiError";
  error.status = status;
  error.details = details;
  error.code = code;

  return error;
}

// ======================================
// Response Parser
// ======================================

async function parseResponse(response) {
  const result = await response
    .json()
    .catch(() => null);

  if (
    !response.ok ||
    result?.success !== true
  ) {
    throw createApiError(
      result?.message ||
        `Request failed (${response.status})`,
      response.status,
      result?.errors ?? null,
      result?.code ?? null
    );
  }

  return result;
}

// ======================================
// HTTP Request Handler
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
    response = await fetch(
      `${API_URL}${path}`,
      {
        method,

        credentials: "include",

        signal,

        headers: {
          Accept: "application/json",

          ...(body !== undefined
            ? {
                "Content-Type":
                  "application/json",
              }
            : {}),

          ...headers,
        },

        ...(body !== undefined
          ? {
              body: JSON.stringify(body),
            }
          : {}),
      }
    );
  } catch (error) {
    if (
      error?.name === "AbortError"
    ) {
      throw error;
    }

    throw createApiError(
      "Unable to connect to Settings API. Check your network or backend connection."
    );
  }

  return parseResponse(response);
}

// ======================================
// CSRF Token
// ======================================

async function getCsrfToken(signal) {
  const result = await request(
    "/auth/csrf",
    { signal }
  );

  if (
    typeof result.csrfToken !==
      "string" ||
    !result.csrfToken
  ) {
    throw createApiError(
      "CSRF token missing from response."
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
  const csrfToken =
    await getCsrfToken(signal);

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
// Payload Validation
// ======================================

function validateSection(
  data,
  allowedFields,
  sectionName
) {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw createApiError(
      `${sectionName} must be an object.`
    );
  }

  const entries =
    Object.entries(data);

  if (entries.length === 0) {
    throw createApiError(
      `At least one ${sectionName} field is required.`
    );
  }

  const allowed =
    new Set(allowedFields);

  const validated = {};

  for (const [key, value] of entries) {
    if (!allowed.has(key)) {
      throw createApiError(
        `Unsupported ${sectionName} field: ${key}`
      );
    }

    if (
      value === null ||
      value === undefined ||
      ![
        "string",
        "boolean",
      ].includes(typeof value)
    ) {
      throw createApiError(
        `Invalid value for ${key}.`
      );
    }

    validated[key] =
      typeof value === "string"
        ? value.trim()
        : value;
  }

  return validated;
}

// ======================================
// Response Validation
// ======================================

function requireObject(
  result,
  key
) {
  const value = result?.[key];

  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw createApiError(
      `Invalid Settings API response: ${key} is missing.`
    );
  }

  return value;
}

// ======================================
// Settings API
// ======================================

export const settingsApi = {
  // ------------------------------------
  // GET /api/settings
  // ------------------------------------

  async getAll({ signal } = {}) {
    const result = await request(
      "/settings",
      { signal }
    );

    return {
      ...result,
      settings: requireObject(
        result,
        "settings"
      ),
    };
  },

  // ------------------------------------
  // PATCH /api/settings/company
  // ------------------------------------

  async updateCompany(
    data,
    { signal } = {}
  ) {
    const company =
      validateSection(
        data,
        COMPANY_FIELDS,
        "company"
      );

    const result = await mutate(
      "/settings/company",
      "PATCH",
      { company },
      { signal }
    );

    return {
      ...result,
      company: requireObject(
        result,
        "company"
      ),
    };
  },

  // ------------------------------------
  // PATCH /api/settings/preferences
  // ------------------------------------

  async updatePreferences(
    data,
    { signal } = {}
  ) {
    const preferences =
      validateSection(
        data,
        PREFERENCE_FIELDS,
        "preferences"
      );

    const result = await mutate(
      "/settings/preferences",
      "PATCH",
      { preferences },
      { signal }
    );

    return {
      ...result,
      preferences: requireObject(
        result,
        "preferences"
      ),
    };
  },

  // ------------------------------------
  // PATCH /api/settings/notifications
  // ------------------------------------

  async updateNotifications(
    data,
    { signal } = {}
  ) {
    const notifications =
      validateSection(
        data,
        NOTIFICATION_FIELDS,
        "notifications"
      );

    const result = await mutate(
      "/settings/notifications",
      "PATCH",
      { notifications },
      { signal }
    );

    return {
      ...result,
      notifications: requireObject(
        result,
        "notifications"
      ),
    };
  },
};

export default settingsApi;
