
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  X,
  Pencil,
  Trash2,
  Phone,
  Mail,
  CalendarDays,
  UsersRound,
  UserCheck,
  Clock3,
  TrendingUp,
  Filter,
  ExternalLink,
} from "lucide-react";

import "./Leads.scss";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

const STATUS_OPTIONS = [
  "New",
  "Contacted",
  "Interested",
  "Follow Up",
  "Qualified",
  "Converted",
  "Lost",
];

const PRIORITY_OPTIONS = ["Low", "Medium", "High", "Urgent"];

const SOURCE_OPTIONS = [
  "Website",
  "Google",
  "Instagram",
  "Facebook",
  "LinkedIn",
  "WhatsApp",
  "Referral",
  "Cold Calling",
  "Other",
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
  source: "Website",
  status: "New",
  priority: "Medium",
  assignedTo: "",
  estimatedValue: "",
  nextFollowUp: "",
  notes: "",
  lostReason: "",
};

const getId = (value) => {
  if (typeof value === "string") return value;
  return value?._id || value?.id || "";
};

const currency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const dateKey = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toISOString().slice(0, 10);
};

const formatDate = (value) => {
  const key = dateKey(value);
  if (!key) return "Not scheduled";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${key}T00:00:00.000Z`));
};

const normalizeLead = (lead) => ({
  ...lead,
  id: getId(lead),
  company: lead.company || "",
  assignedTo: getId(lead.assignedTo),
  assignedName:
    typeof lead.assignedTo === "object"
      ? lead.assignedTo?.name || ""
      : "",
  nextFollowUp: dateKey(lead.nextFollowUp),
  estimatedValue: Number(lead.estimatedValue) || 0,
});

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || result?.success !== true) {
    const message =
      result?.message ||
      `API request failed with status ${response.status}`;

    throw new Error(message);
  }

  return result;
}

async function mutate(path, method, payload) {
  const csrfResponse = await apiRequest("/auth/csrf");

  if (!csrfResponse.csrfToken) {
    throw new Error("CSRF token unavailable. Please log in again.");
  }

  return apiRequest(path, {
    method,
    headers: {
      "X-CSRF-Token": csrfResponse.csrfToken,
    },
    ...(payload !== undefined
      ? { body: JSON.stringify(payload) }
      : {}),
  });
}

async function loadAllLeads(signal) {
  const leads = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await apiRequest(
      `/leads?page=${page}&limit=100`,
      { signal }
    );

    leads.push(...(result.leads || []));
    totalPages = result.pagination?.totalPages || 1;
    page += 1;
  } while (page <= totalPages);

  return leads.map(normalizeLead);
}

async function loadAssignableUsers() {
  const users = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await apiRequest(
      `/users?page=${page}&limit=100`
    );

    users.push(...(result.users || []));
    totalPages = result.pagination?.totalPages || 1;
    page += 1;
  } while (page <= totalPages);

  return users.filter((user) => user.isActive);
}

function LeadModal({
  lead,
  users,
  canAssign,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(() =>
    lead
      ? {
          ...EMPTY_FORM,
          ...lead,
          estimatedValue: String(lead.estimatedValue ?? 0),
        }
      : { ...EMPTY_FORM }
  );

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !saving) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, saving]);

  const update = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
      ...(name === "status" && value !== "Lost"
        ? { lostReason: "" }
        : {}),
    }));

    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;

    const name = form.name.trim();
    const phone = form.phone.trim();
    const email = form.email.trim().toLowerCase();
    const estimatedValue = Number(form.estimatedValue || 0);

    if (name.length < 2) {
      setError("Lead name must contain at least 2 characters.");
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }

    if (
      !Number.isFinite(estimatedValue) ||
      estimatedValue < 0 ||
      estimatedValue > 999999999999
    ) {
      setError("Enter a valid estimated value.");
      return;
    }

    if (form.status === "Converted") {
      setError("Lead conversion requires the conversion workflow.");
      return;
    }

    const payload = {
      name,
      company: form.company.trim(),
      phone,
      email,
      service: form.service,
      source: form.source,
      status: form.status,
      priority: form.priority,
      estimatedValue,
      nextFollowUp: form.nextFollowUp || null,
      notes: form.notes.trim(),
      lostReason:
        form.status === "Lost" ? form.lostReason.trim() : "",
    };

    if (canAssign) {
      payload.assignedTo = form.assignedTo || null;
    }

    try {
      setSaving(true);
      setError("");
      await onSave(payload);
    } catch (err) {
      setError(err.message || "Unable to save lead.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="leads__modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <section
        className="leads__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-modal-title"
      >
        <div className="leads__modal-header">
          <div>
            <h2 id="lead-modal-title">
              {lead ? "Edit Lead" : "Add New Lead"}
            </h2>
            <p>Manage client enquiry information</p>
          </div>

          <button
            type="button"
            className="leads__icon-button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close form"
          >
            <X size={19} />
          </button>
        </div>

        <form onSubmit={submit} className="leads__form">
          <div className="leads__form-grid">
            <label>
              Lead Name <span>*</span>
              <input
                name="name"
                value={form.name}
                onChange={update}
                placeholder="Client name"
                required
                maxLength={100}
              />
            </label>

            <label>
              Business Name
              <input
                name="company"
                value={form.company}
                onChange={update}
                placeholder="Company or business"
                maxLength={150}
              />
            </label>

            <label>
              Phone Number <span>*</span>
              <input
                name="phone"
                type="tel"
                value={form.phone}
                onChange={update}
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
                onChange={update}
                placeholder="client@example.com"
                maxLength={254}
              />
            </label>

            <label>
              Required Service <span>*</span>
              <select
                name="service"
                value={form.service}
                onChange={update}
                required
              >
                {SERVICE_OPTIONS.map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Lead Source
              <select
                name="source"
                value={form.source}
                onChange={update}
              >
                {SOURCE_OPTIONS.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Lead Status
              <select
                name="status"
                value={form.status}
                onChange={update}
              >
                {STATUS_OPTIONS.filter(
                  (status) => status !== "Converted"
                ).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Priority
              <select
                name="priority"
                value={form.priority}
                onChange={update}
              >
                {PRIORITY_OPTIONS.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </label>

            {canAssign && (
              <label>
                Assigned Employee
                <select
                  name="assignedTo"
                  value={form.assignedTo}
                  onChange={update}
                >
                  <option value="">Unassigned</option>

                  {form.assignedTo &&
                    !users.some(
                      (user) => getId(user) === form.assignedTo
                    ) && (
                      <option value={form.assignedTo}>
                        {form.assignedName || "Current assignment"}
                      </option>
                    )}

                  {users.map((user) => (
                    <option key={getId(user)} value={getId(user)}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label>
              Estimated Value (₹)
              <input
                name="estimatedValue"
                type="number"
                min="0"
                max="999999999999"
                step="1"
                value={form.estimatedValue}
                onChange={update}
                placeholder="25000"
              />
            </label>

            <label>
              Next Follow-up
              <input
                name="nextFollowUp"
                type="date"
                value={form.nextFollowUp}
                onChange={update}
              />
            </label>

            {form.status === "Lost" && (
              <label className="leads__form-full">
                Lost Reason
                <textarea
                  name="lostReason"
                  value={form.lostReason}
                  onChange={update}
                  rows={2}
                  maxLength={1000}
                />
              </label>
            )}

            <label className="leads__form-full">
              Notes
              <textarea
                name="notes"
                value={form.notes}
                onChange={update}
                placeholder="Discussion details, requirements..."
                rows={4}
                maxLength={5000}
              />
            </label>
          </div>

          {error && (
            <p className="leads__form-error" role="alert">
              {error}
            </p>
          )}

          <div className="leads__modal-actions">
            <button
              type="button"
              className="leads__button leads__button--secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="leads__button leads__button--primary"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : lead
                  ? "Save Changes"
                  : "Create Lead"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);

  const [canAssign, setCanAssign] = useState(false);
  const [canDelete, setCanDelete] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshLeads = useCallback(() => {
    setRefreshKey((previous) => previous + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const [leadData, session] = await Promise.all([
          loadAllLeads(controller.signal),
          apiRequest("/auth/me", {
            signal: controller.signal,
          }),
        ]);

        if (controller.signal.aborted) return;

        const isManager = ["admin", "manager"].includes(
          session.user?.role
        );

        setLeads(leadData);
        setCanAssign(isManager);
        setCanDelete(isManager);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message || "Unable to load leads.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => controller.abort();
  }, [refreshKey]);

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();

    return leads.filter((lead) => {
      const matchesSearch = [
        lead.name,
        lead.company,
        lead.phone,
        lead.email,
        lead.service,
        lead.assignedName,
      ].some((value) =>
        String(value ?? "").toLowerCase().includes(query)
      );

      return (
        matchesSearch &&
        (statusFilter === "All" || lead.status === statusFilter) &&
        (priorityFilter === "All" || lead.priority === priorityFilter)
      );
    });
  }, [leads, search, statusFilter, priorityFilter]);

  const stats = useMemo(() => ({
    total: leads.length,
    new: leads.filter((lead) => lead.status === "New").length,
    active: leads.filter((lead) =>
      ["Interested", "Follow Up", "Qualified"].includes(lead.status)
    ).length,
    converted: leads.filter(
      (lead) => lead.status === "Converted"
    ).length,
    pipeline: leads
      .filter(
        (lead) => !["Converted", "Lost"].includes(lead.status)
      )
      .reduce(
        (total, lead) => total + lead.estimatedValue,
        0
      ),
  }), [leads]);

  const openModal = async (lead = null) => {
    if (busy) return;

    try {
      setBusy(true);
      setError("");

      if (canAssign) {
        const result = await loadAssignableUsers();
        setUsers(result);
      }

      setEditingLead(lead);
      setModalOpen(true);
    } catch (err) {
      setError(err.message || "Unable to open lead form.");
    } finally {
      setBusy(false);
    }
  };

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingLead(null);
  }, []);

  const saveLead = async (payload) => {
    if (editingLead) {
      await mutate(
        `/leads/${encodeURIComponent(editingLead.id)}`,
        "PATCH",
        payload
      );
    } else {
      await mutate("/leads", "POST", payload);
    }

    closeModal();
    refreshLeads();
  };

  const deleteLead = async (lead) => {
    if (
      !canDelete ||
      lead.status === "Converted" ||
      !window.confirm(`Delete lead "${lead.name}"?`)
    ) {
      return;
    }

    try {
      setBusy(true);
      setError("");

      await mutate(
        `/leads/${encodeURIComponent(lead.id)}`,
        "DELETE"
      );

      refreshLeads();
    } catch (err) {
      setError(err.message || "Unable to delete lead.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="leads">
      <div className="leads__header">
        <div>
          <span className="leads__eyebrow">
            SALES MANAGEMENT
          </span>

          <h1>Leads Management</h1>

          <p>
            Track enquiries, assign follow-ups and manage prospects.
          </p>
        </div>

        <button
          type="button"
          className="leads__button leads__button--primary"
          onClick={() => void openModal()}
          disabled={busy}
        >
          <Plus size={18} />
          Add New Lead
        </button>
      </div>

      {error && (
        <div className="leads__error" role="alert">
          {error}
        </div>
      )}

      <div className="leads__stats">
        {[
          { label: "Total Leads", value: stats.total, Icon: UsersRound },
          { label: "New Leads", value: stats.new, Icon: Clock3 },
          { label: "Active Opportunities", value: stats.active, Icon: TrendingUp },
          { label: "Converted Leads", value: stats.converted, Icon: UserCheck },
          { label: "Open Pipeline Value", value: currency(stats.pipeline), Icon: TrendingUp },
        ].map(({ label, value, Icon }) => (
          <div className="leads__stat" key={label}>
            <Icon size={21} />
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <section className="leads__panel">
        <div className="leads__toolbar">
          <div className="leads__search">
            <Search size={18} />

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, business, phone..."
              aria-label="Search leads"
            />
          </div>

          <div className="leads__filters">
            <Filter size={17} />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by status"
            >
              <option value="All">All Statuses</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
              aria-label="Filter by priority"
            >
              <option value="All">All Priorities</option>
              {PRIORITY_OPTIONS.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="leads__table-wrap">
          <table className="leads__table">
            <thead>
              <tr>
                <th>Lead / Business</th>
                <th>Contact</th>
                <th>Service</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Assigned To</th>
                <th>Value</th>
                <th>Next Follow-up</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredLeads.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <div className="leads__identity">
                      <span className="leads__avatar">
                        {lead.name?.charAt(0)?.toUpperCase() || "L"}
                      </span>

                      <div>
                        <strong>{lead.name}</strong>
                        <small>{lead.company || "Individual"}</small>
                      </div>
                    </div>
                  </td>

                  <td>
                    <div className="leads__contact">
                      <a href={`tel:${lead.phone}`}>
                        <Phone size={13} />
                        {lead.phone}
                      </a>

                      {lead.email && (
                        <a href={`mailto:${lead.email}`}>
                          <Mail size={13} />
                          {lead.email}
                        </a>
                      )}
                    </div>
                  </td>

                  <td>{lead.service || "—"}</td>

                  <td>
                    <span
                      className={`leads__badge leads__badge--${lead.status
                        .toLowerCase()
                        .replace(/\s+/g, "-")}`}
                    >
                      {lead.status}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`leads__priority leads__priority--${lead.priority.toLowerCase()}`}
                    >
                      {lead.priority}
                    </span>
                  </td>

                  <td>{lead.assignedName || "Unassigned"}</td>

                  <td className="leads__amount">
                    {currency(lead.estimatedValue)}
                  </td>

                  <td>
                    <span className="leads__date">
                      <CalendarDays size={14} />
                      {formatDate(lead.nextFollowUp)}
                    </span>
                  </td>

                  <td>
                    <div className="leads__actions">
                      {lead.status !== "Converted" && (
                        <button
                          type="button"
                          onClick={() => void openModal(lead)}
                          disabled={busy}
                          title="Edit lead"
                          aria-label={`Edit ${lead.name}`}
                        >
                          <Pencil size={16} />
                        </button>
                      )}

                      {canDelete && lead.status !== "Converted" && (
                        <button
                          type="button"
                          className="leads__delete"
                          onClick={() => void deleteLead(lead)}
                          disabled={busy}
                          title="Delete lead"
                          aria-label={`Delete ${lead.name}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}

                      <a
                        href={`tel:${lead.phone}`}
                        title="Call lead"
                        aria-label={`Call ${lead.name}`}
                      >
                        <ExternalLink size={16} />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredLeads.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <div className="leads__empty">
                      <UsersRound size={35} />

                      <h3>
                        {loading ? "Loading leads..." : "No leads found"}
                      </h3>

                      <p>
                        {loading
                          ? "Fetching leads from the backend."
                          : leads.length === 0
                            ? "Add your first lead to get started."
                            : "Try changing your search or filters."}
                      </p>

                      {!loading && leads.length === 0 && (
                        <button
                          type="button"
                          className="leads__button leads__button--primary"
                          onClick={() => void openModal()}
                          disabled={busy}
                        >
                          <Plus size={16} />
                          Add Lead
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="leads__table-footer">
          Showing {filteredLeads.length} of {leads.length} leads
        </div>
      </section>

      {modalOpen && (
        <LeadModal
          lead={editingLead}
          users={users}
          canAssign={canAssign}
          onClose={closeModal}
          onSave={saveLead}
        />
      )}
    </div>
  );
}
