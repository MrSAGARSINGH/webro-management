
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Filter,
  CalendarDays,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  ListTodo,
  Phone,
  Pencil,
  Trash2,
  X,
  RotateCcw,
  UserRound,
  Building2,
  Clock3,
} from "lucide-react";
import "./FollowUps.scss";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

const TYPES = ["Call", "WhatsApp", "Email", "Meeting", "Demo", "Other"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const STATUSES = ["Pending", "In Progress", "Completed", "Cancelled"];

const EMPTY_FORM = {
  title: "",
  contactType: "Lead",
  referenceId: "",
  assignedTo: "",
  type: "Call",
  priority: "Medium",
  scheduledAt: "",
  reminderAt: "",
  description: "",
};

const getId = (value) =>
  typeof value === "string" ? value : value?._id || value?.id || "";

const pad = (number) => String(number).padStart(2, "0");

function localDateTime(value = new Date()) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDate(value) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || data?.success !== true) {
    throw new Error(data?.message || `API error (${response.status})`);
  }

  return data;
}

async function apiMutation(path, method, payload) {
  const csrf = await apiRequest("/auth/csrf");

  if (!csrf.csrfToken) {
    throw new Error("CSRF token unavailable. Please log in again.");
  }

  return apiRequest(path, {
    method,
    headers: { "X-CSRF-Token": csrf.csrfToken },
    ...(payload !== undefined
      ? { body: JSON.stringify(payload) }
      : {}),
  });
}

async function fetchAll(path, key) {
  const records = [];
  let page = 1;
  let totalPages = 1;

  do {
    const separator = path.includes("?") ? "&" : "?";
    const result = await apiRequest(
      `${path}${separator}page=${page}&limit=100`
    );

    if (!Array.isArray(result[key])) {
      throw new Error(`Invalid ${key} response from backend.`);
    }

    records.push(...result[key]);
    totalPages = result.pagination?.totalPages ?? 1;
    page += 1;
  } while (page <= totalPages);

  return records;
}

function getBucket(item, now) {
  if (item.status === "Completed") return "Completed";
  if (item.status === "Cancelled") return "Cancelled";

  const scheduled = new Date(item.scheduledAt);
  if (Number.isNaN(scheduled.getTime())) return "Upcoming";

  if (scheduled.getTime() < now.getTime()) return "Overdue";

  if (scheduled.toDateString() === now.toDateString()) {
    return "Today";
  }

  return "Upcoming";
}

function FollowUpModal({
  item,
  contacts,
  employees,
  currentUserId,
  canAssign,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(() =>
    item
      ? {
          title: item.title || "",
          contactType: item.contactType || "Lead",
          referenceId: getId(
            item.contactType === "Client" ? item.client : item.lead
          ),
          assignedTo: getId(item.assignedTo),
          type: item.type || "Call",
          priority: item.priority || "Medium",
          scheduledAt: localDateTime(item.scheduledAt),
          reminderAt: localDateTime(item.reminderAt),
          description: item.description || "",
        }
      : {
          ...EMPTY_FORM,
          scheduledAt: localDateTime(),
          assignedTo: currentUserId,
        }
  );

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const options = contacts[form.contactType] || [];

  const selectedContact = options.find(
    (contact) => getId(contact) === form.referenceId
  );

  useEffect(() => {
    const onEscape = (event) => {
      if (event.key === "Escape" && !saving) onClose();
    };

    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [onClose, saving]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
      ...(name === "contactType" ? { referenceId: "" } : {}),
    }));

    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;

    if (form.title.trim().length < 3) {
      setError("Title must contain at least 3 characters.");
      return;
    }

    if (!selectedContact) {
      setError("Select a valid Lead or Client.");
      return;
    }

    if (!form.assignedTo) {
      setError("Select an employee.");
      return;
    }

    const scheduled = new Date(form.scheduledAt);
    const reminder = form.reminderAt
      ? new Date(form.reminderAt)
      : null;

    if (Number.isNaN(scheduled.getTime())) {
      setError("Enter a valid scheduled date.");
      return;
    }

    if (
      reminder &&
      (Number.isNaN(reminder.getTime()) || reminder > scheduled)
    ) {
      setError("Reminder must be before or at the scheduled time.");
      return;
    }

    const payload = {
      contactType: form.contactType,
      lead: form.contactType === "Lead" ? form.referenceId : null,
      client: form.contactType === "Client" ? form.referenceId : null,
      call: null,
      title: form.title.trim(),
      description: form.description.trim(),
      type: form.type,
      priority: form.priority,
      scheduledAt: scheduled.toISOString(),
      reminderAt: reminder ? reminder.toISOString() : null,
      assignedTo: form.assignedTo,
    };

    try {
      setSaving(true);
      setError("");
      await onSave(payload);
    } catch (err) {
      setError(err.message || "Unable to save follow-up.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="followups__modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        className="followups__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="followup-modal-title"
      >
        <div className="followups__modal-header">
          <div>
            <h2 id="followup-modal-title">
              {item ? "Edit Follow-up" : "Add Follow-up"}
            </h2>
            <p>Schedule and assign the next action.</p>
          </div>

          <button
            type="button"
            className="followups__icon-button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close form"
          >
            <X size={20} />
          </button>
        </div>

        <form className="followups__form" onSubmit={handleSubmit}>
          <div className="followups__form-grid">
            <label className="followups__form-full">
              Follow-up Title *
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                maxLength={200}
                required
                placeholder="Follow up on website proposal"
              />
            </label>

            <label>
              Contact Type *
              <select
                name="contactType"
                value={form.contactType}
                onChange={handleChange}
              >
                <option value="Lead">Lead</option>
                {contacts.Client.length > 0 && (
                  <option value="Client">Client</option>
                )}
              </select>
            </label>

            <label>
              Lead / Client *
              <select
                name="referenceId"
                value={form.referenceId}
                onChange={handleChange}
                required
              >
                <option value="">Select contact</option>
                {options.map((contact) => (
                  <option key={getId(contact)} value={getId(contact)}>
                    {contact.name}
                    {contact.company ? ` — ${contact.company}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Contact Name
              <input value={selectedContact?.name || ""} readOnly />
            </label>

            <label>
              Phone Number
              <input value={selectedContact?.phone || ""} readOnly />
            </label>

            <label>
              Follow-up Type
              <select
                name="type"
                value={form.type}
                onChange={handleChange}
              >
                {TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>

            <label>
              Priority
              <select
                name="priority"
                value={form.priority}
                onChange={handleChange}
              >
                {PRIORITIES.map((priority) => (
                  <option key={priority}>{priority}</option>
                ))}
              </select>
            </label>

            <label>
              Assigned Employee *
              <select
                name="assignedTo"
                value={form.assignedTo}
                onChange={handleChange}
                disabled={!canAssign}
                required
              >
                {!canAssign && currentUserId && (
                  <option value={currentUserId}>Myself</option>
                )}

                {canAssign && (
                  <>
                    <option value="">Select employee</option>
                    {employees.map((employee) => (
                      <option
                        key={getId(employee)}
                        value={getId(employee)}
                      >
                        {employee.name}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </label>

            <label>
              Scheduled Date & Time *
              <input
                type="datetime-local"
                name="scheduledAt"
                value={form.scheduledAt}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              Reminder Date & Time
              <input
                type="datetime-local"
                name="reminderAt"
                value={form.reminderAt}
                onChange={handleChange}
              />
            </label>

            <label className="followups__form-full">
              Description
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={4}
                maxLength={5000}
                placeholder="Discussion details and next steps..."
              />
            </label>
          </div>

          {error && (
            <p className="followups__form-error" role="alert">
              {error}
            </p>
          )}

          <div className="followups__modal-actions">
            <button
              type="button"
              className="followups__button followups__button--secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="followups__button followups__button--primary"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : item
                  ? "Save Changes"
                  : "Create Follow-up"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function FollowUps() {
  const [items, setItems] = useState([]);
  const [contacts, setContacts] = useState({
    Lead: [],
    Client: [],
  });
  const [employees, setEmployees] = useState([]);
  const [role, setRole] = useState("employee");
  const [currentUserId, setCurrentUserId] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  const isManager = ["admin", "manager"].includes(role);

  const refresh = useCallback(() => {
    setRevision((previous) => previous + 1);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingItem(null);
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const [followUps, session] = await Promise.all([
          fetchAll("/follow-ups", "followUps"),
          apiRequest("/auth/me"),
        ]);

        if (!active) return;

        setItems(followUps);
        setRole(session.user?.role || "employee");
        setCurrentUserId(getId(session.user));
      } catch (err) {
        if (active) {
          setError(err.message || "Unable to load follow-ups.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [revision]);

  const stats = useMemo(() => {
    const now = new Date();

    return {
      total: items.length,
      today: items.filter((item) => getBucket(item, now) === "Today")
        .length,
      overdue: items.filter(
        (item) => getBucket(item, now) === "Overdue"
      ).length,
      completed: items.filter(
        (item) => item.status === "Completed"
      ).length,
      pending: items.filter((item) =>
        ["Pending", "In Progress"].includes(item.status)
      ).length,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      const contact =
        item.contactType === "Lead" ? item.lead : item.client;

      const matchesSearch = [
        item.title,
        item.description,
        contact?.name,
        contact?.company,
        contact?.phone,
        item.assignedTo?.name,
      ].some((value) =>
        String(value || "").toLowerCase().includes(query)
      );

      return (
        matchesSearch &&
        (statusFilter === "All" || item.status === statusFilter) &&
        (priorityFilter === "All" ||
          item.priority === priorityFilter)
      );
    });
  }, [items, search, statusFilter, priorityFilter]);

  const openModal = async (item = null) => {
    if (busy) return;

    try {
      setBusy(true);
      setError("");

      const leads = await fetchAll("/leads", "leads");
      const clients = isManager
        ? await fetchAll("/clients", "clients")
        : [];

      const users = isManager
        ? await fetchAll("/users", "users")
        : [];

      const selectedLead = item?.lead;
      const selectedClient = item?.client;

      if (
        selectedLead &&
        typeof selectedLead === "object" &&
        !leads.some((lead) => getId(lead) === getId(selectedLead))
      ) {
        leads.unshift(selectedLead);
      }

      if (
        selectedClient &&
        typeof selectedClient === "object" &&
        !clients.some(
          (client) => getId(client) === getId(selectedClient)
        )
      ) {
        clients.unshift(selectedClient);
      }

      setContacts({ Lead: leads, Client: clients });
      setEmployees(users.filter((user) => user.isActive));
      setEditingItem(item);
      setModalOpen(true);
    } catch (err) {
      setError(err.message || "Unable to open follow-up form.");
    } finally {
      setBusy(false);
    }
  };

  const saveFollowUp = async (payload) => {
    if (editingItem) {
      await apiMutation(
        `/follow-ups/${encodeURIComponent(getId(editingItem))}`,
        "PATCH",
        payload
      );
    } else {
      await apiMutation("/follow-ups", "POST", payload);
    }

    closeModal();
    refresh();
  };

  const changeStatus = async (item, status) => {
    if (busy) return;

    try {
      setBusy(true);
      setError("");

      const payload =
        status === "Completed"
          ? { status, completionNotes: "" }
          : status === "Cancelled"
            ? { status, cancellationReason: "" }
            : { status };

      await apiMutation(
        `/follow-ups/${encodeURIComponent(getId(item))}/status`,
        "PATCH",
        payload
      );

      refresh();
    } catch (err) {
      setError(err.message || "Unable to update status.");
    } finally {
      setBusy(false);
    }
  };

  const deleteFollowUp = async (item) => {
    if (!isManager || busy) return;

    if (!window.confirm(`Delete follow-up "${item.title}"?`)) {
      return;
    }

    try {
      setBusy(true);
      setError("");

      await apiMutation(
        `/follow-ups/${encodeURIComponent(getId(item))}`,
        "DELETE"
      );

      refresh();
    } catch (err) {
      setError(err.message || "Unable to delete follow-up.");
    } finally {
      setBusy(false);
    }
  };

  const statCards = [
    { label: "Total Follow-ups", value: stats.total, Icon: ListTodo },
    { label: "Due Today", value: stats.today, Icon: CalendarDays },
    { label: "Overdue", value: stats.overdue, Icon: AlertTriangle },
    {
      label: "Completed",
      value: stats.completed,
      Icon: CheckCircle2,
    },
    { label: "Pending", value: stats.pending, Icon: CalendarClock },
  ];

  return (
    <div className="followups">
      <div className="followups__header">
        <div>
          <span className="followups__eyebrow">
            SALES OPERATIONS
          </span>
          <h1>Follow-ups Management</h1>
          <p>
            Schedule callbacks, track pending actions and manage
            follow-up progress.
          </p>
        </div>

        <button
          type="button"
          className="followups__button followups__button--primary"
          onClick={() => void openModal()}
          disabled={busy}
        >
          <Plus size={18} />
          Add Follow-up
        </button>
      </div>

      {error && (
        <div className="followups__error" role="alert">
          {error}
        </div>
      )}

      <div className="followups__stats">
        {statCards.map(({ label, value, Icon }) => (
          <div className="followups__stat" key={label}>
            <Icon size={21} />
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <section className="followups__panel">
        <div className="followups__toolbar">
          <div className="followups__search">
            <Search size={18} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search follow-ups, contacts..."
              aria-label="Search follow-ups"
            />
          </div>

          <div className="followups__filters">
            <Filter size={17} />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
            >
              <option value="All">All Statuses</option>
              {STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(event.target.value)
              }
            >
              <option value="All">All Priorities</option>
              {PRIORITIES.map((priority) => (
                <option key={priority}>{priority}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="followups__table-wrap">
          <table className="followups__table">
            <thead>
              <tr>
                <th>Follow-up</th>
                <th>Contact</th>
                <th>Type</th>
                <th>Assigned To</th>
                <th>Scheduled At</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredItems.map((item) => {
                const contact =
                  item.contactType === "Lead"
                    ? item.lead
                    : item.client;

                const bucket = getBucket(item, new Date());

                return (
                  <tr key={getId(item)}>
                    <td>
                      <div className="followups__identity">
                        <strong>{item.title}</strong>
                        <small>{item.description || "No notes"}</small>
                      </div>
                    </td>

                    <td>
                      <div className="followups__contact">
                        <strong>
                          {contact?.name || "Unknown contact"}
                        </strong>
                        <small>
                          <Building2 size={12} />
                          {contact?.company || item.contactType}
                        </small>
                        {contact?.phone && (
                          <a href={`tel:${contact.phone}`}>
                            <Phone size={12} />
                            {contact.phone}
                          </a>
                        )}
                      </div>
                    </td>

                    <td>{item.type}</td>

                    <td>
                      <span className="followups__employee">
                        <UserRound size={14} />
                        {item.assignedTo?.name || "Unassigned"}
                      </span>
                    </td>

                    <td>
                      <span className="followups__date">
                        <Clock3 size={14} />
                        {formatDate(item.scheduledAt)}
                      </span>
                      {bucket === "Overdue" && (
                        <small className="followups__overdue">
                          Overdue
                        </small>
                      )}
                    </td>

                    <td>
                      <span
                        className={`followups__priority followups__priority--${item.priority.toLowerCase()}`}
                      >
                        {item.priority}
                      </span>
                    </td>

                    <td>
                      <select
                        value={item.status}
                        disabled={busy}
                        onChange={(event) =>
                          void changeStatus(item, event.target.value)
                        }
                        aria-label={`Status for ${item.title}`}
                      >
                        {STATUSES.map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </select>
                    </td>

                    <td>
                      <div className="followups__actions">
                        <button
                          type="button"
                          onClick={() => void openModal(item)}
                          disabled={busy}
                          title="Edit follow-up"
                        >
                          <Pencil size={16} />
                        </button>

                        {isManager && (
                          <button
                            type="button"
                            className="followups__delete"
                            onClick={() => void deleteFollowUp(item)}
                            disabled={busy}
                            title="Delete follow-up"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}

                        {item.status === "Completed" && (
                          <button
                            type="button"
                            onClick={() =>
                              void changeStatus(item, "Pending")
                            }
                            disabled={busy}
                            title="Reopen follow-up"
                          >
                            <RotateCcw size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="followups__empty">
                      <ListTodo size={36} />
                      <h3>
                        {loading
                          ? "Loading follow-ups..."
                          : "No follow-ups found"}
                      </h3>
                      <p>
                        {loading
                          ? "Fetching records from backend."
                          : "Add a follow-up or adjust your filters."}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="followups__table-footer">
          Showing {filteredItems.length} of {items.length} follow-ups
        </div>
      </section>

      {modalOpen && (
        <FollowUpModal
          item={editingItem}
          contacts={contacts}
          employees={employees}
          currentUserId={currentUserId}
          canAssign={isManager}
          onClose={closeModal}
          onSave={saveFollowUp}
        />
      )}
    </div>
  );
}
