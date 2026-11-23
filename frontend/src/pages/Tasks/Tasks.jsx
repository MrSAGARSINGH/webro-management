
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus, Search, Filter, ClipboardList, ListTodo, Clock3,
  CheckCircle2, AlertTriangle, Pencil, Trash2, X,
  CalendarDays, UserRound, FolderKanban, Flag, Eye,
  RotateCcw,
} from "lucide-react";
import "./Tasks.scss";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

const STATUSES = [
  "Todo", "In Progress", "In Review",
  "Completed", "On Hold", "Cancelled",
];

const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

const TYPES = [
  "Frontend", "Backend", "UI/UX Design", "Database",
  "Testing", "Deployment", "Bug Fix", "SEO",
  "Content", "Maintenance", "Other",
];

const EMPTY_FORM = {
  title: "",
  description: "",
  project: "",
  assignedTo: "",
  type: "Other",
  priority: "Medium",
  status: "Todo",
  startDate: "",
  dueDate: "",
  progress: "0",
};

const idOf = (value) =>
  typeof value === "string" ? value : value?._id || value?.id || "";

const dateKey = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};

const formatDate = (value) => {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const toISO = (value) =>
  value ? new Date(`${value}T12:00:00`).toISOString() : null;

const statusClass = (value) =>
  String(value).toLowerCase().replace(/\s+/g, "-");

const displayStatus = (value) =>
  value === "Todo" ? "To Do" : value;

function isOverdue(task, today) {
  return Boolean(
    task.dueDate &&
    dateKey(task.dueDate) < today &&
    !["Completed", "Cancelled"].includes(task.status)
  );
}

async function api(path, options = {}) {
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
      ? result.errors.map((item) => item.message).filter(Boolean).join("; ")
      : "";

    throw new Error(
      details || result?.message || `Request failed (${response.status})`
    );
  }

  return result;
}

async function mutate(path, method, payload) {
  const session = await api("/auth/csrf");

  if (!session.csrfToken) {
    throw new Error("CSRF token unavailable. Please sign in again.");
  }

  return api(path, {
    method,
    headers: { "X-CSRF-Token": session.csrfToken },
    ...(payload !== undefined
      ? { body: JSON.stringify(payload) }
      : {}),
  });
}

async function fetchAll(path, key) {
  const records = [];
  let page = 1;
  let pages = 1;

  do {
    const separator = path.includes("?") ? "&" : "?";
    const result = await api(
      `${path}${separator}page=${page}&limit=100`
    );

    if (!Array.isArray(result[key])) {
      throw new Error(`Invalid ${key} API response.`);
    }

    records.push(...result[key]);
    pages = result.pagination?.totalPages ?? 1;
    page += 1;
  } while (page <= pages);

  return records;
}

function TaskModal({
  task,
  projects,
  employees,
  isManager,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(() =>
    task
      ? {
          ...EMPTY_FORM,
          title: task.title || "",
          description: task.description || "",
          project: idOf(task.project),
          assignedTo: idOf(task.assignedTo),
          type: task.type || "Other",
          priority: task.priority || "Medium",
          status: task.status || "Todo",
          startDate: dateKey(task.startDate),
          dueDate: dateKey(task.dueDate),
          progress: String(task.progress ?? 0),
        }
      : {
          ...EMPTY_FORM,
          startDate: dateKey(new Date()),
        }
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onEscape = (event) => {
      if (event.key === "Escape" && !saving) onClose();
    };

    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [onClose, saving]);

  const change = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
      ...(name === "status"
        ? {
            progress:
              value === "Completed"
                ? "100"
                : previous.status === "Completed"
                  ? "0"
                  : previous.progress,
          }
        : {}),
    }));

    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;

    const progress = Number(form.progress);

    if (form.title.trim().length < 3) {
      setError("Task title must contain at least 3 characters.");
      return;
    }

    if (!task && !form.project) {
      setError("Select a project.");
      return;
    }

    if (
      !Number.isInteger(progress) ||
      progress < 0 ||
      progress > 100
    ) {
      setError("Progress must be between 0 and 100.");
      return;
    }

    if (
      form.startDate &&
      form.dueDate &&
      form.dueDate < form.startDate
    ) {
      setError("Due date cannot be before start date.");
      return;
    }

    if (
      (form.status === "Completed" && progress !== 100) ||
      (form.status !== "Completed" && progress === 100)
    ) {
      setError("Completed tasks must have exactly 100% progress.");
      return;
    }

    const details = {
      title: form.title.trim(),
      description: form.description.trim(),
      type: form.type,
      priority: form.priority,
      startDate: toISO(form.startDate),
      dueDate: toISO(form.dueDate),
    };

    try {
      setSaving(true);
      setError("");

      await onSave({
        details: task
          ? details
          : {
              ...details,
              project: form.project,
              assignedTo: form.assignedTo || null,
            },
        status: form.status,
        progress,
        assignedTo: form.assignedTo || null,
      });
    } catch (err) {
      setError(err.message || "Unable to save task.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="tasks__modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <section
        className="tasks__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
      >
        <div className="tasks__modal-header">
          <div>
            <h2 id="task-modal-title">
              {task ? "Edit Task" : "Create New Task"}
            </h2>
            <p>Configure task details, assignment and deadline.</p>
          </div>

          <button
            type="button"
            className="tasks__icon-button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close task form"
          >
            <X size={20} />
          </button>
        </div>

        <form className="tasks__form" onSubmit={submit}>
          <div className="tasks__form-grid">
            <label className="tasks__form-full">
              Task Title *
              <input
                name="title"
                value={form.title}
                onChange={change}
                maxLength={200}
                required
                placeholder="Build client dashboard"
              />
            </label>

            <label className="tasks__form-full">
              Description
              <textarea
                name="description"
                value={form.description}
                onChange={change}
                maxLength={10000}
                rows={3}
                placeholder="Task requirements and deliverables..."
              />
            </label>

            <label>
              Project Reference *
              <select
                name="project"
                value={form.project}
                onChange={change}
                disabled={Boolean(task)}
                required
              >
                <option value="">Select project</option>
                {projects.map((project) => (
                  <option key={idOf(project)} value={idOf(project)}>
                    {project.name || project.title}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Assigned Employee
              <select
                name="assignedTo"
                value={form.assignedTo}
                onChange={change}
                disabled={!isManager}
              >
                <option value="">Unassigned</option>
                {employees.map((employee) => (
                  <option key={idOf(employee)} value={idOf(employee)}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Task Type
              <select name="type" value={form.type} onChange={change}>
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
                onChange={change}
              >
                {PRIORITIES.map((priority) => (
                  <option key={priority}>{priority}</option>
                ))}
              </select>
            </label>

            <label>
              Task Status
              <select
                name="status"
                value={form.status}
                onChange={change}
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {displayStatus(status)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Start Date
              <input
                type="date"
                name="startDate"
                value={form.startDate}
                onChange={change}
              />
            </label>

            <label>
              Due Date
              <input
                type="date"
                name="dueDate"
                value={form.dueDate}
                onChange={change}
              />
            </label>

            <label className="tasks__form-full">
              Progress — {form.progress}%
              <input
                className="tasks__range"
                type="range"
                name="progress"
                min="0"
                max="100"
                step="5"
                value={form.progress}
                onChange={change}
                disabled={form.status === "Completed"}
              />
            </label>
          </div>

          {error && (
            <p className="tasks__form-error" role="alert">
              {error}
            </p>
          )}

          <div className="tasks__modal-actions">
            <button
              type="button"
              className="tasks__button tasks__button--secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="tasks__button tasks__button--primary"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : task
                  ? "Save Changes"
                  : "Create Task"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function TaskDetails({ task, onClose, onEdit, canEdit }) {
  return (
    <div
      className="tasks__modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="tasks__modal tasks__modal--details"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-details-title"
      >
        <div className="tasks__modal-header">
          <div>
            <span className="tasks__eyebrow">TASK DETAILS</span>
            <h2 id="task-details-title">{task.title}</h2>
          </div>
          <button
            type="button"
            className="tasks__icon-button"
            onClick={onClose}
            aria-label="Close task details"
          >
            <X size={20} />
          </button>
        </div>

        <div className="tasks__details-body">
          <p className="tasks__description">
            {task.description || "No description provided."}
          </p>

          <div className="tasks__details-grid">
            <div>
              <span>Project</span>
              <strong>{task.project?.name || "Not linked"}</strong>
            </div>
            <div>
              <span>Assigned To</span>
              <strong>{task.assignedTo?.name || "Unassigned"}</strong>
            </div>
            <div>
              <span>Priority</span>
              <strong>{task.priority}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{displayStatus(task.status)}</strong>
            </div>
            <div>
              <span>Start Date</span>
              <strong>{formatDate(task.startDate)}</strong>
            </div>
            <div>
              <span>Due Date</span>
              <strong>{formatDate(task.dueDate)}</strong>
            </div>
          </div>

          <div className="tasks__details-progress">
            <div>
              <span>Task Progress</span>
              <strong>{task.progress}%</strong>
            </div>
            <div className="tasks__progress-track">
              <span style={{ width: `${task.progress}%` }} />
            </div>
          </div>

          {canEdit && (
            <button
              type="button"
              className="tasks__button tasks__button--primary"
              onClick={onEdit}
            >
              <Pencil size={16} />
              Edit Task
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [role, setRole] = useState("employee");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [employeeFilter, setEmployeeFilter] = useState("All");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [viewingTaskId, setViewingTaskId] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);

  const isManager = ["admin", "manager"].includes(role);
  const today = dateKey(new Date());

  const refresh = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const [records, session] = await Promise.all([
          fetchAll("/tasks", "tasks"),
          api("/auth/me"),
        ]);

        if (!active) return;

        setTasks(records);
        setRole(session.user?.role || "employee");
      } catch (err) {
        if (active) {
          setError(err.message || "Unable to load tasks.");
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

  const openForm = async (task = null) => {
    if (busy) return;

    try {
      setBusy(true);
      setError("");

      const projectList = await fetchAll("/projects", "projects");
      const userList = isManager
        ? await fetchAll("/users", "users")
        : [];

      if (
        task?.project &&
        typeof task.project === "object" &&
        !projectList.some(
          (project) => idOf(project) === idOf(task.project)
        )
      ) {
        projectList.unshift(task.project);
      }

      if (
        task?.assignedTo &&
        typeof task.assignedTo === "object" &&
        !userList.some(
          (user) => idOf(user) === idOf(task.assignedTo)
        )
      ) {
        userList.unshift(task.assignedTo);
      }

      setProjects(projectList);
      setEmployees(
        userList.filter((user) => user.isActive !== false)
      );
      setEditingTask(task);
      setModalOpen(true);
    } catch (err) {
      setError(err.message || "Unable to load form data.");
    } finally {
      setBusy(false);
    }
  };

  const saveTask = async (payload) => {
    if (!editingTask) {
      const created = await mutate(
        "/tasks",
        "POST",
        payload.details
      );

      const newTaskId = idOf(created.task);

      if (
        newTaskId &&
        (payload.status !== "Todo" || payload.progress !== 0)
      ) {
        await mutate(
          `/tasks/${newTaskId}/status`,
          "PATCH",
          {
            status: payload.status,
            progress: payload.progress,
          }
        );
      }
    } else {
      const taskId = idOf(editingTask);

      await mutate(
        `/tasks/${taskId}`,
        "PATCH",
        payload.details
      );

      if (
        isManager &&
        payload.assignedTo !== idOf(editingTask.assignedTo)
      ) {
        await mutate(
          `/tasks/${taskId}/assign`,
          "PATCH",
          { assignedTo: payload.assignedTo }
        );
      }

      if (
        payload.status !== editingTask.status ||
        payload.progress !== editingTask.progress
      ) {
        await mutate(
          `/tasks/${taskId}/status`,
          "PATCH",
          {
            status: payload.status,
            progress: payload.progress,
          }
        );
      }
    }

    setModalOpen(false);
    setEditingTask(null);
    refresh();
  };

  const deleteTask = async (task) => {
    if (!isManager || busy) return;

    if (!window.confirm(`Delete task "${task.title}"?`)) {
      return;
    }

    try {
      setBusy(true);
      setError("");

      await mutate(`/tasks/${idOf(task)}`, "DELETE");

      if (viewingTaskId === idOf(task)) {
        setViewingTaskId(null);
      }

      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const markCompleted = async (task) => {
    if (busy) return;

    const completed = task.status === "Completed";

    try {
      setBusy(true);
      setError("");

      await mutate(
        `/tasks/${idOf(task)}/status`,
        "PATCH",
        {
          status: completed ? "Todo" : "Completed",
          progress: completed ? 0 : 100,
        }
      );

      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const employeeNames = useMemo(
    () =>
      [...new Set(
        tasks.map((task) => task.assignedTo?.name).filter(Boolean)
      )].sort(),
    [tasks]
  );

  const stats = useMemo(() => ({
    total: tasks.length,
    todo: tasks.filter((task) => task.status === "Todo").length,
    inProgress: tasks.filter(
      (task) => task.status === "In Progress"
    ).length,
    completed: tasks.filter(
      (task) => task.status === "Completed"
    ).length,
    overdue: tasks.filter(
      (task) => isOverdue(task, today)
    ).length,
  }), [tasks, today]);

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rank = { Urgent: 0, High: 1, Medium: 2, Low: 3 };

    return tasks
      .filter((task) => {
        const matchesSearch = [
          task.title,
          task.description,
          task.project?.name,
          task.assignedTo?.name,
        ].some((value) =>
          String(value || "").toLowerCase().includes(query)
        );

        return (
          matchesSearch &&
          (statusFilter === "All" ||
            (statusFilter === "Overdue"
              ? isOverdue(task, today)
              : task.status === statusFilter)) &&
          (priorityFilter === "All" ||
            task.priority === priorityFilter) &&
          (employeeFilter === "All" ||
            task.assignedTo?.name === employeeFilter)
        );
      })
      .sort((a, b) => {
        const aDone = ["Completed", "Cancelled"].includes(a.status);
        const bDone = ["Completed", "Cancelled"].includes(b.status);

        if (aDone !== bDone) return aDone ? 1 : -1;

        const difference =
          (rank[a.priority] ?? 4) - (rank[b.priority] ?? 4);

        if (difference) return difference;

        return String(a.dueDate || "9999").localeCompare(
          String(b.dueDate || "9999")
        );
      });
  }, [
    tasks, search, statusFilter,
    priorityFilter, employeeFilter, today,
  ]);

  const viewingTask = tasks.find(
    (task) => idOf(task) === viewingTaskId
  );

  const cards = [
    { label: "Total Tasks", value: stats.total, Icon: ClipboardList },
    { label: "To Do", value: stats.todo, Icon: ListTodo },
    { label: "In Progress", value: stats.inProgress, Icon: Clock3 },
    { label: "Completed", value: stats.completed, Icon: CheckCircle2 },
    { label: "Overdue", value: stats.overdue, Icon: AlertTriangle },
  ];

  return (
    <div className="tasks">
      <div className="tasks__header">
        <div>
          <span className="tasks__eyebrow">WORK MANAGEMENT</span>
          <h1>Task Management</h1>
          <p>
            Assign tasks, monitor progress and track project deadlines.
          </p>
        </div>

        {isManager && (
          <button
            type="button"
            className="tasks__button tasks__button--primary"
            onClick={() => void openForm()}
            disabled={busy}
          >
            <Plus size={18} />
            Create Task
          </button>
        )}
      </div>

      {error && (
        <div className="tasks__error" role="alert">
          {error}
        </div>
      )}

      <div className="tasks__stats">
        {cards.map(({ label, value, Icon }) => (
          <div className="tasks__stat" key={label}>
            <Icon size={21} />
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <section className="tasks__panel">
        <div className="tasks__panel-heading">
          <div>
            <h2>
              <ClipboardList size={19} />
              All Tasks
            </h2>
            <p>Manage assignments, priorities and progress.</p>
          </div>
        </div>

        <div className="tasks__toolbar">
          <div className="tasks__search">
            <Search size={18} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tasks, projects, employees..."
              aria-label="Search tasks"
            />
          </div>

          <div className="tasks__filters">
            <Filter size={17} />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter task status"
            >
              <option value="All">All Statuses</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {displayStatus(status)}
                </option>
              ))}
              <option value="Overdue">Overdue</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
              aria-label="Filter priority"
            >
              <option value="All">All Priorities</option>
              {PRIORITIES.map((priority) => (
                <option key={priority}>{priority}</option>
              ))}
            </select>

            <select
              value={employeeFilter}
              onChange={(event) => setEmployeeFilter(event.target.value)}
              aria-label="Filter employee"
            >
              <option value="All">All Employees</option>
              {employeeNames.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="tasks__table-wrap">
          <table className="tasks__table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Project</th>
                <th>Assigned To</th>
                <th>Priority</th>
                <th>Due Date</th>
                <th>Progress</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredTasks.map((task) => {
                const overdue = isOverdue(task, today);

                return (
                  <tr key={idOf(task)}>
                    <td>
                      <div className="tasks__identity">
                        <span className="tasks__avatar">
                          <ClipboardList size={18} />
                        </span>
                        <div>
                          <strong>{task.title}</strong>
                          <small>
                            {task.description || "No description"}
                          </small>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="tasks__reference">
                        <FolderKanban size={14} />
                        {task.project?.name || "—"}
                      </span>
                    </td>

                    <td>
                      <span className="tasks__reference">
                        <UserRound size={14} />
                        {task.assignedTo?.name || "Unassigned"}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`tasks__priority tasks__priority--${task.priority.toLowerCase()}`}
                      >
                        <Flag size={13} />
                        {task.priority}
                      </span>
                    </td>

                    <td>
                      <div className="tasks__due">
                        <span className={overdue ? "tasks__overdue" : ""}>
                          <CalendarDays size={14} />
                          {formatDate(task.dueDate)}
                        </span>
                        {overdue && <small>Overdue</small>}
                      </div>
                    </td>

                    <td>
                      <div className="tasks__progress">
                        <div className="tasks__progress-label">
                          <span>{task.progress}%</span>
                        </div>
                        <div className="tasks__progress-track">
                          <span
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`tasks__badge tasks__badge--${statusClass(task.status)}`}
                      >
                        {displayStatus(task.status)}
                      </span>
                    </td>

                    <td>
                      <div className="tasks__actions">
                        <button
                          type="button"
                          title="View task"
                          onClick={() => setViewingTaskId(idOf(task))}
                        >
                          <Eye size={16} />
                        </button>

                        <button
                          type="button"
                          title="Edit task"
                          disabled={busy}
                          onClick={() => void openForm(task)}
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          type="button"
                          title={
                            task.status === "Completed"
                              ? "Reopen task"
                              : "Mark completed"
                          }
                          disabled={busy}
                          onClick={() => void markCompleted(task)}
                        >
                          {task.status === "Completed"
                            ? <RotateCcw size={16} />
                            : <CheckCircle2 size={16} />}
                        </button>

                        {isManager && (
                          <button
                            type="button"
                            className="tasks__delete"
                            title="Delete task"
                            disabled={busy}
                            onClick={() => void deleteTask(task)}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredTasks.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="tasks__empty">
                      <ClipboardList size={36} />
                      <h3>
                        {loading
                          ? "Loading tasks..."
                          : "No tasks found"}
                      </h3>
                      <p>
                        {loading
                          ? "Fetching records from backend."
                          : "Create a task or adjust your filters."}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="tasks__table-footer">
          Showing {filteredTasks.length} of {tasks.length} tasks
        </div>
      </section>

      {modalOpen && (
        <TaskModal
          task={editingTask}
          projects={projects}
          employees={employees}
          isManager={isManager}
          onClose={() => {
            setModalOpen(false);
            setEditingTask(null);
          }}
          onSave={saveTask}
        />
      )}

      {viewingTask && (
        <TaskDetails
          task={viewingTask}
          canEdit
          onClose={() => setViewingTaskId(null)}
          onEdit={() => {
            setViewingTaskId(null);
            void openForm(viewingTask);
          }}
        />
      )}
    </div>
  );
}
