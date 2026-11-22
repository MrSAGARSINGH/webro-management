
import { useEffect, useMemo, useState } from "react";
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

const STORAGE_KEY = "webro-management-calling-v1";

const OUTCOMES = [
  "Connected",
  "No Answer",
  "Busy",
  "Interested",
  "Callback Requested",
  "Not Interested",
];

const REFERENCES = ["Lead", "Client", "Other"];

const EMPTY_FORM = {
  contactName: "",
  business: "",
  phone: "",
  referenceType: "Lead",
  referenceName: "",
  employee: "",
  outcome: "Connected",
  callAt: "",
  duration: "",
  nextCallback: "",
  notes: "",
};

const pad = (number) => String(number).padStart(2, "0");

function toLocalInputValue(date = new Date()) {
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

function parseLocalDateTime(value) {
  if (typeof value !== "string") return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value) {
  const date = parseLocalDateTime(value);

  if (!date) return "Not scheduled";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function isOverdue(value, now = Date.now()) {
  const date = parseLocalDateTime(value);

  return date ? date.getTime() < now : false;
}

function getTodayKey() {
  const now = new Date();

  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
  ].join("-");
}

function readCalls() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed)
      ? parsed.filter(
          (item) =>
            item &&
            typeof item === "object" &&
            typeof item.id === "string"
        )
      : [];
  } catch {
    return [];
  }
}

function getOutcomeClass(outcome) {
  return String(outcome || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function CallModal({ call, onClose, onSave }) {
  const [form, setForm] = useState(() =>
    call
      ? {
          ...EMPTY_FORM,
          ...call,
          duration: String(call.duration ?? ""),
        }
      : {
          ...EMPTY_FORM,
          callAt: toLocalInputValue(),
        }
  );

  const [error, setError] = useState("");

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);

    return () =>
      document.removeEventListener(
        "keydown",
        onKeyDown
      );
  }, [onClose]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const contactName = form.contactName.trim();
    const phone = form.phone.trim();
    const employee = form.employee.trim();

    if (!contactName || !employee) {
      setError(
        "Contact name and assigned employee are required."
      );
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError(
        "Enter a valid 10-digit Indian mobile number."
      );
      return;
    }

    const callDate = parseLocalDateTime(form.callAt);

    if (!callDate) {
      setError("Enter a valid call date and time.");
      return;
    }

    if (callDate.getTime() > Date.now()) {
      setError(
        "Call date cannot be in the future."
      );
      return;
    }

    const duration = Number(form.duration || 0);

    if (
      !Number.isInteger(duration) ||
      duration < 0 ||
      duration > 1440
    ) {
      setError(
        "Call duration must be between 0 and 1440 minutes."
      );
      return;
    }

    if (form.nextCallback) {
      const callbackDate = parseLocalDateTime(
        form.nextCallback
      );

      if (!callbackDate) {
        setError("Enter a valid callback date.");
        return;
      }

      if (
        callbackDate.getTime() <=
        callDate.getTime()
      ) {
        setError(
          "Callback must be after the call date."
        );
        return;
      }
    }

    onSave({
      contactName,
      business: form.business.trim(),
      phone,
      referenceType: form.referenceType,
      referenceName: form.referenceName.trim(),
      employee,
      outcome: form.outcome,
      callAt: form.callAt,
      duration,
      nextCallback: form.nextCallback,
      notes: form.notes.trim(),
    });
  };

  return (
    <div
      className="calling__modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
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
            aria-label="Close form"
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
              Contact Name *
              <input
                name="contactName"
                value={form.contactName}
                onChange={handleChange}
                placeholder="Contact person"
                maxLength={100}
                required
              />
            </label>

            <label>
              Business / Company
              <input
                name="business"
                value={form.business}
                onChange={handleChange}
                placeholder="Company name"
                maxLength={120}
              />
            </label>

            <label>
              Phone Number *
              <input
                name="phone"
                type="tel"
                inputMode="numeric"
                value={form.phone}
                onChange={handleChange}
                placeholder="9876543210"
                maxLength={10}
                required
              />
            </label>

            <label>
              Calling Employee *
              <input
                name="employee"
                value={form.employee}
                onChange={handleChange}
                placeholder="Employee name"
                maxLength={100}
                required
              />
            </label>

            <label>
              Reference Type
              <select
                name="referenceType"
                value={form.referenceType}
                onChange={handleChange}
              >
                {REFERENCES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Lead / Client Reference
              <input
                name="referenceName"
                value={form.referenceName}
                onChange={handleChange}
                placeholder="Related lead or client"
                maxLength={120}
              />
            </label>

            <label>
              Call Outcome
              <select
                name="outcome"
                value={form.outcome}
                onChange={handleChange}
              >
                {OUTCOMES.map((outcome) => (
                  <option
                    key={outcome}
                    value={outcome}
                  >
                    {outcome}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Duration (minutes)
              <input
                name="duration"
                type="number"
                min="0"
                max="1440"
                step="1"
                value={form.duration}
                onChange={handleChange}
                placeholder="5"
              />
            </label>

            <label>
              Call Date & Time *
              <input
                name="callAt"
                type="datetime-local"
                value={form.callAt}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              Next Callback
              <input
                name="nextCallback"
                type="datetime-local"
                value={form.nextCallback}
                onChange={handleChange}
              />
            </label>

            <label className="calling__form-full">
              Call Notes
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                placeholder="Discussion summary, client requirements, next action..."
                maxLength={3000}
                rows={4}
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
            >
              Cancel
            </button>

            <button
              type="submit"
              className="calling__button calling__button--primary"
            >
              {call ? "Save Changes" : "Save Call"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function Calling() {
  const [calls, setCalls] = useState(readCalls);
  const [search, setSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] =
    useState("All");
  const [employeeFilter, setEmployeeFilter] =
    useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCall, setEditingCall] = useState(null);
  const [storageError, setStorageError] =
    useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(calls)
      );

      setStorageError("");
    } catch {
      setStorageError(
        "Unable to save call records in browser storage."
      );
    }
  }, [calls]);

  useEffect(() => {
    const refreshTime = () => {
      setNow(Date.now());
    };

    const interval = window.setInterval(
      refreshTime,
      60_000
    );

    window.addEventListener("focus", refreshTime);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener(
        "focus",
        refreshTime
      );
    };
  }, []);

  const employees = useMemo(
    () =>
      [...new Set(
        calls
          .map((call) => call.employee)
          .filter(Boolean)
      )].sort((a, b) => a.localeCompare(b)),
    [calls]
  );

  const stats = useMemo(() => {
    const today = getTodayKey();

    return {
      total: calls.length,

      today: calls.filter(
        (call) =>
          typeof call.callAt === "string" &&
          call.callAt.slice(0, 10) === today
      ).length,

      connected: calls.filter((call) =>
        ["Connected", "Interested"].includes(
          call.outcome
        )
      ).length,

      missed: calls.filter((call) =>
        ["No Answer", "Busy"].includes(
          call.outcome
        )
      ).length,

      callbacks: calls.filter(
        (call) =>
          call.nextCallback &&
          parseLocalDateTime(call.nextCallback)
            ?.getTime() >= now
      ).length,

      overdue: calls.filter(
        (call) =>
          call.nextCallback &&
          isOverdue(call.nextCallback, now)
      ).length,
    };
  }, [calls, now]);

  const filteredCalls = useMemo(() => {
    const query = search.trim().toLowerCase();

    return calls
      .filter((call) => {
        const matchesSearch = [
          call.contactName,
          call.business,
          call.phone,
          call.employee,
          call.referenceName,
          call.referenceType,
          call.notes,
        ].some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(query)
        );

        const matchesOutcome =
          outcomeFilter === "All" ||
          call.outcome === outcomeFilter;

        const matchesEmployee =
          employeeFilter === "All" ||
          call.employee === employeeFilter;

        return (
          matchesSearch &&
          matchesOutcome &&
          matchesEmployee
        );
      })
      .sort(
        (a, b) =>
          (parseLocalDateTime(b.callAt)?.getTime() ||
            0) -
          (parseLocalDateTime(a.callAt)?.getTime() ||
            0)
      );
  }, [
    calls,
    search,
    outcomeFilter,
    employeeFilter,
  ]);

  const openAdd = () => {
    setEditingCall(null);
    setModalOpen(true);
  };

  const openEdit = (call) => {
    setEditingCall(call);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingCall(null);
  };

  const saveCall = (form) => {
    const timestamp = new Date().toISOString();

    if (editingCall) {
      setCalls((previous) =>
        previous.map((call) =>
          call.id === editingCall.id
            ? {
                ...call,
                ...form,
                updatedAt: timestamp,
              }
            : call
        )
      );
    } else {
      setCalls((previous) => [
        {
          ...form,
          id: crypto.randomUUID(),
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        ...previous,
      ]);
    }

    closeModal();
  };

  const deleteCall = (call) => {
    const confirmed = window.confirm(
      `Delete call record for "${call.contactName}"?`
    );

    if (!confirmed) return;

    setCalls((previous) =>
      previous.filter((item) => item.id !== call.id)
    );
  };

  const statCards = [
    {
      label: "Total Calls",
      value: stats.total,
      icon: Phone,
    },
    {
      label: "Calls Today",
      value: stats.today,
      icon: PhoneCall,
    },
    {
      label: "Connected Calls",
      value: stats.connected,
      icon: UsersRound,
    },
    {
      label: "No Answer / Busy",
      value: stats.missed,
      icon: PhoneMissed,
    },
    {
      label: "Upcoming Callbacks",
      value: stats.callbacks,
      icon: CalendarClock,
    },
    {
      label: "Overdue Callbacks",
      value: stats.overdue,
      icon: Clock3,
    },
  ];

  return (
    <div className="calling">
      {/* PAGE HEADER */}

      <div className="calling__header">
        <div>
          <span className="calling__eyebrow">
            SALES OPERATIONS
          </span>

          <h1>Calling Management</h1>

          <p>
            Track employee calls, conversation
            outcomes and upcoming callbacks.
          </p>
        </div>

        <button
          type="button"
          className="calling__button calling__button--primary"
          onClick={openAdd}
        >
          <Plus size={18} />
          Log New Call
        </button>
      </div>

      {storageError && (
        <div
          className="calling__error"
          role="alert"
        >
          {storageError}
        </div>
      )}

      {/* STATISTICS */}

      <div className="calling__stats">
        {statCards.map(
          ({ label, value, icon: Icon }) => (
            <div
              className="calling__stat"
              key={label}
            >
              <Icon size={21} />
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          )
        )}
      </div>

      {/* CALL HISTORY */}

      <section className="calling__panel">
        <div className="calling__panel-heading">
          <div>
            <h2>
              <History size={19} />
              Call History
            </h2>

            <p>
              All recorded client and lead calls
            </p>
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
              aria-label="Search call records"
            />
          </div>

          <div className="calling__filters">
            <Filter size={17} />

            <select
              value={employeeFilter}
              onChange={(event) =>
                setEmployeeFilter(event.target.value)
              }
              aria-label="Filter by employee"
            >
              <option value="All">
                All Employees
              </option>

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
              aria-label="Filter by call outcome"
            >
              <option value="All">
                All Outcomes
              </option>

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
                const overdue =
                  call.nextCallback &&
                  isOverdue(call.nextCallback, now);

                return (
                  <tr key={call.id}>
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

                          <a
                            href={`tel:${call.phone}`}
                          >
                            <Phone size={12} />
                            {call.phone}
                          </a>

                          {call.business && (
                            <small>
                              <Building2 size={12} />
                              {call.business}
                            </small>
                          )}
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="calling__reference">
                        <span>
                          {call.referenceType}
                        </span>

                        <strong>
                          {call.referenceName ||
                            "Not linked"}
                        </strong>
                      </div>
                    </td>

                    <td>
                      <span className="calling__employee">
                        <UserRound size={14} />
                        {call.employee}
                      </span>
                    </td>

                    <td>
                      <span className="calling__date">
                        <Clock3 size={14} />
                        {formatDateTime(call.callAt)}
                      </span>
                    </td>

                    <td>
                      {Number(call.duration) || 0} min
                    </td>

                    <td>
                      <span
                        className={`calling__badge calling__badge--${getOutcomeClass(
                          call.outcome
                        )}`}
                      >
                        {call.outcome}
                      </span>
                    </td>

                    <td>
                      {call.nextCallback ? (
                        <span
                          className={`calling__callback ${
                            overdue
                              ? "calling__callback--overdue"
                              : ""
                          }`}
                        >
                          <CalendarClock size={14} />

                          {formatDateTime(
                            call.nextCallback
                          )}

                          {overdue && (
                            <small>Overdue</small>
                          )}
                        </span>
                      ) : (
                        <span className="calling__muted">
                          Not scheduled
                        </span>
                      )}
                    </td>

                    <td>
                      <div className="calling__actions">
                        <button
                          type="button"
                          onClick={() =>
                            openEdit(call)
                          }
                          title="Edit call"
                          aria-label={`Edit call for ${call.contactName}`}
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          type="button"
                          className="calling__delete"
                          onClick={() =>
                            deleteCall(call)
                          }
                          title="Delete call"
                          aria-label={`Delete call for ${call.contactName}`}
                        >
                          <Trash2 size={16} />
                        </button>

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

                      <h3>No call records found</h3>

                      <p>
                        {calls.length === 0
                          ? "Log your first call to start tracking conversations."
                          : "Try adjusting the search or filters."}
                      </p>

                      {calls.length === 0 && (
                        <button
                          type="button"
                          className="calling__button calling__button--primary"
                          onClick={openAdd}
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
          onClose={closeModal}
          onSave={saveCall}
        />
      )}
    </div>
  );
}
