
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Filter,
  ClipboardList,
  ListTodo,
  Clock3,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Trash2,
  X,
  CalendarDays,
  UserRound,
  FolderKanban,
  Flag,
  Eye,
  RotateCcw,
} from "lucide-react";
import "./Tasks.scss";

const STORAGE_KEY = "webro-management-tasks-v1";
const EMPLOYEES_KEY = "webro-management-employees-v1";

const STATUSES = [
  "To Do",
  "In Progress",
  "In Review",
  "Completed",
  "Cancelled",
];

const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

const EMPTY_FORM = {
  title: "",
  description: "",
  projectName: "",
  assignedTo: "",
  priority: "Medium",
  status: "To Do",
  startDate: "",
  dueDate: "",
  progress: "0",
};

const pad = (value) => String(value).padStart(2, "0");

function todayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}`;
}

function formatDate(value) {
  if (!value) return "Not set";

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) return "Invalid date";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function readTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed)
      ? parsed.filter(
          (task) =>
            task &&
            typeof task.id === "string" &&
            typeof task.title === "string"
        )
      : [];
  } catch {
    return [];
  }
}

function readEmployees() {
  try {
    const raw = localStorage.getItem(EMPLOYEES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed)
      ? parsed.filter(
          (employee) =>
            employee &&
            typeof employee.id === "string" &&
            typeof employee.name === "string" &&
            employee.status !== "Inactive"
        )
      : [];
  } catch {
    return [];
  }
}

function isOverdue(task, today) {
  return (
    Boolean(task.dueDate) &&
    task.dueDate < today &&
    task.status !== "Completed" &&
    task.status !== "Cancelled"
  );
}

function getStatusClass(status) {
  return String(status)
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function TaskModal({
  task,
  employees,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(() =>
    task
      ? {
          ...EMPTY_FORM,
          ...task,
          progress: String(task.progress ?? 0),
        }
      : {
          ...EMPTY_FORM,
          startDate: todayKey(),
        }
  );

  const [error, setError] = useState("");

  useEffect(() => {
    const onEscape = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onEscape);

    return () =>
      document.removeEventListener("keydown", onEscape);
  }, [onClose]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => {
      const next = {
        ...previous,
        [name]: value,
      };

      if (name === "status") {
        if (value === "Completed") {
          next.progress = "100";
        } else if (
          previous.status === "Completed" &&
          Number(previous.progress) === 100
        ) {
          next.progress = "0";
        }
      }

      return next;
    });

    setError("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const title = form.title.trim();
    const progress = Number(form.progress);

    if (!title) {
      setError("Task title is required.");
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
      form.status === "Completed" &&
      progress !== 100
    ) {
      setError("Completed tasks must have 100% progress.");
      return;
    }

    if (
      form.status !== "Completed" &&
      progress === 100
    ) {
      setError(
        "Set the status to Completed for 100% progress."
      );
      return;
    }

    onSave({
      title,
      description: form.description.trim(),
      projectName: form.projectName.trim(),
      assignedTo: form.assignedTo.trim(),
      priority: form.priority,
      status: form.status,
      startDate: form.startDate,
      dueDate: form.dueDate,
      progress,
    });
  };

  return (
    <div
      className="tasks__modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
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
            <p>
              Configure task details, assignment and deadline.
            </p>
          </div>

          <button
            type="button"
            className="tasks__icon-button"
            onClick={onClose}
            aria-label="Close task form"
          >
            <X size={20} />
          </button>
        </div>

        <form
          className="tasks__form"
          onSubmit={handleSubmit}
        >
          <div className="tasks__form-grid">
            <label className="tasks__form-full">
              Task Title *
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                maxLength={150}
                placeholder="Build client dashboard"
                required
              />
            </label>

            <label className="tasks__form-full">
              Description
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                maxLength={3000}
                rows={3}
                placeholder="Task requirements and deliverables..."
              />
            </label>

            <label>
              Project Reference
              <input
                name="projectName"
                value={form.projectName}
                onChange={handleChange}
                maxLength={150}
                placeholder="Project name"
              />
            </label>

            <label>
              Assigned Employee
              <select
                name="assignedTo"
                value={form.assignedTo}
                onChange={handleChange}
              >
                <option value="">Unassigned</option>

                {form.assignedTo &&
                  !employees.some(
                    (employee) =>
                      employee.name === form.assignedTo
                  ) && (
                    <option value={form.assignedTo}>
                      {form.assignedTo} (Existing)
                    </option>
                  )}

                {employees.map((employee) => (
                  <option
                    key={employee.id}
                    value={employee.name}
                  >
                    {employee.name}
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
                  <option key={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Task Status
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
              >
                {STATUSES.map((status) => (
                  <option key={status}>
                    {status}
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
                onChange={handleChange}
              />
            </label>

            <label>
              Due Date
              <input
                type="date"
                name="dueDate"
                value={form.dueDate}
                onChange={handleChange}
              />
            </label>

            <label className="tasks__form-full">
              Progress — {form.progress}%
              <input
                type="range"
                name="progress"
                min="0"
                max="100"
                step="5"
                value={form.progress}
                onChange={handleChange}
                disabled={form.status === "Completed"}
                className="tasks__range"
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
            >
              Cancel
            </button>

            <button
              type="submit"
              className="tasks__button tasks__button--primary"
            >
              {task ? "Save Changes" : "Create Task"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function TaskDetails({ task, onClose, onEdit }) {
  return (
    <div
      className="tasks__modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
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
            <span className="tasks__eyebrow">
              TASK DETAILS
            </span>
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
              <strong>
                {task.projectName || "Not linked"}
              </strong>
            </div>

            <div>
              <span>Assigned To</span>
              <strong>
                {task.assignedTo || "Unassigned"}
              </strong>
            </div>

            <div>
              <span>Priority</span>
              <strong>{task.priority}</strong>
            </div>

            <div>
              <span>Status</span>
              <strong>{task.status}</strong>
            </div>

            <div>
              <span>Start Date</span>
              <strong>
                {formatDate(task.startDate)}
              </strong>
            </div>

            <div>
              <span>Due Date</span>
              <strong>
                {formatDate(task.dueDate)}
              </strong>
            </div>
          </div>

          <div className="tasks__details-progress">
            <div>
              <span>Task Progress</span>
              <strong>{task.progress}%</strong>
            </div>

            <div className="tasks__progress-track">
              <span
                style={{
                  width: `${task.progress}%`,
                }}
              />
            </div>
          </div>

          <button
            type="button"
            className="tasks__button tasks__button--primary"
            onClick={onEdit}
          >
            <Pencil size={16} />
            Edit Task
          </button>
        </div>
      </section>
    </div>
  );
}

export default function Tasks() {
  const [tasks, setTasks] = useState(readTasks);
  const [employees, setEmployees] =
    useState(readEmployees);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("All");
  const [priorityFilter, setPriorityFilter] =
    useState("All");
  const [employeeFilter, setEmployeeFilter] =
    useState("All");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [viewingTaskId, setViewingTaskId] =
    useState(null);
  const [storageError, setStorageError] =
    useState("");
  const [today, setToday] = useState(todayKey);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(tasks)
      );
      setStorageError("");
    } catch {
      setStorageError(
        "Unable to save task records in browser storage."
      );
    }
  }, [tasks]);

  useEffect(() => {
    const refresh = () => {
      setToday(todayKey());
      setEmployees(readEmployees());
    };

    const interval = window.setInterval(
      refresh,
      60_000
    );

    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const employeeNames = useMemo(
    () =>
      [...new Set(
        tasks
          .map((task) => task.assignedTo)
          .filter(Boolean)
      )].sort(),
    [tasks]
  );

  const stats = useMemo(() => {
    const active = tasks.filter(
      (task) =>
        task.status !== "Completed" &&
        task.status !== "Cancelled"
    );

    return {
      total: tasks.length,
      todo: tasks.filter(
        (task) => task.status === "To Do"
      ).length,
      inProgress: tasks.filter(
        (task) => task.status === "In Progress"
      ).length,
      completed: tasks.filter(
        (task) => task.status === "Completed"
      ).length,
      overdue: active.filter((task) =>
        isOverdue(task, today)
      ).length,
    };
  }, [tasks, today]);

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    const priorityRank = {
      Urgent: 0,
      High: 1,
      Medium: 2,
      Low: 3,
    };

    return tasks
      .filter((task) => {
        const matchesSearch = [
          task.title,
          task.description,
          task.projectName,
          task.assignedTo,
        ].some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(query)
        );

        const matchesStatus =
          statusFilter === "All" ||
          (statusFilter === "Overdue"
            ? isOverdue(task, today)
            : task.status === statusFilter);

        return (
          matchesSearch &&
          matchesStatus &&
          (priorityFilter === "All" ||
            task.priority === priorityFilter) &&
          (employeeFilter === "All" ||
            task.assignedTo === employeeFilter)
        );
      })
      .sort((a, b) => {
        const aDone =
          a.status === "Completed" ||
          a.status === "Cancelled";
        const bDone =
          b.status === "Completed" ||
          b.status === "Cancelled";

        if (aDone !== bDone) return aDone ? 1 : -1;

        const priorityDifference =
          (priorityRank[a.priority] ?? 4) -
          (priorityRank[b.priority] ?? 4);

        if (priorityDifference) return priorityDifference;

        return (a.dueDate || "9999-12-31").localeCompare(
          b.dueDate || "9999-12-31"
        );
      });
  }, [
    tasks,
    search,
    statusFilter,
    priorityFilter,
    employeeFilter,
    today,
  ]);

  const viewingTask = tasks.find(
    (task) => task.id === viewingTaskId
  );

  const saveTask = (form) => {
    const timestamp = new Date().toISOString();

    if (editingTask) {
      setTasks((previous) =>
        previous.map((task) =>
          task.id === editingTask.id
            ? {
                ...task,
                ...form,
                updatedAt: timestamp,
              }
            : task
        )
      );
    } else {
      setTasks((previous) => [
        {
          ...form,
          id: crypto.randomUUID(),
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        ...previous,
      ]);
    }

    setModalOpen(false);
    setEditingTask(null);
  };

  const deleteTask = (task) => {
    if (
      !window.confirm(
        `Delete task "${task.title}"?`
      )
    ) {
      return;
    }

    setTasks((previous) =>
      previous.filter(
        (item) => item.id !== task.id
      )
    );

    if (viewingTaskId === task.id) {
      setViewingTaskId(null);
    }
  };

  const markCompleted = (task) => {
    setTasks((previous) =>
      previous.map((item) =>
        item.id === task.id
          ? {
              ...item,
              status:
                item.status === "Completed"
                  ? "To Do"
                  : "Completed",
              progress:
                item.status === "Completed"
                  ? 0
                  : 100,
              updatedAt: new Date().toISOString(),
            }
          : item
      )
    );
  };

  const cards = [
    {
      label: "Total Tasks",
      value: stats.total,
      icon: ClipboardList,
    },
    {
      label: "To Do",
      value: stats.todo,
      icon: ListTodo,
    },
    {
      label: "In Progress",
      value: stats.inProgress,
      icon: Clock3,
    },
    {
      label: "Completed",
      value: stats.completed,
      icon: CheckCircle2,
    },
    {
      label: "Overdue",
      value: stats.overdue,
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="tasks">
      <div className="tasks__header">
        <div>
          <span className="tasks__eyebrow">
            WORK MANAGEMENT
          </span>
          <h1>Task Management</h1>
          <p>
            Assign tasks, monitor progress and track
            project deadlines.
          </p>
        </div>

        <button
          type="button"
          className="tasks__button tasks__button--primary"
          onClick={() => {
            setEditingTask(null);
            setModalOpen(true);
          }}
        >
          <Plus size={18} />
          Create Task
        </button>
      </div>

      {storageError && (
        <div className="tasks__error" role="alert">
          {storageError}
        </div>
      )}

      <div className="tasks__stats">
        {cards.map(({ label, value, icon: Icon }) => (
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
            <p>
              Manage assignments, priorities and progress.
            </p>
          </div>
        </div>

        <div className="tasks__toolbar">
          <div className="tasks__search">
            <Search size={18} />
            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search tasks, projects, employees..."
              aria-label="Search tasks"
            />
          </div>

          <div className="tasks__filters">
            <Filter size={17} />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              aria-label="Filter task status"
            >
              <option value="All">All Statuses</option>

              {STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}

              <option value="Overdue">Overdue</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(event.target.value)
              }
              aria-label="Filter priority"
            >
              <option value="All">All Priorities</option>

              {PRIORITIES.map((priority) => (
                <option key={priority}>
                  {priority}
                </option>
              ))}
            </select>

            <select
              value={employeeFilter}
              onChange={(event) =>
                setEmployeeFilter(event.target.value)
              }
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
                const overdue = isOverdue(
                  task,
                  today
                );

                return (
                  <tr key={task.id}>
                    <td>
                      <div className="tasks__identity">
                        <span className="tasks__avatar">
                          <ClipboardList size={18} />
                        </span>

                        <div>
                          <strong>{task.title}</strong>
                          <small>
                            {task.description ||
                              "No description"}
                          </small>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="tasks__reference">
                        <FolderKanban size={14} />
                        {task.projectName || "—"}
                      </span>
                    </td>

                    <td>
                      <span className="tasks__reference">
                        <UserRound size={14} />
                        {task.assignedTo || "Unassigned"}
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
                        <span
                          className={
                            overdue
                              ? "tasks__due-date tasks__due-date--overdue"
                              : "tasks__due-date"
                          }
                        >
                          <CalendarDays size={14} />
                          {formatDate(task.dueDate)}
                        </span>

                        {overdue && (
                          <small>Overdue</small>
                        )}
                      </div>
                    </td>

                    <td>
                      <div className="tasks__progress">
                        <span>{task.progress}%</span>
                        <div className="tasks__progress-track">
                          <span
                            style={{
                              width: `${task.progress}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`tasks__badge tasks__badge--${getStatusClass(
                          task.status
                        )}`}
                      >
                        {task.status}
                      </span>
                    </td>

                    <td>
                      <div className="tasks__actions">
                        <button
                          type="button"
                          title="View details"
                          aria-label={`View ${task.title}`}
                          onClick={() =>
                            setViewingTaskId(task.id)
                          }
                        >
                          <Eye size={16} />
                        </button>

                        <button
                          type="button"
                          title="Edit task"
                          aria-label={`Edit ${task.title}`}
                          onClick={() => {
                            setEditingTask(task);
                            setModalOpen(true);
                          }}
                        >
                          <Pencil size={16} />
                        </button>

                        {task.status !== "Cancelled" && (
                          <button
                            type="button"
                            title={
                              task.status === "Completed"
                                ? "Reopen task"
                                : "Mark completed"
                            }
                            aria-label={
                              task.status === "Completed"
                                ? `Reopen ${task.title}`
                                : `Complete ${task.title}`
                            }
                            onClick={() =>
                              markCompleted(task)
                            }
                          >
                            {task.status === "Completed" ? (
                              <RotateCcw size={16} />
                            ) : (
                              <CheckCircle2 size={16} />
                            )}
                          </button>
                        )}

                        <button
                          type="button"
                          className="tasks__delete"
                          title="Delete task"
                          aria-label={`Delete ${task.title}`}
                          onClick={() =>
                            deleteTask(task)
                          }
                        >
                          <Trash2 size={16} />
                        </button>
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
                      <h3>No tasks found</h3>
                      <p>
                        {tasks.length === 0
                          ? "Create your first task to start tracking work."
                          : "Try adjusting your filters or search."}
                      </p>

                      {tasks.length === 0 && (
                        <button
                          type="button"
                          className="tasks__button tasks__button--primary"
                          onClick={() => {
                            setEditingTask(null);
                            setModalOpen(true);
                          }}
                        >
                          <Plus size={16} />
                          Create Task
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="tasks__table-footer">
          Showing {filteredTasks.length} of{" "}
          {tasks.length} tasks
        </div>
      </section>

      {modalOpen && (
        <TaskModal
          task={editingTask}
          employees={employees}
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
          onClose={() => setViewingTaskId(null)}
          onEdit={() => {
            setEditingTask(viewingTask);
            setViewingTaskId(null);
            setModalOpen(true);
          }}
        />
      )}
    </div>
  );
}
