
import { useEffect, useMemo, useState } from "react";
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

const STORAGE_KEY = "webro-management-followups-v1";

const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const TYPES = ["Call", "WhatsApp", "Email", "Meeting", "Other"];
const REFERENCES = ["Lead", "Client", "Other"];

const EMPTY_FORM = {
  title: "",
  contactName: "",
  business: "",
  phone: "",
  referenceType: "Lead",
  referenceName: "",
  assignedTo: "",
  type: "Call",
  priority: "Medium",
  dueAt: "",
  notes: "",
};

const pad = (value) => String(value).padStart(2, "0");

function localDateTime(date = new Date()) {
  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function parseDate(value) {
  if (typeof value !== "string" || !value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = parseDate(value);
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

function dayKey(date) {
  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}`;
}

function getBucket(item, now) {
  if (item.status === "Completed") return "Completed";

  const due = parseDate(item.dueAt);
  if (!due) return "Unscheduled";

  if (due.getTime() < now.getTime()) return "Overdue";

  if (dayKey(due) === dayKey(now)) return "Today";

  return "Upcoming";
}

function readFollowUps() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const data = JSON.parse(raw);

    return Array.isArray(data)
      ? data.filter(
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

function FollowUpModal({ item, onClose, onSave }) {
  const [form, setForm] = useState(
    item
      ? { ...EMPTY_FORM, ...item }
      : { ...EMPTY_FORM, dueAt: localDateTime() }
  );

  const [error, setError] = useState("");

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);

    return () =>
      document.removeEventListener(
        "keydown",
        handleEscape
      );
  }, [onClose]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
  }

  function handleSubmit(event) {
    event.preventDefault();

    const title = form.title.trim();
    const contactName = form.contactName.trim();
    const assignedTo = form.assignedTo.trim();
    const phone = form.phone.trim();

    if (!title || !contactName || !assignedTo) {
      setError(
        "Title, contact name and assigned employee are required."
      );
      return;
    }

    if (phone && !/^[6-9]\d{9}$/.test(phone)) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }

    if (!parseDate(form.dueAt)) {
      setError("Select a valid follow-up date and time.");
      return;
    }

    onSave({
      title,
      contactName,
      business: form.business.trim(),
      phone,
      referenceType: form.referenceType,
      referenceName: form.referenceName.trim(),
      assignedTo,
      type: form.type,
      priority: form.priority,
      dueAt: form.dueAt,
      notes: form.notes.trim(),
    });
  }

  return (
    <div
      className="followups__modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
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
            aria-label="Close form"
          >
            <X size={20} />
          </button>
        </div>

        <form
          className="followups__form"
          onSubmit={handleSubmit}
        >
          <div className="followups__form-grid">
            <label className="followups__form-full">
              Follow-up Title *
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="Discuss website proposal"
                maxLength={150}
                required
              />
            </label>

            <label>
              Contact Name *
              <input
                name="contactName"
                value={form.contactName}
                onChange={handleChange}
                placeholder="Client or lead name"
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
                placeholder="Business name"
                maxLength={120}
              />
            </label>

            <label>
              Phone Number
              <input
                name="phone"
                type="tel"
                inputMode="numeric"
                value={form.phone}
                onChange={handleChange}
                placeholder="9876543210"
                maxLength={10}
              />
            </label>

            <label>
              Assigned Employee *
              <input
                name="assignedTo"
                value={form.assignedTo}
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
                placeholder="Related record"
                maxLength={120}
              />
            </label>

            <label>
              Follow-up Type
              <select
                name="type"
                value={form.type}
                onChange={handleChange}
              >
                {TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
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
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </label>

            <label className="followups__form-full">
              Follow-up Date & Time *
              <input
                name="dueAt"
                type="datetime-local"
                value={form.dueAt}
                onChange={handleChange}
                required
              />
            </label>

            <label className="followups__form-full">
              Notes
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                placeholder="What needs to be discussed or completed?"
                rows={4}
                maxLength={3000}
              />
            </label>
          </div>

          {error && (
            <p
              className="followups__form-error"
              role="alert"
            >
              {error}
            </p>
          )}

          <div className="followups__modal-actions">
            <button
              type="button"
              className="followups__button followups__button--secondary"
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="followups__button followups__button--primary"
            >
              {item ? "Save Changes" : "Create Follow-up"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function FollowUps() {
  const [items, setItems] = useState(readFollowUps);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [employeeFilter, setEmployeeFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [storageError, setStorageError] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(items)
      );
      setStorageError("");
    } catch {
      setStorageError(
        "Unable to save follow-ups in browser storage."
      );
    }
  }, [items]);

  useEffect(() => {
    const refresh = () => setNow(new Date());
    const interval = window.setInterval(refresh, 60_000);

    window.addEventListener("focus", refresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const stats = useMemo(() => {
    const counts = {
      All: items.length,
      Today: 0,
      Upcoming: 0,
      Overdue: 0,
      Completed: 0,
    };

    items.forEach((item) => {
      const bucket = getBucket(item, now);
      if (bucket in counts) counts[bucket] += 1;
    });

    return counts;
  }, [items, now]);

  const employees = useMemo(
    () =>
      [...new Set(
        items.map((item) => item.assignedTo).filter(Boolean)
      )].sort((a, b) => a.localeCompare(b)),
    [items]
  );

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    const priorityRank = {
      Urgent: 0,
      High: 1,
      Medium: 2,
      Low: 3,
    };

    return items
      .filter((item) => {
        const bucket = getBucket(item, now);

        const matchesSearch = [
          item.title,
          item.contactName,
          item.business,
          item.phone,
          item.assignedTo,
          item.referenceName,
          item.notes,
        ].some((value) =>
          String(value ?? "").toLowerCase().includes(query)
        );

        return (
          matchesSearch &&
          (activeTab === "All" || bucket === activeTab) &&
          (priorityFilter === "All" ||
            item.priority === priorityFilter) &&
          (employeeFilter === "All" ||
            item.assignedTo === employeeFilter)
        );
      })
      .sort((a, b) => {
        if (a.status === "Completed" && b.status !== "Completed") {
          return 1;
        }

        if (b.status === "Completed" && a.status !== "Completed") {
          return -1;
        }

        const dateDiff =
          (parseDate(a.dueAt)?.getTime() ?? Infinity) -
          (parseDate(b.dueAt)?.getTime() ?? Infinity);

        if (dateDiff !== 0) return dateDiff;

        return (
          (priorityRank[a.priority] ?? 4) -
          (priorityRank[b.priority] ?? 4)
        );
      });
  }, [
    items,
    now,
    search,
    activeTab,
    priorityFilter,
    employeeFilter,
  ]);

  const openAdd = () => {
    setEditingItem(null);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingItem(null);
  };

  const saveFollowUp = (form) => {
    const timestamp = new Date().toISOString();

    if (editingItem) {
      setItems((previous) =>
        previous.map((item) =>
          item.id === editingItem.id
            ? {
                ...item,
                ...form,
                updatedAt: timestamp,
              }
            : item
        )
      );
    } else {
      setItems((previous) => [
        {
          ...form,
          id: crypto.randomUUID(),
          status: "Pending",
          completedAt: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        ...previous,
      ]);
    }

    closeModal();
  };

  const toggleComplete = (item) => {
    const completed = item.status === "Completed";
    const timestamp = new Date().toISOString();

    setItems((previous) =>
      previous.map((current) =>
        current.id === item.id
          ? {
              ...current,
              status: completed ? "Pending" : "Completed",
              completedAt: completed ? null : timestamp,
              updatedAt: timestamp,
            }
          : current
      )
    );
  };

  const deleteFollowUp = (item) => {
    if (
      !window.confirm(
        `Delete follow-up "${item.title}"? This cannot be undone.`
      )
    ) {
      return;
    }

    setItems((previous) =>
      previous.filter((current) => current.id !== item.id)
    );
  };

  const statCards = [
    { label: "All", icon: ListTodo },
    { label: "Today", icon: CalendarDays },
    { label: "Upcoming", icon: CalendarClock },
    { label: "Overdue", icon: AlertTriangle },
    { label: "Completed", icon: CheckCircle2 },
  ];

  return (
    <div className="followups">
      <div className="followups__header">
        <div>
          <span className="followups__eyebrow">
            SALES OPERATIONS
          </span>

          <h1>Follow-up Management</h1>

          <p>
            Track scheduled conversations, overdue actions
            and employee responsibilities.
          </p>
        </div>

        <button
          type="button"
          className="followups__button followups__button--primary"
          onClick={openAdd}
        >
          <Plus size={18} />
          Add Follow-up
        </button>
      </div>

      {storageError && (
        <div className="followups__error" role="alert">
          {storageError}
        </div>
      )}

      <div className="followups__stats">
        {statCards.map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            className={`followups__stat ${
              activeTab === label
                ? "followups__stat--active"
                : ""
            }`}
            onClick={() => setActiveTab(label)}
            aria-pressed={activeTab === label}
          >
            <Icon size={21} />
            <span>
              {label === "All" ? "Total Follow-ups" : label}
            </span>
            <strong>{stats[label]}</strong>
          </button>
        ))}
      </div>

      <section className="followups__panel">
        <div className="followups__panel-heading">
          <div>
            <h2>Follow-up Schedule</h2>
            <p>
              {activeTab === "All"
                ? "All assigned follow-up activities"
                : `${activeTab} follow-up activities`}
            </p>
          </div>
        </div>

        <div className="followups__toolbar">
          <div className="followups__search">
            <Search size={18} />
            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search contact, task, employee..."
              aria-label="Search follow-ups"
            />
          </div>

          <div className="followups__filters">
            <Filter size={17} />

            <select
              value={employeeFilter}
              onChange={(event) =>
                setEmployeeFilter(event.target.value)
              }
              aria-label="Filter by employee"
            >
              <option value="All">All Employees</option>
              {employees.map((employee) => (
                <option key={employee} value={employee}>
                  {employee}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(event.target.value)
              }
              aria-label="Filter by priority"
            >
              <option value="All">All Priorities</option>
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
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
                <th>Assigned To</th>
                <th>Type</th>
                <th>Priority</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredItems.map((item) => {
                const bucket = getBucket(item, now);
                const completed = item.status === "Completed";

                return (
                  <tr key={item.id}>
                    <td>
                      <div className="followups__task">
                        <strong>{item.title}</strong>
                        <small>
                          {item.referenceType}:{" "}
                          {item.referenceName || "Not linked"}
                        </small>
                      </div>
                    </td>

                    <td>
                      <div className="followups__contact">
                        <strong>{item.contactName}</strong>

                        {item.business && (
                          <small>
                            <Building2 size={12} />
                            {item.business}
                          </small>
                        )}

                        {item.phone && (
                          <a href={`tel:${item.phone}`}>
                            <Phone size={12} />
                            {item.phone}
                          </a>
                        )}
                      </div>
                    </td>

                    <td>
                      <span className="followups__employee">
                        <UserRound size={14} />
                        {item.assignedTo}
                      </span>
                    </td>

                    <td>{item.type}</td>

                    <td>
                      <span
                        className={`followups__priority followups__priority--${item.priority.toLowerCase()}`}
                      >
                        {item.priority}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`followups__date ${
                          bucket === "Overdue"
                            ? "followups__date--overdue"
                            : ""
                        }`}
                      >
                        <Clock3 size={14} />
                        {formatDate(item.dueAt)}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`followups__badge followups__badge--${bucket.toLowerCase()}`}
                      >
                        {bucket}
                      </span>
                    </td>

                    <td>
                      <div className="followups__actions">
                        <button
                          type="button"
                          className={
                            completed
                              ? "followups__reopen"
                              : "followups__complete"
                          }
                          onClick={() => toggleComplete(item)}
                          title={
                            completed
                              ? "Reopen follow-up"
                              : "Mark completed"
                          }
                          aria-label={
                            completed
                              ? `Reopen ${item.title}`
                              : `Complete ${item.title}`
                          }
                        >
                          {completed ? (
                            <RotateCcw size={16} />
                          ) : (
                            <CheckCircle2 size={16} />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          title="Edit follow-up"
                          aria-label={`Edit ${item.title}`}
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          type="button"
                          className="followups__delete"
                          onClick={() => deleteFollowUp(item)}
                          title="Delete follow-up"
                          aria-label={`Delete ${item.title}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="followups__empty">
                      <CalendarClock size={36} />
                      <h3>No follow-ups found</h3>
                      <p>
                        {items.length === 0
                          ? "Create your first follow-up to get started."
                          : "Try another status, employee or priority."}
                      </p>

                      {items.length === 0 && (
                        <button
                          type="button"
                          className="followups__button followups__button--primary"
                          onClick={openAdd}
                        >
                          <Plus size={16} />
                          Add Follow-up
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="followups__table-footer">
          Showing {filteredItems.length} of {items.length}{" "}
          follow-ups
        </div>
      </section>

      {modalOpen && (
        <FollowUpModal
          item={editingItem}
          onClose={closeModal}
          onSave={saveFollowUp}
        />
      )}
    </div>
  );
}
