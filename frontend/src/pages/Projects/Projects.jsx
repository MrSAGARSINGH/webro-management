
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

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
} from "lucide-react";

import { projectApi } from "../../services/projectApi.js";
import { employeeApi } from "../../services/employeeApi.js";

import "./Projects.scss";

// ======================================
// Constants
// ======================================

const STATUSES = [
  "Planning",
  "In Progress",
  "On Hold",
  "In Review",
  "Completed",
  "Cancelled",
];

const PRIORITIES = [
  "Low",
  "Medium",
  "High",
  "Urgent",
];

const SERVICES = [
  "Website Development",
  "E-commerce Development",
  "Web Application",
  "SEO",
  "Website Maintenance",
  "Branding",
  "Other",
];

const PAGE_SIZE = 100;

const EMPTY_FORM = {
  name: "",
  client: "",
  service: "Website Development",
  assignedTo: "",
  status: "Planning",
  priority: "Medium",
  progress: "0",
  budget: "",
  startDate: "",
  deadline: "",
  description: "",
};

// ======================================
// Helpers
// ======================================

const getId = (value) => {
  if (typeof value === "string") return value;

  return value?._id || value?.id || "";
};

const getErrorMessage = (error) =>
  error instanceof Error
    ? error.message
    : "Something went wrong.";

const currency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const pad = (value) =>
  String(value).padStart(2, "0");

function todayKey() {
  const date = new Date();

  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}`;
}

function dateKey(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function toISO(value) {
  return value
    ? `${value}T00:00:00.000Z`
    : null;
}

function formatDate(value) {
  const key = dateKey(value);

  if (!key) return "Not set";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${key}T00:00:00.000Z`));
}

function isOverdue(project, today) {
  return (
    Boolean(project.deadline) &&
    project.deadline < today &&
    !["Completed", "Cancelled"].includes(
      project.status
    )
  );
}

function statusClass(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function mapProject(project) {
  const client =
    typeof project.client === "object"
      ? project.client
      : null;

  const assigned = Array.isArray(project.assignedTo)
    ? project.assignedTo
    : [];

  return {
    id: getId(project),
    name: project.name || "",
    client: getId(project.client),
    clientName: client?.name || "Unknown Client",
    business: client?.company || "",
    service: project.type || "Other",
    assignedIds: assigned.map(getId),
    assignedTo: assigned
      .map((user) =>
        typeof user === "object"
          ? user.name
          : ""
      )
      .filter(Boolean)
      .join(", "),
    status: project.status || "Planning",
    priority: project.priority || "Medium",
    progress: project.progress ?? 0,
    budget: project.budget ?? 0,
    startDate: dateKey(project.startDate),
    deadline: dateKey(project.deadline),
    description: project.description || "",
    notes: project.notes || "",
    projectManager: getId(project.projectManager),
    repositoryUrl: project.repositoryUrl || "",
    liveUrl: project.liveUrl || "",
    milestones: project.milestones || [],
  };
}

// ======================================
// Read Client Directory
// ======================================

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api"
).replace(/\/+$/, "");

async function getClients() {
  const clients = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await fetch(
      `${API_URL}/clients?page=${page}&limit=${PAGE_SIZE}`,
      {
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      }
    );

    const result = await response
      .json()
      .catch(() => null);

    if (!response.ok || result?.success !== true) {
      throw new Error(
        result?.message ||
          "Unable to load clients."
      );
    }

    clients.push(...(result.clients || []));

    totalPages =
      result.pagination?.totalPages || 1;

    page += 1;
  } while (page <= totalPages);

  return clients;
}

async function getAssignableUsers() {
  const users = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await employeeApi.getUsers({
      page,
      limit: PAGE_SIZE,
      isActive: "true",
    });

    users.push(...(result.users || []));

    totalPages =
      result.pagination?.totalPages || 1;

    page += 1;
  } while (page <= totalPages);

  return users;
}

// ======================================
// Project Modal
// ======================================

function ProjectModal({
  project,
  clients,
  users,
  onClose,
  onSave,
}) {
  const isEditing = Boolean(project);

  const [form, setForm] = useState(() =>
    project
      ? {
          ...EMPTY_FORM,
          ...project,
          assignedTo:
            project.assignedIds?.[0] || "",
          progress: String(project.progress ?? 0),
          budget: String(project.budget ?? ""),
        }
      : {
          ...EMPTY_FORM,
          startDate: todayKey(),
        }
  );

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape" && !saving) {
        onClose();
      }
    };

    document.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [onClose, saving]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saving) return;

    const name = form.name.trim();

    if (name.length < 3) {
      setError(
        "Project name must contain at least 3 characters."
      );
      return;
    }

    if (!form.client) {
      setError("Please select a client.");
      return;
    }

    const progress = Number(form.progress);
    const budget = Number(form.budget || 0);

    if (
      !Number.isInteger(progress) ||
      progress < 0 ||
      progress > 100
    ) {
      setError(
        "Project progress must be between 0 and 100."
      );
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
      setError(
        "Deadline cannot be earlier than start date."
      );
      return;
    }

    if (
      form.status === "Completed" &&
      progress !== 100
    ) {
      setError(
        "Completed projects must have 100% progress."
      );
      return;
    }

    if (
      progress === 100 &&
      form.status !== "Completed"
    ) {
      setError(
        "Set status to Completed when progress reaches 100%."
      );
      return;
    }

    const assignedIds = form.assignedTo
      ? [form.assignedTo]
      : [];

    // Preserve additional assignments when editing.
    // The existing UI exposes only one assignment field.
    const previousIds =
      project?.assignedIds || [];

    const additionalIds = previousIds.filter(
      (id) =>
        id !== form.assignedTo &&
        id !== previousIds[0]
    );

    const payload = {
      name,
      client: form.client,
      type: form.service,
      priority: form.priority,
      assignedTo: [
        ...new Set([
          ...assignedIds,
          ...additionalIds,
        ]),
      ],
      progress,
      budget,
      startDate: toISO(form.startDate),
      deadline: toISO(form.deadline),
      description: form.description.trim(),
    };

    try {
      setSaving(true);
      setError("");

      await onSave({
        payload,
        status: form.status,
      });
    } catch (err) {
      setError(getErrorMessage(err));
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
              {isEditing
                ? "Edit Project"
                : "Create New Project"}
            </h2>

            <p>
              Manage project delivery and ownership.
            </p>
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

        <form
          className="projects__form"
          onSubmit={handleSubmit}
        >
          <div className="projects__form-grid">
            <label className="projects__form-full">
              Project Name *
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Restaurant Website Development"
                maxLength={200}
                required
              />
            </label>

            <label>
              Client Name *
              <select
                name="client"
                value={form.client}
                onChange={handleChange}
                required
              >
                <option value="">
                  Select Client
                </option>

                {clients.map((client) => (
                  <option
                    key={getId(client)}
                    value={getId(client)}
                  >
                    {client.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Business / Company
              <input
                value={
                  clients.find(
                    (client) =>
                      getId(client) === form.client
                  )?.company || ""
                }
                placeholder="Business name"
                readOnly
              />
            </label>

            <label>
              Service
              <select
                name="service"
                value={form.service}
                onChange={handleChange}
              >
                {SERVICES.map((service) => (
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
              Assigned Employee
              <select
                name="assignedTo"
                value={form.assignedTo}
                onChange={handleChange}
              >
                <option value="">
                  Unassigned
                </option>

                {users
                  .filter(
                    (user) =>
                      user.role === "employee" ||
                      user.role === "manager"
                  )
                  .map((user) => (
                    <option
                      key={getId(user)}
                      value={getId(user)}
                    >
                      {user.name}
                    </option>
                  ))}
              </select>
            </label>

            <label>
              Project Status
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                disabled={!isEditing}
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
            </label>

            <label>
              Priority
              <select
                name="priority"
                value={form.priority}
                onChange={handleChange}
              >
                {PRIORITIES.map((priority) => (
                  <option
                    key={priority}
                    value={priority}
                  >
                    {priority}
                  </option>
                ))}
              </select>
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
                onChange={handleChange}
                required
              />
            </label>

            <label>
              Project Budget (₹)
              <input
                name="budget"
                type="number"
                min="0"
                max="999999999999"
                step="1"
                value={form.budget}
                onChange={handleChange}
                placeholder="30000"
              />
            </label>

            <label>
              Start Date
              <input
                name="startDate"
                type="date"
                value={form.startDate}
                onChange={handleChange}
              />
            </label>

            <label>
              Deadline
              <input
                name="deadline"
                type="date"
                value={form.deadline}
                onChange={handleChange}
              />
            </label>

            <label className="projects__form-full">
              Project Description
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Scope, requirements, deliverables and milestones..."
                rows={4}
                maxLength={5000}
              />
            </label>
          </div>

          {clients.length === 0 && (
            <p
              className="projects__form-error"
              role="status"
            >
              No clients found. Create a client
              before creating a project.
            </p>
          )}

          {error && (
            <p
              className="projects__form-error"
              role="alert"
            >
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
                clients.length === 0
              }
            >
              {saving
                ? "Saving..."
                : isEditing
                  ? "Save Changes"
                  : "Create Project"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

// ======================================
// Projects Page
// ======================================

export default function Projects() {
  const [projects, setProjects] =
    useState([]);

  const [clients, setClients] =
    useState([]);

  const [users, setUsers] =
    useState([]);

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("All");

  const [priorityFilter, setPriorityFilter] =
    useState("All");

  const [modalOpen, setModalOpen] =
    useState(false);

  const [editingProject, setEditingProject] =
    useState(null);

  const [storageError, setStorageError] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [busy, setBusy] =
    useState(false);

  const [today, setToday] =
    useState(todayKey);

  const [refreshKey, setRefreshKey] =
    useState(0);

  const refreshProjects = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  // ====================================
  // Load Projects from MongoDB
  // ====================================

  useEffect(() => {
    let cancelled = false;

    const loadProjects = async () => {
      try {
        setLoading(true);
        setStorageError("");

        const allProjects = [];
        let page = 1;
        let totalPages = 1;

        do {
          const result = await projectApi.getAll({
            page,
            limit: PAGE_SIZE,
          });

          if (cancelled) return;

          allProjects.push(
            ...(result.projects || [])
          );

          totalPages =
            result.pagination?.totalPages || 1;

          page += 1;
        } while (page <= totalPages);

        if (!cancelled) {
          setProjects(
            allProjects.map(mapProject)
          );
        }
      } catch (err) {
        if (!cancelled) {
          setStorageError(
            getErrorMessage(err)
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadProjects();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // ====================================
  // Update Today
  // ====================================

  useEffect(() => {
    const refresh = () =>
      setToday(todayKey());

    const interval = window.setInterval(
      refresh,
      60_000
    );

    window.addEventListener(
      "focus",
      refresh
    );

    return () => {
      window.clearInterval(interval);
      window.removeEventListener(
        "focus",
        refresh
      );
    };
  }, []);

  // ====================================
  // Load Form Dependencies
  // ====================================

  const loadFormData = async () => {
    const [clientData, userData] =
      await Promise.all([
        getClients(),
        getAssignableUsers(),
      ]);

    setClients(clientData);
    setUsers(userData);
  };

  const openAdd = async () => {
    if (busy) return;

    try {
      setBusy(true);
      setStorageError("");

      await loadFormData();

      setEditingProject(null);
      setModalOpen(true);
    } catch (err) {
      setStorageError(
        getErrorMessage(err)
      );
    } finally {
      setBusy(false);
    }
  };

  const openEdit = async (project) => {
    if (busy) return;

    try {
      setBusy(true);
      setStorageError("");

      await loadFormData();

      setEditingProject(project);
      setModalOpen(true);
    } catch (err) {
      setStorageError(
        getErrorMessage(err)
      );
    } finally {
      setBusy(false);
    }
  };

  const closeModal = () => {
    if (busy) return;

    setModalOpen(false);
    setEditingProject(null);
  };

  // ====================================
  // Create / Update Project
  // ====================================

  const saveProject = async ({
    payload,
    status,
  }) => {
    setBusy(true);

    try {
      if (editingProject) {
        const id = editingProject.id;

        await projectApi.update(
          id,
          payload
        );

        if (
          status !== editingProject.status
        ) {
          await projectApi.updateStatus(
            id,
            status
          );
        }
      } else {
        await projectApi.create({
          ...payload,
          projectManager: null,
          milestones: [],
          repositoryUrl: "",
          liveUrl: "",
          notes: "",
        });
      }

      setModalOpen(false);
      setEditingProject(null);
      refreshProjects();
    } catch (err) {
      refreshProjects();
      throw err;
    } finally {
      setBusy(false);
    }
  };

  // ====================================
  // Delete Project
  // ====================================

  const deleteProject = async (project) => {
    if (
      !window.confirm(
        `Delete project "${project.name}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      setBusy(true);
      setStorageError("");

      await projectApi.remove(project.id);

      refreshProjects();
    } catch (err) {
      setStorageError(
        getErrorMessage(err)
      );
    } finally {
      setBusy(false);
    }
  };

  // ====================================
  // Statistics
  // ====================================

  const stats = useMemo(() => {
    return {
      total: projects.length,

      active: projects.filter(
        (project) =>
          project.status === "In Progress"
      ).length,

      completed: projects.filter(
        (project) =>
          project.status === "Completed"
      ).length,

      overdue: projects.filter(
        (project) =>
          isOverdue(project, today)
      ).length,

      budget: projects
        .filter(
          (project) =>
            project.status !== "Cancelled"
        )
        .reduce(
          (sum, project) =>
            sum +
            (Number(project.budget) || 0),
          0
        ),
    };
  }, [projects, today]);

  // ====================================
  // Search and Filters
  // ====================================

  const filteredProjects = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return projects
      .filter((project) => {
        const matchesSearch = [
          project.name,
          project.clientName,
          project.business,
          project.service,
          project.assignedTo,
          project.description,
        ].some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(query)
        );

        return (
          matchesSearch &&
          (statusFilter === "All" ||
            project.status === statusFilter) &&
          (priorityFilter === "All" ||
            project.priority === priorityFilter)
        );
      })
      .sort((a, b) => {
        const aOverdue = isOverdue(a, today);
        const bOverdue = isOverdue(b, today);

        if (aOverdue !== bOverdue) {
          return aOverdue ? -1 : 1;
        }

        const aDeadline =
          a.deadline || "9999-12-31";

        const bDeadline =
          b.deadline || "9999-12-31";

        return aDeadline.localeCompare(
          bDeadline
        );
      });
  }, [
    projects,
    search,
    statusFilter,
    priorityFilter,
    today,
  ]);

  // ====================================
  // Dashboard Cards
  // ====================================

  const cards = [
    {
      label: "Total Projects",
      value: stats.total,
      icon: FolderKanban,
    },
    {
      label: "In Progress",
      value: stats.active,
      icon: PlayCircle,
    },
    {
      label: "Completed",
      value: stats.completed,
      icon: CheckCircle2,
    },
    {
      label: "Overdue Projects",
      value: stats.overdue,
      icon: AlertTriangle,
    },
    {
      label: "Total Project Budget",
      value: currency(stats.budget),
      icon: IndianRupee,
    },
  ];

  // ====================================
  // Existing UI
  // ====================================

  return (
    <div className="projects">
      <div className="projects__header">
        <div>
          <span className="projects__eyebrow">
            DELIVERY MANAGEMENT
          </span>

          <h1>Project Management</h1>

          <p>
            Monitor project delivery,
            ownership, deadlines and budgets.
          </p>
        </div>

        <button
          type="button"
          className="projects__button projects__button--primary"
          onClick={() => {
            void openAdd();
          }}
          disabled={busy}
        >
          <Plus size={18} />
          New Project
        </button>
      </div>

      {storageError && (
        <div
          className="projects__error"
          role="alert"
        >
          {storageError}
        </div>
      )}

      <div className="projects__stats">
        {cards.map(
          ({ label, value, icon: Icon }) => (
            <div
              className="projects__stat"
              key={label}
            >
              <Icon size={21} />
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          )
        )}
      </div>

      <section className="projects__panel">
        <div className="projects__panel-heading">
          <div>
            <h2>
              <Layers3 size={19} />
              All Projects
            </h2>

            <p>
              Manage active and completed
              project work.
            </p>
          </div>
        </div>

        <div className="projects__toolbar">
          <div className="projects__search">
            <Search size={18} />

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search project, client, employee..."
              aria-label="Search projects"
            />
          </div>

          <div className="projects__filters">
            <Filter size={17} />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
              aria-label="Filter by project status"
            >
              <option value="All">
                All Statuses
              </option>

              {STATUSES.map((status) => (
                <option
                  key={status}
                  value={status}
                >
                  {status}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(
                  event.target.value
                )
              }
              aria-label="Filter by priority"
            >
              <option value="All">
                All Priorities
              </option>

              {PRIORITIES.map((priority) => (
                <option
                  key={priority}
                  value={priority}
                >
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
              {filteredProjects.map(
                (project) => {
                  const overdue = isOverdue(
                    project,
                    today
                  );

                  const progress = Math.min(
                    100,
                    Math.max(
                      0,
                      Number(project.progress) || 0
                    )
                  );

                  return (
                    <tr key={project.id}>
                      <td>
                        <div className="projects__identity">
                          <span className="projects__avatar">
                            <FolderKanban
                              size={18}
                            />
                          </span>

                          <div>
                            <strong>
                              {project.name}
                            </strong>

                            <small>
                              {project.service}
                            </small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="projects__client">
                          <strong>
                            {project.clientName}
                          </strong>

                          {project.business && (
                            <small>
                              <Building2
                                size={12}
                              />
                              {
                                project.business
                              }
                            </small>
                          )}
                        </div>
                      </td>

                      <td>
                        <span className="projects__employee">
                          <UserRound
                            size={14}
                          />

                          {project.assignedTo ||
                            "Unassigned"}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`projects__badge projects__badge--${statusClass(
                            project.status
                          )}`}
                        >
                          {project.status}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`projects__priority projects__priority--${String(
                            project.priority
                          ).toLowerCase()}`}
                        >
                          {project.priority}
                        </span>
                      </td>

                      <td>
                        <div className="projects__progress">
                          <div className="projects__progress-heading">
                            <span>
                              {progress}%
                            </span>
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
                            <CalendarDays
                              size={14}
                            />
                          )}

                          {formatDate(
                            project.deadline
                          )}
                        </span>

                        {overdue && (
                          <small className="projects__overdue">
                            Overdue
                          </small>
                        )}
                      </td>

                      <td className="projects__amount">
                        {currency(
                          project.budget
                        )}
                      </td>

                      <td>
                        <div className="projects__actions">
                          <button
                            type="button"
                            onClick={() => {
                              void openEdit(
                                project
                              );
                            }}
                            title="Edit project"
                            aria-label={`Edit ${project.name}`}
                            disabled={busy}
                          >
                            <Pencil
                              size={16}
                            />
                          </button>

                          <button
                            type="button"
                            className="projects__delete"
                            onClick={() => {
                              void deleteProject(
                                project
                              );
                            }}
                            title="Delete project"
                            aria-label={`Delete ${project.name}`}
                            disabled={busy}
                          >
                            <Trash2
                              size={16}
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }
              )}

              {filteredProjects.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <div className="projects__empty">
                      <FolderKanban
                        size={36}
                      />

                      <h3>
                        {loading
                          ? "Loading projects..."
                          : "No projects found"}
                      </h3>

                      <p>
                        {loading
                          ? "Fetching projects from the backend."
                          : projects.length === 0
                            ? "Create your first project to get started."
                            : "Try adjusting your search or filters."}
                      </p>

                      {!loading &&
                        projects.length === 0 && (
                          <button
                            type="button"
                            className="projects__button projects__button--primary"
                            onClick={() => {
                              void openAdd();
                            }}
                            disabled={busy}
                          >
                            <Plus
                              size={16}
                            />
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
          Showing{" "}
          {filteredProjects.length} of{" "}
          {projects.length} projects
        </div>
      </section>

      {modalOpen && (
        <ProjectModal
          project={editingProject}
          clients={clients}
          users={users}
          onClose={closeModal}
          onSave={saveProject}
        />
      )}
    </div>
  );
}
