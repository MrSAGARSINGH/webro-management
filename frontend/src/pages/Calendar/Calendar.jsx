
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Clock3,
  CheckCircle2,
  AlertTriangle,
  ListTodo,
  PhoneCall,
  FolderKanban,
  Users,
  Pencil,
  Trash2,
  MapPin,
  CalendarClock,
} from "lucide-react";
import "./Calendar.scss";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

const EVENTS_KEY = "webro-management-calendar-v1";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EVENT_TYPES = ["Meeting", "Reminder", "Call", "Deadline", "Other"];

const EMPTY_FORM = {
  title: "",
  type: "Meeting",
  date: "",
  time: "",
  description: "",
  location: "",
};

const pad = (value) => String(value).padStart(2, "0");

const toDateKey = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;

const todayKey = () => toDateKey(new Date());

const parseDate = (value) => {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
};

const normalizeDate = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : toDateKey(date);
};

const formatDate = (value) => {
  const date = parseDate(value);
  return date
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date)
    : "Invalid date";
};

const formatMonth = (date) =>
  new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(date);

const formatTime = (time) => {
  if (!time) return "All day";

  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) return "All day";

  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(2026, 0, 1, Number(match[1]), Number(match[2])));
};

const idOf = (value) =>
  typeof value === "string" ? value : value?._id || value?.id || "";

function readEvents() {
  try {
    const parsed = JSON.parse(localStorage.getItem(EVENTS_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter(
          (event) =>
            typeof event?.id === "string" &&
            typeof event.title === "string" &&
            Boolean(parseDate(event.date))
        )
      : [];
  } catch {
    return [];
  }
}

async function api(path, signal) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
    signal,
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || result?.success !== true) {
    throw new Error(
      result?.message || `Unable to fetch calendar data (${response.status})`
    );
  }

  return result;
}

async function fetchAll(path, key, signal) {
  const records = [];
  let page = 1;
  let totalPages = 1;

  do {
    const separator = path.includes("?") ? "&" : "?";
    const result = await api(
      `${path}${separator}page=${page}&limit=100`,
      signal
    );

    if (!Array.isArray(result[key])) {
      throw new Error(`Unexpected ${key} response.`);
    }

    records.push(...result[key]);
    totalPages = result.pagination?.totalPages ?? 1;
    page += 1;
  } while (page <= totalPages);

  return records;
}

function buildIntegratedEvents(tasks, followUps, projects) {
  const taskEvents = tasks
    .filter(
      (task) =>
        idOf(task) &&
        task.title &&
        normalizeDate(task.dueDate) &&
        !["Completed", "Cancelled"].includes(task.status)
    )
    .map((task) => ({
      id: `task-${idOf(task)}`,
      title: task.title,
      date: normalizeDate(task.dueDate),
      time: "",
      type: "Task",
      source: "task",
      description: task.description || "",
      subtitle: task.project?.name || "",
      status: task.status,
    }));

  const followUpEvents = followUps
    .filter(
      (item) =>
        idOf(item) &&
        item.scheduledAt &&
        !["Completed", "Cancelled"].includes(item.status)
    )
    .map((item) => {
      const scheduled = new Date(item.scheduledAt);
      const localTime = `${pad(scheduled.getHours())}:${pad(
        scheduled.getMinutes()
      )}`;

      return {
        id: `followup-${idOf(item)}`,
        title: item.title || "Follow-up",
        date: toDateKey(scheduled),
        time: localTime,
        type: "Follow-up",
        source: "followup",
        description: item.description || "",
        subtitle: item.lead?.name || item.client?.name || "",
        status: item.status,
      };
    });

  const projectEvents = projects
    .filter(
      (project) =>
        idOf(project) &&
        normalizeDate(project.deadline) &&
        !["Completed", "Cancelled"].includes(project.status)
    )
    .map((project) => ({
      id: `project-${idOf(project)}`,
      title: `${project.name || "Project"} deadline`,
      date: normalizeDate(project.deadline),
      time: "",
      type: "Project",
      source: "project",
      description: "",
      subtitle: project.client?.name || "",
      status: project.status,
    }));

  return [...taskEvents, ...followUpEvents, ...projectEvents];
}

function EventModal({ event, initialDate, onClose, onSave }) {
  const [form, setForm] = useState(() =>
    event
      ? { ...EMPTY_FORM, ...event }
      : { ...EMPTY_FORM, date: initialDate || todayKey() }
  );

  const [error, setError] = useState("");

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleChange = (e) => {
    setForm((previous) => ({
      ...previous,
      [e.target.name]: e.target.value,
    }));
    setError("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!form.title.trim()) {
      setError("Event title is required.");
      return;
    }

    if (!parseDate(form.date)) {
      setError("Select a valid event date.");
      return;
    }

    if (
      form.time &&
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(form.time)
    ) {
      setError("Enter a valid event time.");
      return;
    }

    onSave({
      title: form.title.trim(),
      type: form.type,
      date: form.date,
      time: form.time,
      description: form.description.trim(),
      location: form.location.trim(),
    });
  };

  return (
    <div
      className="calendar-page__backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="calendar-page__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-event-title"
      >
        <div className="calendar-page__modal-header">
          <div>
            <h2 id="calendar-event-title">
              {event ? "Edit Event" : "Create Event"}
            </h2>
            <p>Schedule meetings, calls and reminders.</p>
          </div>

          <button
            type="button"
            className="calendar-page__icon-button"
            onClick={onClose}
            aria-label="Close event form"
          >
            <X size={20} />
          </button>
        </div>

        <form className="calendar-page__form" onSubmit={handleSubmit}>
          <label>
            Event Title *
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              maxLength={150}
              placeholder="Client project meeting"
              required
            />
          </label>

          <div className="calendar-page__form-grid">
            <label>
              Event Type
              <select name="type" value={form.type} onChange={handleChange}>
                {EVENT_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>

            <label>
              Date *
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              Time
              <input
                type="time"
                name="time"
                value={form.time}
                onChange={handleChange}
              />
            </label>

            <label>
              Location
              <input
                name="location"
                value={form.location}
                onChange={handleChange}
                maxLength={200}
                placeholder="Office / Google Meet"
              />
            </label>
          </div>

          <label>
            Description
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={4}
              maxLength={2000}
              placeholder="Meeting agenda or reminder notes..."
            />
          </label>

          {error && (
            <p className="calendar-page__form-error" role="alert">
              {error}
            </p>
          )}

          <div className="calendar-page__modal-actions">
            <button
              type="button"
              className="calendar-page__button calendar-page__button--secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="calendar-page__button calendar-page__button--primary"
            >
              {event ? "Save Changes" : "Create Event"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [today, setToday] = useState(todayKey);
  const [events, setEvents] = useState(readEvents);
  const [integratedEvents, setIntegratedEvents] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [storageError, setStorageError] = useState("");
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
      setStorageError("");
    } catch {
      setStorageError("Unable to save local calendar events.");
    }
  }, [events]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);

      const results = await Promise.allSettled([
        fetchAll("/tasks", "tasks", controller.signal),
        fetchAll("/follow-ups", "followUps", controller.signal),
        fetchAll("/projects", "projects", controller.signal),
      ]);

      if (controller.signal.aborted) return;

      const [tasks, followUps, projects] = results.map((result) =>
        result.status === "fulfilled" ? result.value : []
      );

      setIntegratedEvents(
        buildIntegratedEvents(tasks, followUps, projects)
      );

      const failures = results
        .map((result, index) =>
          result.status === "rejected"
            ? ["Tasks", "Follow-ups", "Projects"][index]
            : null
        )
        .filter(Boolean);

      setApiError(
        failures.length
          ? `Unable to load: ${failures.join(", ")}. Other events remain available.`
          : ""
      );
      setLoading(false);
    }

    void load();

    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    const updateToday = () => setToday(todayKey());
    const onFocus = () => {
      updateToday();
      refresh();
    };

    const timer = window.setInterval(updateToday, 60_000);
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const allEvents = useMemo(
    () =>
      [
        ...events.map((event) => ({ ...event, source: "manual" })),
        ...integratedEvents,
      ].sort((a, b) =>
        `${a.date}T${a.time || "00:00"}`.localeCompare(
          `${b.date}T${b.time || "00:00"}`
        )
      ),
    [events, integratedEvents]
  );

  const eventsByDate = useMemo(() => {
    const map = new Map();

    allEvents.forEach((event) => {
      if (!map.has(event.date)) map.set(event.date, []);
      map.get(event.date).push(event);
    });

    return map;
  }, [allEvents]);

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const leading = new Date(year, month, 1).getDay();
    const last = new Date(year, month + 1, 0).getDate();
    const cells = Math.ceil((leading + last) / 7) * 7;

    return Array.from({ length: cells }, (_, index) => {
      const date = new Date(year, month, index - leading + 1);

      return {
        date: toDateKey(date),
        day: date.getDate(),
        currentMonth:
          date.getMonth() === month && date.getFullYear() === year,
      };
    });
  }, [currentMonth]);

  const selectedEvents = eventsByDate.get(selectedDate) || [];

  const upcomingEvents = useMemo(
    () => allEvents.filter((event) => event.date >= today).slice(0, 8),
    [allEvents, today]
  );

  const stats = useMemo(() => {
    const prefix = `${currentMonth.getFullYear()}-${pad(
      currentMonth.getMonth() + 1
    )}`;

    return {
      total: allEvents.filter((event) => event.date.startsWith(prefix)).length,
      today: (eventsByDate.get(today) || []).length,
      upcoming: allEvents.filter((event) => event.date > today).length,
      tasks: integratedEvents.filter((event) => event.source === "task").length,
    };
  }, [allEvents, currentMonth, today, eventsByDate, integratedEvents]);

  const changeMonth = (offset) => {
    setCurrentMonth(
      (previous) =>
        new Date(
          previous.getFullYear(),
          previous.getMonth() + offset,
          1
        )
    );
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(todayKey());
  };

  const selectDay = (date) => {
    setSelectedDate(date);
    const parsed = parseDate(date);

    if (parsed) {
      setCurrentMonth(
        new Date(parsed.getFullYear(), parsed.getMonth(), 1)
      );
    }
  };

  const saveEvent = (form) => {
    const timestamp = new Date().toISOString();

    if (editingEvent) {
      setEvents((previous) =>
        previous.map((event) =>
          event.id === editingEvent.id
            ? { ...event, ...form, updatedAt: timestamp }
            : event
        )
      );
    } else {
      setEvents((previous) => [
        ...previous,
        {
          ...form,
          id: crypto.randomUUID(),
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ]);
    }

    selectDay(form.date);
    setModalOpen(false);
    setEditingEvent(null);
  };

  const deleteEvent = (event) => {
    if (!window.confirm(`Delete event "${event.title}"?`)) return;

    setEvents((previous) =>
      previous.filter((item) => item.id !== event.id)
    );
  };

  const getEventIcon = (type) => {
    switch (type) {
      case "Task":
        return ListTodo;
      case "Follow-up":
      case "Call":
        return PhoneCall;
      case "Project":
        return FolderKanban;
      case "Meeting":
        return Users;
      case "Deadline":
        return AlertTriangle;
      default:
        return CalendarClock;
    }
  };

  const renderEvent = (event) => {
    const Icon = getEventIcon(event.type);

    return (
      <div className="calendar-page__event" key={event.id}>
        <div
          className={`calendar-page__event-icon calendar-page__event-icon--${event.type
            .toLowerCase()
            .replace(/\s+/g, "-")}`}
        >
          <Icon size={17} />
        </div>

        <div className="calendar-page__event-info">
          <strong>{event.title}</strong>
          <span>
            <Clock3 size={12} />
            {formatTime(event.time)}
            {" · "}
            {event.type}
          </span>
          {event.subtitle && <small>{event.subtitle}</small>}
          {event.location && (
            <small>
              <MapPin size={12} />
              {event.location}
            </small>
          )}
        </div>

        {event.source === "manual" && (
          <div className="calendar-page__event-actions">
            <button
              type="button"
              title="Edit event"
              aria-label={`Edit ${event.title}`}
              onClick={() => {
                setEditingEvent(event);
                setModalOpen(true);
              }}
            >
              <Pencil size={15} />
            </button>

            <button
              type="button"
              title="Delete event"
              aria-label={`Delete ${event.title}`}
              onClick={() => deleteEvent(event)}
            >
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="calendar-page">
      <div className="calendar-page__header">
        <div>
          <span className="calendar-page__eyebrow">
            SCHEDULE MANAGEMENT
          </span>
          <h1>Calendar &amp; Reminders</h1>
          <p>
            Track meetings, follow-ups, tasks and project deadlines.
          </p>
        </div>

        <button
          type="button"
          className="calendar-page__button calendar-page__button--primary"
          onClick={() => {
            setEditingEvent(null);
            setModalOpen(true);
          }}
        >
          <Plus size={18} />
          Add Event
        </button>
      </div>

      {(storageError || apiError) && (
        <div className="calendar-page__error" role="alert">
          {storageError || apiError}
        </div>
      )}

      <div className="calendar-page__stats">
        {[
          { label: "This Month", value: stats.total, icon: CalendarDays },
          { label: "Today", value: stats.today, icon: Clock3 },
          { label: "Upcoming", value: stats.upcoming, icon: CheckCircle2 },
          { label: "Task Deadlines", value: stats.tasks, icon: ListTodo },
        ].map(({ label, value, icon: Icon }) => (
          <div className="calendar-page__stat" key={label}>
            <Icon size={20} />
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="calendar-page__layout">
        <section className="calendar-page__panel">
          <div className="calendar-page__calendar-header">
            <div>
              <h2>{formatMonth(currentMonth)}</h2>
              <p>Monthly schedule overview</p>
            </div>

            <div className="calendar-page__navigation">
              <button
                type="button"
                onClick={goToToday}
                className="calendar-page__today-button"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                aria-label="Previous month"
              >
                <ChevronLeft size={19} />
              </button>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                aria-label="Next month"
              >
                <ChevronRight size={19} />
              </button>
            </div>
          </div>

          <div className="calendar-page__weekdays">
            {WEEKDAYS.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          <div className="calendar-page__grid">
            {calendarDays.map((day) => {
              const dayEvents = eventsByDate.get(day.date) || [];
              const selected = selectedDate === day.date;
              const isToday = day.date === today;

              return (
                <button
                  type="button"
                  key={day.date}
                  onClick={() => selectDay(day.date)}
                  aria-label={`${formatDate(day.date)}, ${dayEvents.length} events`}
                  aria-pressed={selected}
                  className={[
                    "calendar-page__day",
                    !day.currentMonth && "calendar-page__day--outside",
                    selected && "calendar-page__day--selected",
                    isToday && "calendar-page__day--today",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className="calendar-page__day-number">
                    {day.day}
                  </span>

                  <div className="calendar-page__day-events">
                    {dayEvents.slice(0, 2).map((event) => (
                      <span
                        key={event.id}
                        className={`calendar-page__day-event calendar-page__day-event--${event.type
                          .toLowerCase()
                          .replace(/\s+/g, "-")}`}
                        title={event.title}
                      >
                        {event.title}
                      </span>
                    ))}

                    {dayEvents.length > 2 && (
                      <small>+{dayEvents.length - 2} more</small>
                    )}
                  </div>

                  {dayEvents.length > 0 && (
                    <span className="calendar-page__mobile-dot" />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <aside className="calendar-page__sidebar">
          <section className="calendar-page__panel">
            <div className="calendar-page__side-heading">
              <div>
                <h3>
                  <CalendarDays size={18} />
                  {formatDate(selectedDate)}
                </h3>
                <p>{selectedEvents.length} scheduled events</p>
              </div>

              <button
                type="button"
                aria-label="Add event on selected date"
                onClick={() => {
                  setEditingEvent(null);
                  setModalOpen(true);
                }}
              >
                <Plus size={18} />
              </button>
            </div>

            <div className="calendar-page__event-list">
              {selectedEvents.length ? (
                selectedEvents.map(renderEvent)
              ) : (
                <div className="calendar-page__empty">
                  <CalendarDays size={28} />
                  <strong>
                    {loading ? "Loading schedule..." : "No events scheduled"}
                  </strong>
                  <p>Select another date or add an event.</p>
                </div>
              )}
            </div>
          </section>

          <section className="calendar-page__panel">
            <div className="calendar-page__side-heading">
              <div>
                <h3>
                  <Clock3 size={18} />
                  Upcoming Schedule
                </h3>
                <p>Next 8 scheduled events</p>
              </div>
            </div>

            <div className="calendar-page__upcoming">
              {upcomingEvents.length ? (
                upcomingEvents.map((event) => {
                  const Icon = getEventIcon(event.type);

                  return (
                    <button
                      type="button"
                      key={event.id}
                      onClick={() => selectDay(event.date)}
                      className="calendar-page__upcoming-item"
                    >
                      <span className="calendar-page__upcoming-icon">
                        <Icon size={17} />
                      </span>

                      <span>
                        <strong>{event.title}</strong>
                        <small>
                          {formatDate(event.date)}
                          {" · "}
                          {formatTime(event.time)}
                        </small>
                      </span>

                      <ChevronRight size={15} />
                    </button>
                  );
                })
              ) : (
                <div className="calendar-page__empty">
                  <CalendarClock size={28} />
                  <p>No upcoming events.</p>
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>

      {modalOpen && (
        <EventModal
          event={editingEvent}
          initialDate={selectedDate}
          onClose={() => {
            setModalOpen(false);
            setEditingEvent(null);
          }}
          onSave={saveEvent}
        />
      )}
    </div>
  );
}
