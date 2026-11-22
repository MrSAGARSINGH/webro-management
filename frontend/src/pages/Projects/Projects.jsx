
import { useEffect, useMemo, useState } from "react";
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

import "./Projects.scss";

const STORAGE_KEY = "webro-management-projects-v1";

const STATUSES = [
  "Planning",
  "In Progress",
  "On Hold",
  "Completed",
  "Cancelled",
];

const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

const SERVICES = [
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
  clientName: "",
  business: "",
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

const currency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const pad = (value) => String(value).padStart(2, "0");

function todayKey() {
  const date = new Date();

  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}`;
}

function formatDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "Not set";
  }

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function isOverdue(project, today) {
  return (
    project.deadline &&
    project.deadline < today &&
    !["Completed", "Cancelled"].includes(project.status)
  );
}

function statusClass(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function readProjects() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed)
      ? parsed.filter(
          (project) =>
            project &&
            typeof project === "object" &&
            typeof project.id === "string"
        )
      : [];
  } catch {
    return [];
  }
}

function ProjectModal({ project, onClose, onSave }) {
  const [form, setForm] = useState(() =>
    project
      ? {
          ...EMPTY_FORM,
          ...project,
          progress: String(project.progress ?? 0),
          budget: String(project.budget ?? ""),
        }
      : {
          ...EMPTY_FORM,
          startDate: todayKey(),
        }
  );

  const [error, setError] = useState("");

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
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

    const name = form.name.trim();
    const clientName = form.clientName.trim();
    const assignedTo = form.assignedTo.trim();

    if (!name || !clientName) {
      setError(
        "Project name and client name are required."
      );
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
      budget > 1000000000
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
        "Deadline cannot be earlier than the start date."
      );
      return;
    }

    if (form.status === "Completed" && progress !== 100) {
      setError(
        "Completed projects must have 100% progress."
      );
      return;
    }

    if (progress === 100 && form.status !== "Completed") {
      setError(
        "Set status to Completed when progress reaches 100%."
      );
      return;
    }

    onSave({
      name,
      clientName,
      business: form.business.trim(),
      service: form.service,
      assignedTo,
      status: form.status,
      priority: form.priority,
      progress,
      budget,
      startDate: form.startDate,
      deadline: form.deadline,
      description: form.description.trim(),
    });
  };

  return (
    <div
      className="projects__modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
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

            <p>
              Manage project delivery and ownership.
            </p>
          </div>

          <button
            type="button"
            className="projects__icon-button"
            onClick={onClose}
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
                maxLength={150}
                required
              />
            </label>

            <label>
              Client Name *
              <input
                name="clientName"
                value={form.clientName}
                onChange={handleChange}
                placeholder="Client full name"
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
              Service
              <select
                name="service"
                value={form.service}
                onChange={handleChange}
              >
                {SERVICES.map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Assigned Employee
              <input
                name="assignedTo"
                value={form.assignedTo}
                onChange={handleChange}
                placeholder="Employee name"
                maxLength={100}
              />
            </label>

            <label>
              Project Status
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
                max="1000000000"
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
                maxLength={3000}
              />
            </label>
          </div>

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
            >
              Cancel
            </button>

            <button
              type="submit"
              className="projects__button projects__button--primary"
            >
              {project ? "Save Changes" : "Create Project"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function Projects() {
  const [projects, setProjects] = useState(readProjects);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [storageError, setStorageError] = useState("");
  const [today, setToday] = useState(todayKey);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(projects)
      );

      setStorageError("");
    } catch {
      setStorageError(
        "Unable to save projects in browser storage."
      );
    }
  }, [projects]);

  useEffect(() => {
    const refresh = () => setToday(todayKey());

    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const stats = useMemo(() => {
    return {
      total: projects.length,
      active: projects.filter(
        (project) => project.status === "In Progress"
      ).length,
      completed: projects.filter(
        (project) => project.status === "Completed"
      ).length,
      overdue: projects.filter((project) =>
        isOverdue(project, today)
      ).length,
      budget: projects
        .filter((project) => project.status !== "Cancelled")
        .reduce(
          (sum, project) =>
            sum + (Number(project.budget) || 0),
          0
        ),
    };
  }, [projects, today]);

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();

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

        const aDeadline = a.deadline || "9999-12-31";
        const bDeadline = b.deadline || "9999-12-31";

        return aDeadline.localeCompare(bDeadline);
      });
  }, [projects, search, statusFilter, priorityFilter, today]);

  const openAdd = () => {
    setEditingProject(null);
    setModalOpen(true);
  };

  const openEdit = (project) => {
    setEditingProject(project);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingProject(null);
  };

  const saveProject = (form) => {
    const timestamp = new Date().toISOString();

    if (editingProject) {
      setProjects((previous) =>
        previous.map((project) =>
          project.id === editingProject.id
            ? {
                ...project,
                ...form,
                updatedAt: timestamp,
              }
            : project
        )
      );
    } else {
      setProjects((previous) => [
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

  const deleteProject = (project) => {
    const confirmed = window.confirm(
      `Delete project "${project.name}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    setProjects((previous) =>
      previous.filter((item) => item.id !== project.id)
    );
  };

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

  return (
    <div className="projects">
      {/* HEADER */}

      <div className="projects__header">
        <div>
          <span className="projects__eyebrow">
            DELIVERY MANAGEMENT
          </span>

          <h1>Project Management</h1>

          <p>
            Monitor project delivery, ownership, deadlines
            and budgets.
          </p>
        </div>

        <button
          type="button"
          className="projects__button projects__button--primary"
          onClick={openAdd}
        >
          <Plus size={18} />
          New Project
        </button>
      </div>

      {storageError && (
        <div className="projects__error" role="alert">
          {storageError}
        </div>
      )}

      {/* STATS */}

      <div className="projects__stats">
        {cards.map(({ label, value, icon: Icon }) => (
          <div className="projects__stat" key={label}>
            <Icon size={21} />
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      {/* PROJECT LIST */}

      <section className="projects__panel">
        <div className="projects__panel-heading">
          <div>
            <h2>
              <Layers3 size={19} />
              All Projects
            </h2>

            <p>
              Manage active and completed project work.
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
                setStatusFilter(event.target.value)
              }
              aria-label="Filter by project status"
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
              {filteredProjects.map((project) => {
                const overdue = isOverdue(project, today);
                const progress = Math.min(
                  100,
                  Math.max(0, Number(project.progress) || 0)
                );

                return (
                  <tr key={project.id}>
                    <td>
                      <div className="projects__identity">
                        <span className="projects__avatar">
                          <FolderKanban size={18} />
                        </span>

                        <div>
                          <strong>{project.name}</strong>
                          <small>{project.service}</small>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="projects__client">
                        <strong>{project.clientName}</strong>

                        {project.business && (
                          <small>
                            <Building2 size={12} />
                            {project.business}
                          </small>
                        )}
                      </div>
                    </td>

                    <td>
                      <span className="projects__employee">
                        <UserRound size={14} />
                        {project.assignedTo || "Unassigned"}
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
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`projects__date ${
                          overdue ? "projects__date--overdue" : ""
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
                      {currency(project.budget)}
                    </td>

                    <td>
                      <div className="projects__actions">
                        <button
                          type="button"
                          onClick={() => openEdit(project)}
                          title="Edit project"
                          aria-label={`Edit ${project.name}`}
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          type="button"
                          className="projects__delete"
                          onClick={() => deleteProject(project)}
                          title="Delete project"
                          aria-label={`Delete ${project.name}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredProjects.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <div className="projects__empty">
                      <FolderKanban size={36} />

                      <h3>No projects found</h3>

                      <p>
                        {projects.length === 0
                          ? "Create your first project to get started."
                          : "Try adjusting your search or filters."}
                      </p>

                      {projects.length === 0 && (
                        <button
                          type="button"
                          className="projects__button projects__button--primary"
                          onClick={openAdd}
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
          Showing {filteredProjects.length} of{" "}
          {projects.length} projects
        </div>
      </section>

      {modalOpen && (
        <ProjectModal
          project={editingProject}
          onClose={closeModal}
          onSave={saveProject}
        />
      )}
    </div>
  );
}
