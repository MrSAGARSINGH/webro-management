
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  UsersRound,
  UserCheck,
  Wallet,
  IndianRupee,
  Pencil,
  Trash2,
  X,
  Phone,
  Mail,
  Building2,
  ExternalLink,
  Filter,
} from "lucide-react";

import "./Clients.scss";

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api"
).replace(/\/+$/, "");

const STATUS_OPTIONS = [
  "Active",
  "On Hold",
  "Completed",
  "Inactive",
];

const SERVICE_OPTIONS = [
  "Website Development",
  "E-commerce Development",
  "Web Application",
  "SEO",
  "Website Maintenance",
  "Branding",
  "Other",
];

const EMPTY_FORM = {
  name: "",
  company: "",
  phone: "",
  email: "",
  service: "Website Development",
  status: "Active",
  projectName: "",
  contractAmount: "",
  receivedAmount: "",
  startDate: "",
  deadline: "",
  assignedTo: null,
  notes: "",
};

const PAGE_SIZE = 10;

const currency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const getId = (value) => {
  if (typeof value === "string") return value;
  return value?._id || value?.id || "";
};

const getDate = (value) => {
  if (!value) return "";
  return String(value).slice(0, 10);
};

const getEmployeeName = (value) => {
  if (!value) return "Unassigned";

  if (typeof value === "object") {
    return value.name || "Unassigned";
  }

  return "Assigned";
};

const getErrorMessage = (error) =>
  error instanceof Error
    ? error.message
    : "Something went wrong.";

class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function apiRequest(
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

    throw new ApiError(
      "Cannot connect to backend. Check server and API URL."
    );
  }

  const data = await response.json().catch(() => null);

  if (!response.ok || data?.success !== true) {
    throw new ApiError(
      data?.message ||
        `Request failed (${response.status})`,
      response.status
    );
  }

  return data;
}

async function apiMutation(path, method, payload) {
  const csrfResponse = await apiRequest("/auth/csrf");

  const csrfToken = csrfResponse.csrfToken;

  if (
    typeof csrfToken !== "string" ||
    !csrfToken
  ) {
    throw new ApiError(
      "CSRF token unavailable. Please log in again."
    );
  }

  return apiRequest(path, {
    method,
    headers: {
      "X-CSRF-Token": csrfToken,
    },
    ...(payload !== undefined
      ? { body: payload }
      : {}),
  });
}

const clientApi = {
  list(params = {}, signal) {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        query.set(key, String(value));
      }
    });

    const suffix = query.toString();

    return apiRequest(
      `/clients${suffix ? `?${suffix}` : ""}`,
      { signal }
    );
  },

  stats(signal) {
    return apiRequest("/clients/stats", {
      signal,
    });
  },

  create(payload) {
    return apiMutation(
      "/clients",
      "POST",
      payload
    );
  },

  update(id, payload) {
    return apiMutation(
      `/clients/${encodeURIComponent(id)}`,
      "PATCH",
      payload
    );
  },

  remove(id) {
    return apiMutation(
      `/clients/${encodeURIComponent(id)}`,
      "DELETE"
    );
  },
};

function ClientModal({
  client,
  onClose,
  onSave,
  saving,
}) {
  const [form, setForm] = useState(() =>
    client
      ? {
          ...EMPTY_FORM,
          ...client,
          assignedTo: getId(client.assignedTo) || null,
          startDate: getDate(client.startDate),
          deadline: getDate(client.deadline),
          contractAmount: String(
            client.contractAmount ?? 0
          ),
          receivedAmount: String(
            client.receivedAmount ?? 0
          ),
        }
      : { ...EMPTY_FORM }
  );

  const [error, setError] = useState("");

  useEffect(() => {
    const onEscape = (event) => {
      if (event.key === "Escape" && !saving) {
        onClose();
      }
    };

    document.addEventListener(
      "keydown",
      onEscape
    );

    return () => {
      document.removeEventListener(
        "keydown",
        onEscape
      );
    };
  }, [onClose, saving]);

  const change = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();

    if (saving) return;

    const name = form.name.trim();
    const company = form.company.trim();
    const phone = form.phone.trim();
    const email = form.email.trim().toLowerCase();

    const contractAmount = Number(
      form.contractAmount || 0
    );

    const receivedAmount = Number(
      form.receivedAmount || 0
    );

    if (name.length < 2) {
      setError(
        "Client name must contain at least 2 characters."
      );
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError(
        "Enter a valid 10-digit Indian mobile number."
      );
      return;
    }

    if (
      email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      setError("Enter a valid email address.");
      return;
    }

    if (
      !Number.isFinite(contractAmount) ||
      !Number.isFinite(receivedAmount) ||
      contractAmount < 0 ||
      receivedAmount < 0 ||
      contractAmount > 999999999999 ||
      receivedAmount > 999999999999
    ) {
      setError("Enter valid payment amounts.");
      return;
    }

    if (
      Math.abs(
        contractAmount * 100 -
          Math.round(contractAmount * 100)
      ) > 0.00001 ||
      Math.abs(
        receivedAmount * 100 -
          Math.round(receivedAmount * 100)
      ) > 0.00001
    ) {
      setError(
        "Payment amounts can have at most two decimal places."
      );
      return;
    }

    if (receivedAmount > contractAmount) {
      setError(
        "Received amount cannot exceed contract amount."
      );
      return;
    }

    if (
      form.startDate &&
      form.deadline &&
      form.deadline < form.startDate
    ) {
      setError(
        "Deadline cannot be earlier than start date."
      );
      return;
    }

    const payload = {
      name,
      company,
      phone,
      email,
      service: form.service,
      status: form.status,
      projectName: form.projectName.trim(),
      contractAmount,
      receivedAmount,
      startDate: form.startDate || null,
      deadline: form.deadline || null,
      assignedTo: form.assignedTo || null,
      notes: form.notes.trim(),
    };

    try {
      setError("");
      await onSave(payload);
    } catch (error) {
      setError(getErrorMessage(error));
    }
  };

  return (
    <div
      className="clients__modal-backdrop"
      onMouseDown={(event) => {
        if (
          !saving &&
          event.target === event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <section
        className="clients__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-modal-title"
      >
        <div className="clients__modal-header">
          <div>
            <h2 id="client-modal-title">
              {client
                ? "Edit Client"
                : "Add New Client"}
            </h2>

            <p>
              Manage client and project information
            </p>
          </div>

          <button
            type="button"
            className="clients__icon-button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close form"
          >
            <X size={20} />
          </button>
        </div>

        <form
          className="clients__form"
          onSubmit={submit}
        >
          <div className="clients__form-grid">
            <label>
              Client Name *
              <input
                name="name"
                value={form.name}
                onChange={change}
                placeholder="Client full name"
                maxLength={100}
                required
              />
            </label>

            <label>
              Company / Business
              <input
                name="company"
                value={form.company}
                onChange={change}
                placeholder="Business name"
                maxLength={150}
              />
            </label>

            <label>
              Phone Number *
              <input
                name="phone"
                type="tel"
                inputMode="numeric"
                value={form.phone}
                onChange={change}
                placeholder="9876543210"
                maxLength={10}
                required
              />
            </label>

            <label>
              Email Address
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={change}
                placeholder="client@example.com"
                maxLength={254}
              />
            </label>

            <label>
              Service
              <select
                name="service"
                value={form.service}
                onChange={change}
              >
                {SERVICE_OPTIONS.map((service) => (
                  <option
                    key={service}
                    value={service}
                  >
                    {service}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Client Status
              <select
                name="status"
                value={form.status}
                onChange={change}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Project Name
              <input
                name="projectName"
                value={form.projectName}
                onChange={change}
                placeholder="Restaurant Website"
                maxLength={200}
              />
            </label>

            <label>
              Assigned Employee
              <input
                value={
                  client
                    ? getEmployeeName(
                        client.assignedTo
                      )
                    : "Unassigned"
                }
                readOnly
                disabled
                title="Assignment is read-only on this page."
              />
            </label>

            <label>
              Contract Amount (₹)
              <input
                name="contractAmount"
                type="number"
                min="0"
                max="999999999999"
                step="0.01"
                value={form.contractAmount}
                onChange={change}
                placeholder="30000"
              />
            </label>

            <label>
              Received Amount (₹)
              <input
                name="receivedAmount"
                type="number"
                min="0"
                max="999999999999"
                step="0.01"
                value={form.receivedAmount}
                onChange={change}
                placeholder="15000"
              />
            </label>

            <label>
              Project Start Date
              <input
                name="startDate"
                type="date"
                value={form.startDate}
                onChange={change}
              />
            </label>

            <label>
              Project Deadline
              <input
                name="deadline"
                type="date"
                value={form.deadline}
                onChange={change}
              />
            </label>

            <label className="clients__form-full">
              Notes
              <textarea
                name="notes"
                value={form.notes}
                onChange={change}
                placeholder="Requirements, payment terms..."
                rows={4}
                maxLength={5000}
              />
            </label>
          </div>

          {error && (
            <p
              className="clients__form-error"
              role="alert"
            >
              {error}
            </p>
          )}

          <div className="clients__modal-actions">
            <button
              type="button"
              className="clients__button clients__button--secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="clients__button clients__button--primary"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : client
                  ? "Save Changes"
                  : "Create Client"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function Clients({ user }) {
  const canManageClients =
    user?.role === "admin" ||
    user?.role === "manager";

  const canDeleteClients =
    user?.role === "admin";

  const [clients, setClients] = useState([]);

  const [stats, setStats] = useState({
    totalClients: 0,
    activeClients: 0,
    totalContractAmount: 0,
    totalReceivedAmount: 0,
    totalPendingAmount: 0,
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("All");

  const [page, setPage] = useState(1);

  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 0,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] =
    useState("");

  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] =
    useState(false);

  const [editingClient, setEditingClient] =
    useState(null);

  const [refreshKey, setRefreshKey] =
    useState(0);

  const refreshClients = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!canManageClients) {
      setClients([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const params = {
          page,
          limit: PAGE_SIZE,
          search: search.trim(),
        };

        if (statusFilter !== "All") {
          params.status = statusFilter;
        }

        const response = await clientApi.list(
          params,
          controller.signal
        );

        if (controller.signal.aborted) return;

        setClients(response.clients || []);

        setPagination(
          response.pagination || {
            total: 0,
            totalPages: 0,
          }
        );
      } catch (error) {
        if (
          !controller.signal.aborted &&
          error?.name !== "AbortError"
        ) {
          setError(getErrorMessage(error));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      controller.abort();
    };
  }, [
    page,
    search,
    statusFilter,
    refreshKey,
    canManageClients,
  ]);

  useEffect(() => {
    if (!canManageClients) return;

    const controller = new AbortController();

    const load = async () => {
      try {
        const response = await clientApi.stats(
          controller.signal
        );

        if (!controller.signal.aborted) {
          setStats(response.stats);
        }
      } catch (error) {
        if (
          !controller.signal.aborted &&
          error?.name !== "AbortError"
        ) {
          setError(getErrorMessage(error));
        }
      }
    };

    void load();

    return () => {
      controller.abort();
    };
  }, [refreshKey, canManageClients]);

  const cards = useMemo(
    () => [
      {
        label: "Total Clients",
        value: stats.totalClients,
        icon: UsersRound,
      },
      {
        label: "Active Clients",
        value: stats.activeClients,
        icon: UserCheck,
      },
      {
        label: "Contract Value",
        value: currency(
          stats.totalContractAmount
        ),
        icon: IndianRupee,
      },
      {
        label: "Payments Received",
        value: currency(
          stats.totalReceivedAmount
        ),
        icon: Wallet,
      },
      {
        label: "Pending Payments",
        value: currency(
          stats.totalPendingAmount
        ),
        icon: IndianRupee,
      },
    ],
    [stats]
  );

  const openAdd = () => {
    if (!canManageClients || saving) return;

    setEditingClient(null);
    setModalOpen(true);
  };

  const openEdit = (client) => {
    if (!canManageClients || saving) return;

    setEditingClient(client);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setEditingClient(null);
  };

  const saveClient = async (payload) => {
    if (!canManageClients) {
      throw new Error(
        "Admin or Manager access required."
      );
    }

    setSaving(true);

    try {
      if (editingClient) {
        await clientApi.update(
          getId(editingClient),
          payload
        );
      } else {
        await clientApi.create(payload);
      }

      setModalOpen(false);
      setEditingClient(null);
      setError("");

      refreshClients();
    } catch (error) {
      setError(getErrorMessage(error));
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const deleteClient = async (client) => {
    if (
      !canDeleteClients ||
      deletingId ||
      saving
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Delete client "${client.name}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    const id = getId(client);

    try {
      setDeletingId(id);
      setError("");

      await clientApi.remove(id);

      if (
        clients.length === 1 &&
        page > 1
      ) {
        setPage((previous) => previous - 1);
      } else {
        refreshClients();
      }
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setDeletingId("");
    }
  };

  if (!canManageClients) {
    return (
      <div className="clients">
        <div className="clients__header">
          <div>
            <span className="clients__eyebrow">
              BUSINESS MANAGEMENT
            </span>

            <h1>Clients Management</h1>

            <p>
              You do not have permission to
              access client records.
            </p>
          </div>
        </div>

        <div
          className="clients__error"
          role="alert"
        >
          Admin or Manager access required.
        </div>
      </div>
    );
  }

  return (
    <div className="clients">
      <div className="clients__header">
        <div>
          <span className="clients__eyebrow">
            BUSINESS MANAGEMENT
          </span>

          <h1>Clients Management</h1>

          <p>
            Manage client information, projects,
            contracts, and payment balances.
          </p>
        </div>

        <button
          type="button"
          className="clients__button clients__button--primary"
          onClick={openAdd}
          disabled={saving || Boolean(deletingId)}
        >
          <Plus size={18} />
          Add New Client
        </button>
      </div>

      {error && (
        <div
          className="clients__error"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="clients__stats">
        {cards.map(
          ({ label, value, icon: Icon }) => (
            <div
              className="clients__stat"
              key={label}
            >
              <Icon size={21} />
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          )
        )}
      </div>

      <section className="clients__panel">
        <div className="clients__toolbar">
          <div className="clients__search">
            <Search size={18} />

            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search clients, businesses, projects..."
              aria-label="Search clients"
            />
          </div>

          <div className="clients__filters">
            <Filter size={17} />

            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(
                  event.target.value
                );
                setPage(1);
              }}
              aria-label="Filter clients by status"
            >
              <option value="All">
                All Statuses
              </option>

              {STATUS_OPTIONS.map((status) => (
                <option
                  key={status}
                  value={status}
                >
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="clients__table-wrap">
          <table className="clients__table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Contact</th>
                <th>Project</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>Contract</th>
                <th>Received</th>
                <th>Pending</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {!loading &&
                clients.map((client) => {
                  const pending = Math.max(
                    0,
                    Number(
                      client.contractAmount || 0
                    ) -
                      Number(
                        client.receivedAmount || 0
                      )
                  );

                  return (
                    <tr key={getId(client)}>
                      <td>
                        <div className="clients__identity">
                          <span className="clients__avatar">
                            {client.name
                              ?.charAt(0)
                              ?.toUpperCase() || "C"}
                          </span>

                          <div>
                            <strong>
                              {client.name}
                            </strong>

                            <small>
                              <Building2 size={12} />
                              {client.company ||
                                "Individual"}
                            </small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="clients__contact">
                          <a
                            href={`tel:${client.phone}`}
                          >
                            <Phone size={13} />
                            {client.phone}
                          </a>

                          {client.email && (
                            <a
                              href={`mailto:${client.email}`}
                            >
                              <Mail size={13} />
                              {client.email}
                            </a>
                          )}
                        </div>
                      </td>

                      <td>
                        <div className="clients__project">
                          <strong>
                            {client.projectName ||
                              "Not assigned"}
                          </strong>

                          <small>
                            {client.service}
                          </small>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`clients__badge clients__badge--${String(
                            client.status || "Active"
                          )
                            .toLowerCase()
                            .replace(/\s+/g, "-")}`}
                        >
                          {client.status}
                        </span>
                      </td>

                      <td>
                        {getEmployeeName(
                          client.assignedTo
                        )}
                      </td>

                      <td className="clients__amount">
                        {currency(
                          client.contractAmount
                        )}
                      </td>

                      <td className="clients__amount clients__amount--received">
                        {currency(
                          client.receivedAmount
                        )}
                      </td>

                      <td className="clients__amount clients__amount--pending">
                        {currency(pending)}
                      </td>

                      <td>
                        <div className="clients__actions">
                          <button
                            type="button"
                            onClick={() =>
                              openEdit(client)
                            }
                            title="Edit client"
                            aria-label={`Edit ${client.name}`}
                            disabled={
                              saving ||
                              Boolean(deletingId)
                            }
                          >
                            <Pencil size={16} />
                          </button>

                          {canDeleteClients && (
                            <button
                              type="button"
                              className="clients__delete"
                              onClick={() =>
                                void deleteClient(
                                  client
                                )
                              }
                              title="Delete client"
                              aria-label={`Delete ${client.name}`}
                              disabled={
                                saving ||
                                Boolean(deletingId)
                              }
                            >
                              <Trash2 size={16} />
                            </button>
                          )}

                          <a
                            href={`tel:${client.phone}`}
                            title="Call client"
                            aria-label={`Call ${client.name}`}
                          >
                            <ExternalLink size={16} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}

              {!loading &&
                clients.length === 0 && (
                  <tr>
                    <td colSpan={9}>
                      <div className="clients__empty">
                        <UsersRound size={35} />

                        <h3>
                          No clients found
                        </h3>

                        <p>
                          Add your first client
                          to get started.
                        </p>

                        <button
                          type="button"
                          className="clients__button clients__button--primary"
                          onClick={openAdd}
                        >
                          <Plus size={16} />
                          Add Client
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

              {loading && (
                <tr>
                  <td colSpan={9}>
                    <div className="clients__empty">
                      Loading clients...
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="clients__table-footer">
          <span>
            Showing {clients.length} of{" "}
            {pagination.total} clients
          </span>

          <div className="clients__modal-actions">
            <button
              type="button"
              className="clients__button clients__button--secondary"
              disabled={
                page <= 1 || loading
              }
              onClick={() =>
                setPage((previous) =>
                  previous - 1
                )
              }
            >
              Previous
            </button>

            <span>
              Page {page} of{" "}
              {Math.max(
                1,
                pagination.totalPages
              )}
            </span>

            <button
              type="button"
              className="clients__button clients__button--secondary"
              disabled={
                loading ||
                page >=
                  pagination.totalPages
              }
              onClick={() =>
                setPage((previous) =>
                  previous + 1
                )
              }
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {modalOpen && (
        <ClientModal
          client={editingClient}
          onClose={closeModal}
          onSave={saveClient}
          saving={saving}
        />
      )}
    </div>
  );
}
