
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Filter,
  FolderKanban,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  IndianRupee,
  Pencil,
  Trash2,
  X,
  CalendarDays,
  UserRound,
  Building2,
  Clock3,
  Layers3,
  RefreshCw,
} from "lucide-react";

import { projectApi } from "../../services/projectApi.js";
import "./Projects.scss";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

const PAGE_SIZE = 10;
const OBJECT_ID = /^[a-f\d]{24}$/i;

const STATUSES = [
  "Planning",
  "In Progress",
  "On Hold",
  "In Review",
  "Completed",
  "Cancelled",
];

const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

const PROJECT_TYPES = [
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
  description: "",
  client: "",
  type: "Website Development",
  priority: "Medium",
  projectManager: "",
  assignedTo: [],
  startDate: "",
  deadline: "",
  budget: "",
  progress: "0",
  repositoryUrl: "",
  liveUrl: "",
  notes: "",
};

const getId = (value) =>
  typeof value === "string"
    ? value
    : value?._id || value?.id || "";

const formatMoney = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const dateOnly = (value) =>
  value ? String(value).slice(0, 10) : "";

const toISODate = (value) =>
  value ? `${value}T00:00:00.000Z` : null;

const formatDate = (value) => {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
};

const getToday = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const isOverdue = (project) =>
  Boolean(
    project.deadline &&
      dateOnly(project.deadline) < getToday() &&
      !["Completed", "Cancelled"].includes(project.status)
  );

const classSuffix = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");

const errorMessage = (error) => {
  const details = error?.details;

  if (Array.isArray(details) && details.length > 0) {
    return details
      .map((item) => item.message)
      .filter(Boolean)
      .join(", ");
  }

  return error?.message || "Something went wrong.";
};

const isValidUrl = (value) => {
  if (!value) return true;

  try {
    const url = new URL(value);

    return (
      ["http:", "https:"].includes(url.protocol) &&
      url.hostname.includes(".")
    );
  } catch {
    return false;
  }
};

async function getOptions(path, signal) {
  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "GET",
      credentials: "include",
      signal,
      headers: {
        Accept: "application/json",
      },
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;

    throw new Error("Unable to connect to backend.");
  }

  const result = await response.json().catch(() => null);

  if (!response.ok || result?.success !== true) {
    throw new Error(
      result?.message || `Request failed (${response.status})`
    );
  }

  return result;
}

async function getAllOptions(path, key, signal) {
  const all = [];
  let page = 1;

  while (true) {
    const query = new URLSearchParams({
      page: String(page),
      limit: "100",
    });

    const response = await getOptions(
      `${path}?${query.toString()}`,
      signal
    );

    const records = Array.isArray(response[key])
      ? response[key]
      : [];

    all.push(...records);

    const totalPages = Number(response.pagination?.totalPages || 1);

    if (page >= totalPages || records.length === 0) {
      break;
    }

    page += 1;
  }

  return all;
}

function ProjectModal({ project, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    ...(project
      ? {
          name: project.name || "",
          description: project.description || "",
          client: getId(project.client),
          type: project.type || PROJECT_TYPES[0],
          priority: project.priority || "Medium",
          projectManager: getId(project.projectManager),
          assignedTo: Array.isArray(project.assignedTo)
            ? project.assignedTo.map(getId).filter(Boolean)
            : [],
          startDate: dateOnly(project.startDate),
          deadline: dateOnly(project.deadline),
          budget: String(project.budget ?? 0),
          progress: String(project.progress ?? 0),
          repositoryUrl: project.repositoryUrl || "",
          liveUrl: project.liveUrl || "",
          notes: project.notes || "",
        }
      : {}),
  }));

  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        setLoadingOptions(true);
        setOptionsError("");

        const [clientList, employeeList] = await Promise.all([
          getAllOptions("/clients", "clients", controller.signal),
          getAllOptions("/employees", "employees", controller.signal),
        ]);

        if (controller.signal.aborted) return;

        setClients(clientList);
        setEmployees(
          employeeList.filter(
            (employee) =>
              employee.user &&
              employee.status === "Active" &&
              employee.user.isActive !== false
          )
        );
      } catch (err) {
        if (!controller.signal.aborted) {
          setOptionsError(errorMessage(err));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingOptions(false);
        }
      }
    };

    void load();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape" && !saving) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () =>
      document.removeEventListener("keydown", handleEscape);
  }, [onClose, saving]);

  const change = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
  };

  const toggleAssignment = (userId, checked) => {
    setForm((previous) => ({
      ...previous,
      assignedTo: checked
        ? [...new Set([...previous.assignedTo, userId])]
        : previous.assignedTo.filter((id) => id !== userId),
    }));
  };

  const submit = async (event) => {
    event.preventDefault();

    if (saving || loadingOptions) return;

    const name = form.name.trim();
    const progress = Number(form.progress);
    const budget = Number(form.budget || 0);

    if (name.length < 3 || name.length > 200) {
      setError("Project name must contain 3–200 characters.");
      return;
    }

    if (!OBJECT_ID.test(form.client)) {
      setError("Select a valid client.");
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
      !Number.isFinite(budget) ||
      budget < 0 ||
      budget > 999999999999
    ) {
      setError("Enter a valid project budget.");
      return;
    }

    if (
      form.startDate &&
      form.deadline &&
      form.deadline < form.startDate
    ) {
      setError("Deadline cannot be earlier than start date.");
      return;
    }

    if (
      !isValidUrl(form.repositoryUrl.trim()) ||
      !isValidUrl(form.liveUrl.trim())
    ) {
      setError("Repository and live URLs must be valid HTTP(S) URLs.");
      return;
    }

    if (form.assignedTo.length > 100) {
      setError("Maximum 100 employees can be assigned.");
      return;
    }

    if (optionsError) {
      setError(optionsError);
      return;
    }

    const payload = {
      name,
      description: form.description.trim(),
      client: form.client,
      type: form.type,
      priority: form.priority,
      projectManager: form.projectManager || null,
      assignedTo: form.assignedTo,
      startDate: toISODate(form.startDate),
      deadline: toISODate(form.deadline),
      budget,
      progress,
      repositoryUrl: form.repositoryUrl.trim(),
      liveUrl: form.liveUrl.trim(),
      notes: form.notes.trim(),
    };

    try {
      setSaving(true);
      setError("");

      await onSave(payload);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="projects__modal-backdrop"
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
        className="projects__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-modal-title"
      >
        <div className="projects__modal-header">
          <div>
            <h2 id="project-modal-title">
              {project ? "Edit Project" : "Create New Project"}
            </h2>
            <p>Manage project details and team assignments.</p>
          </div>

          <button
            type="button"
            className="projects__icon-button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close project form"
          >
            <X size={20} />
          </button>
        </div>

        <form className="projects__form" onSubmit={submit}>
          <div className="projects__form-grid">
            <label className="projects__form-full">
              Project Name *
              <input
                name="name"
                value={form.name}
                onChange={change}
                placeholder="Project name"
                minLength={3}
                maxLength={200}
                required
              />
            </label>

            <label>
              Client *
              <select
                name="client"
                value={form.client}
                onChange={change}
                disabled={loadingOptions || Boolean(optionsError)}
                required
              >
                <option value="">Select client</option>

                {clients.map((client) => (
                  <option key={getId(client)} value={getId(client)}>
                    {client.name}
                  </option>
                ))}

                {form.client &&
                  !clients.some(
                    (client) => getId(client) === form.client
                  ) && (
                    <option value={form.client}>
                      Previously selected client
                    </option>
                  )}
              </select>
            </label>

            <label>
              Project Type
              <select
                name="type"
                value={form.type}
                onChange={change}
              >
                {PROJECT_TYPES.map((type) => (
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
                onChange={change}
              >
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Project Manager
              <select
                name="projectManager"
                value={form.projectManager}
                onChange={change}
                disabled={loadingOptions || Boolean(optionsError)}
              >
                <option value="">No manager assigned</option>

                {employees
                  .filter((employee) =>
                    ["admin", "manager"].includes(
                      employee.user?.role
                    )
                  )
                  .map((employee) => (
                    <option
                      key={getId(employee.user)}
                      value={getId(employee.user)}
                    >
                      {employee.user.name}
                    </option>
                  ))}

                {form.projectManager &&
                  !employees.some(
                    (employee) =>
                      getId(employee.user) === form.projectManager
                  ) && (
                    <option value={form.projectManager}>
                      Previously selected manager
                    </option>
                  )}
              </select>
            </label>

            <label className="projects__form-full">
              Assigned Employees
              <div
                style={{
                  maxHeight: 170,
                  overflowY: "auto",
                  padding: "8px 0",
                }}
              >
                {employees.map((employee) => {
                  const userId = getId(employee.user);

                  if (!userId) return null;

                  return (
                    <label
                      key={userId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={form.assignedTo.includes(userId)}
                        onChange={(event) =>
                          toggleAssignment(
                            userId,
                            event.target.checked
                          )
                        }
                        style={{ width: "auto" }}
                      />

                      <span>
                        {employee.user.name ||
                          employee.user.email}
                      </span>
                    </label>
                  );
                })}

                {!loadingOptions && employees.length === 0 && (
                  <small>No active employees available.</small>
                )}
              </div>
            </label>

            <label>
              Project Budget (₹)
              <input
                name="budget"
                type="number"
                min="0"
                max="999999999999"
                step="0.01"
                value={form.budget}
                onChange={change}
              />
            </label>

            <label>
              Progress (%)
              <input
                name="progress"
                type="number"
                min="0"
                max="100"
                step="1"
                value={form.progress}
                onChange={change}
                required
              />
            </label>

            <label>
              Start Date
              <input
                name="startDate"
                type="date"
                value={form.startDate}
                onChange={change}
              />
            </label>

            <label>
              Deadline
              <input
                name="deadline"
                type="date"
                value={form.deadline}
                onChange={change}
              />
            </label>

            <label className="projects__form-full">
              Repository URL
              <input
                name="repositoryUrl"
                type="url"
                value={form.repositoryUrl}
                onChange={change}
                placeholder="https://github.com/..."
                maxLength={2048}
              />
            </label>

            <label className="projects__form-full">
              Live Website URL
              <input
                name="liveUrl"
                type="url"
                value={form.liveUrl}
                onChange={change}
                placeholder="https://example.com"
                maxLength={2048}
              />
            </label>

            <label className="projects__form-full">
              Description
              <textarea
                name="description"
                value={form.description}
                onChange={change}
                rows={3}
                maxLength={5000}
              />
            </label>

            <label className="projects__form-full">
              Internal Notes
              <textarea
                name="notes"
                value={form.notes}
                onChange={change}
                rows={3}
                maxLength={5000}
              />
            </label>
          </div>

          {optionsError && (
            <p className="projects__form-error" role="alert">
              {optionsError}
            </p>
          )}

          {error && (
            <p className="projects__form-error" role="alert">
              {error}
            </p>
          )}

          <div className="projects__modal-actions">
            <button
              type="button"
              className="projects__button projects__button--secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="projects__button projects__button--primary"
              disabled={
                saving ||
                loadingOptions ||
                Boolean(optionsError)
              }
            >
              {saving
                ? "Saving..."
                : project
                  ? "Save Changes"
                  : "Create Project"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function Projects({ user }) {
  const canManage =
    user?.role === "admin" ||
    user?.role === "manager";

  const canDelete = user?.role === "admin";

  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 0,
  });

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((previous) => previous + 1);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadProjects() {
      try {
        setLoading(true);
        setError("");

        const response = await projectApi.getAll({
          page,
          limit: PAGE_SIZE,
          search: search.trim(),
          status:
            statusFilter === "All" ? "" : statusFilter,
          priority:
            priorityFilter === "All" ? "" : priorityFilter,
        });

        if (!active) return;

        setProjects(
          Array.isArray(response.projects)
            ? response.projects
            : []
        );

        setPagination(
          response.pagination || {
            total: 0,
            totalPages: 0,
          }
        );
      } catch (err) {
        if (active) {
          setError(errorMessage(err));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProjects();

    return () => {
      active = false;
    };
  }, [
    page,
    search,
    statusFilter,
    priorityFilter,
    refreshKey,
  ]);

  useEffect(() => {
    let active = true;

    async function loadStats() {
      try {
        const response = await projectApi.getStats();

        if (active) {
          setStats(response.stats || null);
        }
      } catch (err) {
        if (active) {
          setError(errorMessage(err));
        }
      }
    }

    void loadStats();

    return () => {
      active = false;
    };
  }, [refreshKey]);

  const cards = useMemo(
    () => [
      {
        label: "Total Projects",
        value: stats?.total ?? "—",
        icon: FolderKanban,
      },
      {
        label: "In Progress",
        value: stats?.inProgress ?? "—",
        icon: PlayCircle,
      },
      {
        label: "Completed",
        value: stats?.completed ?? "—",
        icon: CheckCircle2,
      },
      {
        label: "Overdue",
        value: stats?.overdue ?? "—",
        icon: AlertTriangle,
      },
      {
        label: "Total Budget",
        value: stats
          ? formatMoney(stats.totalBudget)
          : "—",
        icon: IndianRupee,
      },
    ],
    [stats]
  );

  const openCreate = () => {
    if (!canManage || busyId) return;

    setEditingProject(null);
    setModalOpen(true);
  };

  const openEdit = (project) => {
    if (!canManage || busyId) return;

    setEditingProject(project);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingProject(null);
  };

  const saveProject = async (payload) => {
    if (!canManage) {
      throw new Error("Admin or Manager access required.");
    }

    if (editingProject) {
      await projectApi.update(
        getId(editingProject),
        payload
      );
    } else {
      await projectApi.create(payload);
    }

    closeModal();
    refresh();
  };

  const changeStatus = async (project, status) => {
    if (
      !canManage ||
      busyId ||
      project.status === status
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Change "${project.name}" status to "${status}"?`
    );

    if (!confirmed) return;

    try {
      setBusyId(getId(project));
      setError("");

      await projectApi.updateStatus(
        getId(project),
        status
      );

      refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId("");
    }
  };

  const deleteProject = async (project) => {
    if (!canDelete || busyId) return;

    const confirmed = window.confirm(
      `Permanently delete "${project.name}"? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setBusyId(getId(project));
      setError("");

      await projectApi.remove(getId(project));

      if (projects.length === 1 && page > 1) {
        setPage((previous) => previous - 1);
      } else {
        refresh();
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="projects">
      <div className="projects__header">
        <div>
          <span className="projects__eyebrow">
            DELIVERY MANAGEMENT
          </span>

          <h1>Project Management</h1>

          <p>
            Manage projects, team assignments,
            deadlines and delivery progress.
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            className="projects__button projects__button--primary"
            onClick={openCreate}
            disabled={Boolean(busyId)}
          >
            <Plus size={18} />
            New Project
          </button>
        )}
      </div>

      {error && (
        <div className="projects__error" role="alert">
          <span>{error}</span>

          <button type="button" onClick={refresh}>
            <RefreshCw size={15} />
            Retry
          </button>
        </div>
      )}

      <div className="projects__stats">
        {cards.map(({ label, value, icon: Icon }) => (
          <div className="projects__stat" key={label}>
            <Icon size={21} />
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <section className="projects__panel">
        <div className="projects__panel-heading">
          <div>
            <h2>
              <Layers3 size={19} />
              All Projects
            </h2>

            <p>
              Track your ongoing and completed projects.
            </p>
          </div>
        </div>

        <div className="projects__toolbar">
          <div className="projects__search">
            <Search size={18} />

            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search projects..."
              aria-label="Search projects"
            />
          </div>

          <div className="projects__filters">
            <Filter size={17} />

            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              aria-label="Filter by status"
            >
              <option value="All">All Statuses</option>

              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(event) => {
                setPriorityFilter(event.target.value);
                setPage(1);
              }}
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

        <div className="projects__table-wrap">
          <table className="projects__table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Client</th>
                <th>Assigned To</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Progress</th>
                <th>Deadline</th>
                <th>Budget</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {!loading &&
                projects.map((project) => {
                  const projectId = getId(project);
                  const overdue = isOverdue(project);

                  const progress = Math.max(
                    0,
                    Math.min(
                      100,
                      Number(project.progress) || 0
                    )
                  );

                  const assignedNames = Array.isArray(
                    project.assignedTo
                  )
                    ? project.assignedTo
                        .map((employee) =>
                          typeof employee === "object"
                            ? employee.name ||
                              employee.email ||
                              "Employee"
                            : "Employee"
                        )
                        .join(", ")
                    : "";

                  return (
                    <tr key={projectId}>
                      <td>
                        <div className="projects__identity">
                          <span className="projects__avatar">
                            <FolderKanban size={18} />
                          </span>

                          <div>
                            <strong>{project.name}</strong>
                            <small>{project.type}</small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="projects__client">
                          <strong>
                            {project.client?.name ||
                              "Unknown client"}
                          </strong>

                          {project.client?.company && (
                            <small>
                              <Building2 size={12} />
                              {project.client.company}
                            </small>
                          )}
                        </div>
                      </td>

                      <td>
                        <span className="projects__employee">
                          <UserRound size={14} />
                          {assignedNames || "Unassigned"}
                        </span>
                      </td>

                      <td>
                        {canManage ? (
                          <select
                            className={`projects__badge projects__badge--${classSuffix(
                              project.status
                            )}`}
                            value={project.status}
                            disabled={Boolean(busyId)}
                            onChange={(event) =>
                              void changeStatus(
                                project,
                                event.target.value
                              )
                            }
                            aria-label={`Status of ${project.name}`}
                          >
                            {STATUSES.map((status) => (
                              <option
                                key={status}
                                value={status}
                              >
                                {status}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className={`projects__badge projects__badge--${classSuffix(
                              project.status
                            )}`}
                          >
                            {project.status}
                          </span>
                        )}
                      </td>

                      <td>
                        <span
                          className={`projects__priority projects__priority--${classSuffix(
                            project.priority
                          )}`}
                        >
                          {project.priority}
                        </span>
                      </td>

                      <td>
                        <div className="projects__progress">
                          <div className="projects__progress-heading">
                            <span>{progress}%</span>
                          </div>

                          <div
                            className="projects__progress-track"
                            role="progressbar"
                            aria-label={`${project.name} progress`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={progress}
                          >
                            <span
                              style={{
                                width: `${progress}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`projects__date ${
                            overdue
                              ? "projects__date--overdue"
                              : ""
                          }`}
                        >
                          {overdue ? (
                            <Clock3 size={14} />
                          ) : (
                            <CalendarDays size={14} />
                          )}

                          {formatDate(project.deadline)}
                        </span>

                        {overdue && (
                          <small className="projects__overdue">
                            Overdue
                          </small>
                        )}
                      </td>

                      <td className="projects__amount">
                        {formatMoney(project.budget)}
                      </td>

                      <td>
                        {canManage && (
                          <div className="projects__actions">
                            <button
                              type="button"
                              onClick={() => openEdit(project)}
                              disabled={Boolean(busyId)}
                              title="Edit project"
                              aria-label={`Edit ${project.name}`}
                            >
                              <Pencil size={16} />
                            </button>

                            {canDelete && (
                              <button
                                type="button"
                                className="projects__delete"
                                onClick={() =>
                                  void deleteProject(project)
                                }
                                disabled={Boolean(busyId)}
                                title="Delete project"
                                aria-label={`Delete ${project.name}`}
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}

              {loading && (
                <tr>
                  <td colSpan={9}>
                    <div className="projects__empty">
                      Loading projects...
                    </div>
                  </td>
                </tr>
              )}

              {!loading && projects.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <div className="projects__empty">
                      <FolderKanban size={36} />

                      <h3>No projects found</h3>

                      <p>
                        Try changing filters or create
                        your first project.
                      </p>

                      {canManage && (
                        <button
                          type="button"
                          className="projects__button projects__button--primary"
                          onClick={openCreate}
                        >
                          <Plus size={16} />
                          Create Project
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="projects__table-footer">
          <span>
            Showing {projects.length} of{" "}
            {pagination.total || 0} projects
          </span>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() =>
                setPage((previous) => previous - 1)
              }
            >
              Previous
            </button>

            <span>
              Page {page} of{" "}
              {Math.max(
                1,
                pagination.totalPages || 0
              )}
            </span>

            <button
              type="button"
              disabled={
                loading ||
                page >= pagination.totalPages
              }
              onClick={() =>
                setPage((previous) => previous + 1)
              }
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {canManage && modalOpen && (
        <ProjectModal
          project={editingProject}
          onClose={closeModal}
          onSave={saveProject}
        />
      )}
    </div>
  );
}
