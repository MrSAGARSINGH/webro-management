
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Phone,
  PhoneCall,
  PhoneMissed,
  CalendarClock,
  UsersRound,
  Plus,
  Search,
  Filter,
  Pencil,
  Trash2,
  X,
  Clock3,
  UserRound,
  Building2,
  History,
  ExternalLink,
} from "lucide-react";

import "./Calling.scss";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

const STATUSES = [
  "Completed",
  "No Answer",
  "Busy",
  "Failed",
  "Cancelled",
];

const OUTCOMES = [
  "Interested",
  "Not Interested",
  "Callback Requested",
  "Follow Up Required",
  "Meeting Scheduled",
  "Converted",
  "No Response",
  "Other",
];

const EMPTY_FORM = {
  contactType: "Lead",
  referenceId: "",
  direction: "Outgoing",
  status: "Completed",
  outcome: "Other",
  durationSeconds: "0",
  calledAt: "",
  nextFollowUp: "",
  notes: "",
};

const getId = (value) => {
  if (typeof value === "string") return value;
  return value?._id || value?.id || "";
};

const pad = (value) => String(value).padStart(2, "0");

function toLocalInputValue(value = new Date()) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
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

function getBadgeClass(value) {
  return String(value || "other")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

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
    const details = Array.isArray(result?.errors)
      ? result.errors
          .map((item) => item.message)
          .filter(Boolean)
          .join("; ")
      : "";

    throw new Error(
      details ||
        result?.message ||
        `Request failed (${response.status})`
    );
  }

  return result;
}

async function apiMutation(path, method, payload) {
  const csrfResponse = await apiRequest("/auth/csrf");

  if (!csrfResponse.csrfToken) {
    throw new Error(
      "CSRF token unavailable. Please log in again."
    );
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

async function getAllRecords(path, key, signal) {
  const records = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await apiRequest(
      `${path}${path.includes("?") ? "&" : "?"}page=${page}&limit=100`,
      { signal }
    );

    if (!Array.isArray(result[key])) {
      throw new Error(`Invalid ${key} API response.`);
    }

    records.push(...result[key]);

    totalPages = result.pagination?.totalPages ?? 1;
    page += 1;
  } while (page <= totalPages);

  return records;
}

function CallModal({
  call,
  contacts,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(() => {
    if (!call) {
      return {
        ...EMPTY_FORM,
        calledAt: toLocalInputValue(),
      };
    }

    return {
      contactType: call.contactType || "Lead",
      referenceId: getId(
        call.contactType === "Client"
          ? call.client
          : call.lead
      ),
      direction: call.direction || "Outgoing",
      status: call.status || "Completed",
      outcome: call.outcome || "Other",
      durationSeconds: String(call.durationSeconds ?? 0),
      calledAt: toLocalInputValue(call.calledAt),
      nextFollowUp: toLocalInputValue(call.nextFollowUp),
      notes: call.notes || "",
    };
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const availableContacts =
    contacts[form.contactType] || [];

  const selectedContact = availableContacts.find(
    (contact) => getId(contact) === form.referenceId
  );

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
      ...(name === "contactType"
        ? { referenceId: "" }
        : {}),
      ...(name === "status" && value !== "Completed"
        ? {
            durationSeconds: "0",
            outcome: "No Response",
          }
        : {}),
    }));

    setError("");
  };

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape" && !saving) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose, saving]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saving) return;

    if (!selectedContact) {
      setError("Please select a valid Lead or Client.");
      return;
    }

    const durationSeconds = Number(form.durationSeconds);

    if (
      !Number.isInteger(durationSeconds) ||
      durationSeconds < 0 ||
      durationSeconds > 86400
    ) {
      setError(
        "Duration must be between 0 and 86400 seconds."
      );
      return;
    }

    if (
      form.status !== "Completed" &&
      durationSeconds !== 0
    ) {
      setError(
        "Only completed calls can have a duration."
      );
      return;
    }

    if (
      form.status !== "Completed" &&
      !["Other", "No Response"].includes(form.outcome)
    ) {
      setError(
        "Selected outcome requires a completed call."
      );
      return;
    }

    const calledAt = new Date(form.calledAt);

    if (Number.isNaN(calledAt.getTime())) {
      setError("Please enter a valid call date.");
      return;
    }

    const nextFollowUp = form.nextFollowUp
      ? new Date(form.nextFollowUp)
      : null;

    if (
      nextFollowUp &&
      (
        Number.isNaN(nextFollowUp.getTime()) ||
        nextFollowUp <= calledAt
      )
    ) {
      setError(
        "Next follow-up must be after the call date."
      );
      return;
    }

    const payload = {
      contactType: form.contactType,
      lead:
        form.contactType === "Lead"
          ? form.referenceId
          : null,
      client:
        form.contactType === "Client"
          ? form.referenceId
          : null,
      contactName: selectedContact.name,
      phone: selectedContact.phone,
      direction: form.direction,
      status: form.status,
      outcome: form.outcome,
      durationSeconds,
      calledAt: calledAt.toISOString(),
      nextFollowUp: nextFollowUp
        ? nextFollowUp.toISOString()
        : null,
      notes: form.notes.trim(),
    };

    try {
      setSaving(true);
      setError("");

      await onSave(payload);
    } catch (err) {
      setError(
        err.message || "Unable to save call record."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="calling__modal-backdrop"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !saving
        ) {
          onClose();
        }
      }}
    >
      <section
        className="calling__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="calling-modal-title"
      >
        <div className="calling__modal-header">
          <div>
            <h2 id="calling-modal-title">
              {call ? "Edit Call Record" : "Log New Call"}
            </h2>
            <p>
              Record conversations and schedule callbacks.
            </p>
          </div>

          <button
            type="button"
            className="calling__icon-button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            <X size={19} />
          </button>
        </div>

        <form
          className="calling__form"
          onSubmit={handleSubmit}
        >
          <div className="calling__form-grid">
            <label>
              Reference Type *
              <select
                name="contactType"
                value={form.contactType}
                onChange={handleChange}
                required
              >
                <option value="Lead">Lead</option>
                {contacts.Client.length > 0 && (
                  <option value="Client">Client</option>
                )}
              </select>
            </label>

            <label>
              Select Contact *
              <select
                name="referenceId"
                value={form.referenceId}
                onChange={handleChange}
                required
              >
                <option value="">Select contact</option>
                {availableContacts.map((contact) => (
                  <option
                    key={getId(contact)}
                    value={getId(contact)}
                  >
                    {contact.name}
                    {contact.company
                      ? ` — ${contact.company}`
                      : ""}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Contact Name
              <input
                value={selectedContact?.name || ""}
                readOnly
              />
            </label>

            <label>
              Phone Number
              <input
                value={selectedContact?.phone || ""}
                readOnly
              />
            </label>

            <label>
              Call Direction
              <select
                name="direction"
                value={form.direction}
                onChange={handleChange}
              >
                <option value="Outgoing">Outgoing</option>
                <option value="Incoming">Incoming</option>
              </select>
            </label>

            <label>
              Call Status
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Call Outcome
              <select
                name="outcome"
                value={form.outcome}
                onChange={handleChange}
              >
                {(form.status === "Completed"
                  ? OUTCOMES
                  : ["No Response", "Other"]
                ).map((outcome) => (
                  <option key={outcome} value={outcome}>
                    {outcome}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Duration (Seconds)
              <input
                type="number"
                name="durationSeconds"
                min="0"
                max="86400"
                step="1"
                value={form.durationSeconds}
                onChange={handleChange}
                disabled={form.status !== "Completed"}
              />
            </label>

            <label>
              Call Date & Time *
              <input
                type="datetime-local"
                name="calledAt"
                value={form.calledAt}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              Next Callback
              <input
                type="datetime-local"
                name="nextFollowUp"
                value={form.nextFollowUp}
                onChange={handleChange}
              />
            </label>

            <label className="calling__form-full">
              Call Notes
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={4}
                maxLength={5000}
                placeholder="Discussion summary and next action..."
              />
            </label>
          </div>

          {error && (
            <p
              className="calling__form-error"
              role="alert"
            >
              {error}
            </p>
          )}

          <div className="calling__modal-actions">
            <button
              type="button"
              className="calling__button calling__button--secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="calling__button calling__button--primary"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : call
                  ? "Save Changes"
                  : "Save Call"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function Calling() {
  const [calls, setCalls] = useState([]);
  const [contacts, setContacts] = useState({
    Lead: [],
    Client: [],
  });

  const [role, setRole] = useState("employee");
  const [currentUserId, setCurrentUserId] = useState("");

  const [search, setSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("All");
  const [employeeFilter, setEmployeeFilter] = useState("All");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCall, setEditingCall] = useState(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingCall(null);
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const [records, session] = await Promise.all([
          getAllRecords("/calls", "calls"),
          apiRequest("/auth/me"),
        ]);

        if (!active) return;

        setCalls(records);
        setRole(session.user?.role || "employee");
        setCurrentUserId(getId(session.user));
      } catch (err) {
        if (active) {
          setError(
            err.message || "Unable to load call records."
          );
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

  const isManager = ["admin", "manager"].includes(role);

  const employees = useMemo(() => {
    return [
      ...new Set(
        calls
          .map((call) => call.calledBy?.name)
          .filter(Boolean)
      ),
    ].sort();
  }, [calls]);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const now = Date.now();

    return {
      total: calls.length,
      today: calls.filter(
        (call) =>
          new Date(call.calledAt).toDateString() === today
      ).length,
      connected: calls.filter(
        (call) => call.status === "Completed"
      ).length,
      missed: calls.filter((call) =>
        ["No Answer", "Busy"].includes(call.status)
      ).length,
      callbacks: calls.filter(
        (call) =>
          call.nextFollowUp &&
          new Date(call.nextFollowUp).getTime() >= now
      ).length,
      overdue: calls.filter(
        (call) =>
          call.nextFollowUp &&
          new Date(call.nextFollowUp).getTime() < now
      ).length,
    };
  }, [calls]);

  const filteredCalls = useMemo(() => {
    const query = search.trim().toLowerCase();

    return calls
      .filter((call) => {
        const matchesSearch = [
          call.contactName,
          call.phone,
          call.calledBy?.name,
          call.lead?.company,
          call.client?.company,
          call.notes,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(query)
        );

        const matchesOutcome =
          outcomeFilter === "All" ||
          call.outcome === outcomeFilter;

        const matchesEmployee =
          employeeFilter === "All" ||
          call.calledBy?.name === employeeFilter;

        return (
          matchesSearch &&
          matchesOutcome &&
          matchesEmployee
        );
      })
      .sort(
        (a, b) =>
          new Date(b.calledAt).getTime() -
          new Date(a.calledAt).getTime()
      );
  }, [calls, search, outcomeFilter, employeeFilter]);

  const openModal = async (call = null) => {
    if (busy) return;

    try {
      setBusy(true);
      setError("");

      const leads = await getAllRecords(
        "/leads",
        "leads"
      );

      const clients = isManager
        ? await getAllRecords("/clients", "clients")
        : [];

      const selectedLead = call?.lead;
      const selectedClient = call?.client;

      if (
        selectedLead &&
        typeof selectedLead === "object" &&
        !leads.some(
          (lead) => getId(lead) === getId(selectedLead)
        )
      ) {
        leads.unshift(selectedLead);
      }

      if (
        selectedClient &&
        typeof selectedClient === "object" &&
        !clients.some(
          (client) =>
            getId(client) === getId(selectedClient)
        )
      ) {
        clients.unshift(selectedClient);
      }

      setContacts({
        Lead: leads,
        Client: clients,
      });

      setEditingCall(call);
      setModalOpen(true);
    } catch (err) {
      setError(
        err.message || "Unable to open call form."
      );
    } finally {
      setBusy(false);
    }
  };

  const saveCall = async (payload) => {
    if (editingCall) {
      await apiMutation(
        `/calls/${encodeURIComponent(getId(editingCall))}`,
        "PATCH",
        payload
      );
    } else {
      await apiMutation(
        "/calls",
        "POST",
        payload
      );
    }

    closeModal();
    refresh();
  };

  const deleteCall = async (call) => {
    if (!isManager || busy) return;

    const confirmed = window.confirm(
      `Delete call record for "${call.contactName}"?`
    );

    if (!confirmed) return;

    try {
      setBusy(true);
      setError("");

      await apiMutation(
        `/calls/${encodeURIComponent(getId(call))}`,
        "DELETE"
      );

      refresh();
    } catch (err) {
      setError(
        err.message || "Unable to delete call."
      );
    } finally {
      setBusy(false);
    }
  };

  const cards = [
    {
      label: "Total Calls",
      value: stats.total,
      Icon: Phone,
    },
    {
      label: "Calls Today",
      value: stats.today,
      Icon: PhoneCall,
    },
    {
      label: "Connected Calls",
      value: stats.connected,
      Icon: UsersRound,
    },
    {
      label: "No Answer / Busy",
      value: stats.missed,
      Icon: PhoneMissed,
    },
    {
      label: "Upcoming Callbacks",
      value: stats.callbacks,
      Icon: CalendarClock,
    },
    {
      label: "Overdue Callbacks",
      value: stats.overdue,
      Icon: Clock3,
    },
  ];

  return (
    <div className="calling">
      <div className="calling__header">
        <div>
          <span className="calling__eyebrow">
            SALES OPERATIONS
          </span>
          <h1>Calling Management</h1>
          <p>
            Track employee calls, conversation outcomes
            and upcoming callbacks.
          </p>
        </div>

        <button
          type="button"
          className="calling__button calling__button--primary"
          onClick={() => void openModal()}
          disabled={busy}
        >
          <Plus size={18} />
          Log New Call
        </button>
      </div>

      {error && (
        <div className="calling__error" role="alert">
          {error}
        </div>
      )}

      <div className="calling__stats">
        {cards.map(({ label, value, Icon }) => (
          <div className="calling__stat" key={label}>
            <Icon size={21} />
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <section className="calling__panel">
        <div className="calling__panel-heading">
          <div>
            <h2>
              <History size={19} />
              Call History
            </h2>
            <p>All recorded client and lead calls</p>
          </div>
        </div>

        <div className="calling__toolbar">
          <div className="calling__search">
            <Search size={18} />
            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search contact, phone, employee..."
              aria-label="Search calls"
            />
          </div>

          <div className="calling__filters">
            <Filter size={17} />

            <select
              value={employeeFilter}
              onChange={(event) =>
                setEmployeeFilter(event.target.value)
              }
            >
              <option value="All">All Employees</option>
              {employees.map((employee) => (
                <option
                  key={employee}
                  value={employee}
                >
                  {employee}
                </option>
              ))}
            </select>

            <select
              value={outcomeFilter}
              onChange={(event) =>
                setOutcomeFilter(event.target.value)
              }
            >
              <option value="All">All Outcomes</option>
              {OUTCOMES.map((outcome) => (
                <option
                  key={outcome}
                  value={outcome}
                >
                  {outcome}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="calling__table-wrap">
          <table className="calling__table">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Reference</th>
                <th>Employee</th>
                <th>Call Date</th>
                <th>Duration</th>
                <th>Outcome</th>
                <th>Next Callback</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredCalls.map((call) => {
                const reference =
                  call.contactType === "Lead"
                    ? call.lead
                    : call.client;

                const overdue =
                  call.nextFollowUp &&
                  new Date(call.nextFollowUp).getTime() <
                    Date.now();

                const canEdit =
                  isManager ||
                  getId(call.calledBy) === currentUserId;

                return (
                  <tr key={getId(call)}>
                    <td>
                      <div className="calling__identity">
                        <span className="calling__avatar">
                          {call.contactName
                            ?.charAt(0)
                            ?.toUpperCase() || "C"}
                        </span>

                        <div>
                          <strong>
                            {call.contactName}
                          </strong>

                          <a href={`tel:${call.phone}`}>
                            <Phone size={12} />
                            {call.phone}
                          </a>

                          {reference?.company && (
                            <small>
                              <Building2 size={12} />
                              {reference.company}
                            </small>
                          )}
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="calling__reference">
                        <span>{call.contactType}</span>
                        <strong>
                          {reference?.name || "Not linked"}
                        </strong>
                      </div>
                    </td>

                    <td>
                      <span className="calling__employee">
                        <UserRound size={14} />
                        {call.calledBy?.name || "Unknown"}
                      </span>
                    </td>

                    <td>
                      <span className="calling__date">
                        <Clock3 size={14} />
                        {formatDate(call.calledAt)}
                      </span>
                    </td>

                    <td>
                      {Math.floor(
                        (call.durationSeconds || 0) / 60
                      )}{" "}
                      min
                    </td>

                    <td>
                      <span
                        className={`calling__badge calling__badge--${getBadgeClass(
                          call.outcome
                        )}`}
                      >
                        {call.outcome}
                      </span>
                    </td>

                    <td>
                      {call.nextFollowUp ? (
                        <span
                          className={`calling__callback ${
                            overdue
                              ? "calling__callback--overdue"
                              : ""
                          }`}
                        >
                          <CalendarClock size={14} />
                          {formatDate(call.nextFollowUp)}
                          {overdue && <small>Overdue</small>}
                        </span>
                      ) : (
                        <span className="calling__muted">
                          Not scheduled
                        </span>
                      )}
                    </td>

                    <td>
                      <div className="calling__actions">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() =>
                              void openModal(call)
                            }
                            disabled={busy}
                            title="Edit call"
                            aria-label={`Edit ${call.contactName}`}
                          >
                            <Pencil size={16} />
                          </button>
                        )}

                        {isManager && (
                          <button
                            type="button"
                            className="calling__delete"
                            onClick={() =>
                              void deleteCall(call)
                            }
                            disabled={busy}
                            title="Delete call"
                            aria-label={`Delete ${call.contactName}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}

                        <a
                          href={`tel:${call.phone}`}
                          title="Call contact"
                          aria-label={`Call ${call.contactName}`}
                        >
                          <ExternalLink size={16} />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredCalls.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="calling__empty">
                      <PhoneCall size={36} />

                      <h3>
                        {loading
                          ? "Loading calls..."
                          : "No call records found"}
                      </h3>

                      <p>
                        {loading
                          ? "Fetching records from backend."
                          : calls.length === 0
                            ? "Log your first call."
                            : "Try changing the filters."}
                      </p>

                      {!loading &&
                        calls.length === 0 && (
                          <button
                            type="button"
                            className="calling__button calling__button--primary"
                            onClick={() =>
                              void openModal()
                            }
                            disabled={busy}
                          >
                            <Plus size={16} />
                            Log First Call
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="calling__table-footer">
          Showing {filteredCalls.length} of{" "}
          {calls.length} call records
        </div>
      </section>

      {modalOpen && (
        <CallModal
          call={editingCall}
          contacts={contacts}
          onClose={closeModal}
          onSave={saveCall}
        />
      )}
    </div>
  );
}
