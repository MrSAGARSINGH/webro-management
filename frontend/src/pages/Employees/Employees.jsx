
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Filter,
  Users,
  UserCheck,
  UserX,
  Wallet,
  BriefcaseBusiness,
  Pencil,
  Trash2,
  X,
  Mail,
  Phone,
  CalendarDays,
  Building2,
  ClipboardList,
  UserRound,
} from "lucide-react";

import "./Employees.scss";

const STORAGE_KEY = "webro-management-employees-v1";

const DEPARTMENTS = [
  "Development",
  "Design",
  "Sales",
  "Marketing",
  "Operations",
  "Management",
  "Support",
  "Other",
];

const STATUSES = [
  "Active",
  "On Leave",
  "Inactive",
];

const EMPLOYMENT_TYPES = [
  "Full Time",
  "Part Time",
  "Intern",
  "Contract",
];

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  role: "",
  department: "Development",
  employmentType: "Full Time",
  status: "Active",
  joiningDate: "",
  monthlySalary: "",
  assignedProjects: "",
  assignedTasks: "",
  notes: "",
};

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const todayKey = () => {
  const date = new Date();
  const pad = (number) => String(number).padStart(2, "0");

  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}`;
};

function readEmployees() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed)
      ? parsed.filter(
          (employee) =>
            employee &&
            typeof employee.id === "string" &&
            typeof employee.name === "string"
        )
      : [];
  } catch {
    return [];
  }
}

function EmployeeModal({
  employee,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(() =>
    employee
      ? {
          ...EMPTY_FORM,
          ...employee,
          monthlySalary: String(
            employee.monthlySalary ?? ""
          ),
        }
      : EMPTY_FORM
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
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.replace(/\D/g, "");
    const role = form.role.trim();

    if (!name || !role) {
      setError("Employee name and role are required.");
      return;
    }

    if (
      email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      setError("Enter a valid email address.");
      return;
    }

    if (phone && !/^[6-9]\d{9}$/.test(phone)) {
      setError(
        "Enter a valid 10-digit Indian mobile number."
      );
      return;
    }

    if (
      form.joiningDate &&
      form.joiningDate > todayKey()
    ) {
      setError(
        "Joining date cannot be in the future."
      );
      return;
    }

    const salary =
      form.monthlySalary === ""
        ? 0
        : Number(form.monthlySalary);

    if (
      !Number.isFinite(salary) ||
      salary < 0 ||
      salary > 100000000 ||
      !Number.isInteger(salary * 100)
    ) {
      setError("Enter a valid monthly salary.");
      return;
    }

    const assignedProjects = Number(
      form.assignedProjects || 0
    );

    const assignedTasks = Number(
      form.assignedTasks || 0
    );

    if (
      !Number.isInteger(assignedProjects) ||
      assignedProjects < 0 ||
      !Number.isInteger(assignedTasks) ||
      assignedTasks < 0
    ) {
      setError(
        "Assigned projects and tasks must be non-negative integers."
      );
      return;
    }

    onSave({
      name,
      email,
      phone,
      role,
      department: form.department,
      employmentType: form.employmentType,
      status: form.status,
      joiningDate: form.joiningDate,
      monthlySalary: salary,
      assignedProjects,
      assignedTasks,
      notes: form.notes.trim(),
    });
  };

  return (
    <div
      className="employees__modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="employees__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-modal-title"
      >
        <div className="employees__modal-header">
          <div>
            <h2 id="employee-modal-title">
              {employee
                ? "Edit Employee"
                : "Add New Employee"}
            </h2>
            <p>
              Manage employee details and work assignments.
            </p>
          </div>

          <button
            type="button"
            className="employees__icon-button"
            onClick={onClose}
            aria-label="Close form"
          >
            <X size={20} />
          </button>
        </div>

        <form
          className="employees__form"
          onSubmit={handleSubmit}
        >
          <div className="employees__form-grid">
            <label>
              Full Name *
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                maxLength={100}
                placeholder="Employee name"
                required
              />
            </label>

            <label>
              Job Role *
              <input
                name="role"
                value={form.role}
                onChange={handleChange}
                maxLength={100}
                placeholder="Full Stack Developer"
                required
              />
            </label>

            <label>
              Email Address
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                maxLength={150}
                placeholder="employee@example.com"
              />
            </label>

            <label>
              Mobile Number
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                maxLength={15}
                placeholder="10-digit mobile number"
              />
            </label>

            <label>
              Department
              <select
                name="department"
                value={form.department}
                onChange={handleChange}
              >
                {DEPARTMENTS.map((department) => (
                  <option key={department}>
                    {department}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Employment Type
              <select
                name="employmentType"
                value={form.employmentType}
                onChange={handleChange}
              >
                {EMPLOYMENT_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>

            <label>
              Employment Status
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
              >
                {STATUSES.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>

            <label>
              Joining Date
              <input
                type="date"
                name="joiningDate"
                value={form.joiningDate}
                onChange={handleChange}
                max={todayKey()}
              />
            </label>

            <label>
              Monthly Salary (₹)
              <input
                type="number"
                name="monthlySalary"
                value={form.monthlySalary}
                onChange={handleChange}
                min="0"
                max="100000000"
                step="0.01"
                placeholder="25000"
              />
            </label>

            <label>
              Assigned Projects
              <input
                type="number"
                name="assignedProjects"
                value={form.assignedProjects}
                onChange={handleChange}
                min="0"
                step="1"
                placeholder="0"
              />
            </label>

            <label>
              Assigned Tasks
              <input
                type="number"
                name="assignedTasks"
                value={form.assignedTasks}
                onChange={handleChange}
                min="0"
                step="1"
                placeholder="0"
              />
            </label>

            <label className="employees__form-full">
              Additional Notes
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={3}
                maxLength={2000}
                placeholder="Employee information..."
              />
            </label>
          </div>

          {error && (
            <p
              className="employees__form-error"
              role="alert"
            >
              {error}
            </p>
          )}

          <div className="employees__modal-actions">
            <button
              type="button"
              className="employees__button employees__button--secondary"
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="employees__button employees__button--primary"
            >
              {employee
                ? "Save Changes"
                : "Add Employee"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function Employees() {
  const [employees, setEmployees] =
    useState(readEmployees);

  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] =
    useState("All");
  const [statusFilter, setStatusFilter] =
    useState("All");
  const [editingEmployee, setEditingEmployee] =
    useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [storageError, setStorageError] =
    useState("");

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(employees)
      );
      setStorageError("");
    } catch {
      setStorageError(
        "Unable to save employee records in browser storage."
      );
    }
  }, [employees]);

  const stats = useMemo(() => {
    const active = employees.filter(
      (employee) => employee.status === "Active"
    );

    const onLeave = employees.filter(
      (employee) => employee.status === "On Leave"
    );

    const monthlyPayroll = employees
      .filter(
        (employee) =>
          employee.status !== "Inactive"
      )
      .reduce(
        (sum, employee) =>
          sum +
          (Number(employee.monthlySalary) || 0),
        0
      );

    const assignedProjects = employees.reduce(
      (sum, employee) =>
        sum +
        (Number(employee.assignedProjects) || 0),
      0
    );

    return {
      total: employees.length,
      active: active.length,
      onLeave: onLeave.length,
      monthlyPayroll,
      assignedProjects,
    };
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();

    return employees
      .filter((employee) => {
        const matchesSearch = [
          employee.name,
          employee.email,
          employee.phone,
          employee.role,
          employee.department,
        ].some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(query)
        );

        return (
          matchesSearch &&
          (departmentFilter === "All" ||
            employee.department ===
              departmentFilter) &&
          (statusFilter === "All" ||
            employee.status === statusFilter)
        );
      })
      .sort((a, b) =>
        a.name.localeCompare(b.name)
      );
  }, [
    employees,
    search,
    departmentFilter,
    statusFilter,
  ]);

  const saveEmployee = (form) => {
    const timestamp = new Date().toISOString();

    if (editingEmployee) {
      setEmployees((previous) =>
        previous.map((employee) =>
          employee.id === editingEmployee.id
            ? {
                ...employee,
                ...form,
                updatedAt: timestamp,
              }
            : employee
        )
      );
    } else {
      setEmployees((previous) => [
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
    setEditingEmployee(null);
  };

  const deleteEmployee = (employee) => {
    if (
      !window.confirm(
        `Delete employee "${employee.name}"?`
      )
    ) {
      return;
    }

    setEmployees((previous) =>
      previous.filter(
        (item) => item.id !== employee.id
      )
    );
  };

  const cards = [
    {
      label: "Total Employees",
      value: stats.total,
      icon: Users,
    },
    {
      label: "Active Employees",
      value: stats.active,
      icon: UserCheck,
    },
    {
      label: "On Leave",
      value: stats.onLeave,
      icon: UserX,
    },
    {
      label: "Monthly Payroll",
      value: money(stats.monthlyPayroll),
      icon: Wallet,
    },
    {
      label: "Assigned Projects",
      value: stats.assignedProjects,
      icon: BriefcaseBusiness,
    },
  ];

  return (
    <div className="employees">
      <div className="employees__header">
        <div>
          <span className="employees__eyebrow">
            TEAM MANAGEMENT
          </span>
          <h1>Employee Management</h1>
          <p>
            Manage employee profiles, departments,
            salaries and work assignments.
          </p>
        </div>

        <button
          type="button"
          className="employees__button employees__button--primary"
          onClick={() => {
            setEditingEmployee(null);
            setModalOpen(true);
          }}
        >
          <Plus size={18} />
          Add Employee
        </button>
      </div>

      {storageError && (
        <div className="employees__error" role="alert">
          {storageError}
        </div>
      )}

      <div className="employees__stats">
        {cards.map(
          ({ label, value, icon: Icon }) => (
            <div
              className="employees__stat"
              key={label}
            >
              <Icon size={21} />
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          )
        )}
      </div>

      <section className="employees__panel">
        <div className="employees__panel-heading">
          <div>
            <h2>
              <Users size={19} />
              Team Directory
            </h2>
            <p>
              Employee profiles and employment details.
            </p>
          </div>
        </div>

        <div className="employees__toolbar">
          <div className="employees__search">
            <Search size={18} />
            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search name, email, role..."
              aria-label="Search employees"
            />
          </div>

          <div className="employees__filters">
            <Filter size={17} />

            <select
              value={departmentFilter}
              onChange={(event) =>
                setDepartmentFilter(
                  event.target.value
                )
              }
              aria-label="Filter department"
            >
              <option value="All">
                All Departments
              </option>

              {DEPARTMENTS.map((department) => (
                <option key={department}>
                  {department}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              aria-label="Filter employment status"
            >
              <option value="All">
                All Statuses
              </option>

              {STATUSES.map((status) => (
                <option key={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="employees__table-wrap">
          <table className="employees__table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Role / Department</th>
                <th>Employment</th>
                <th>Joining Date</th>
                <th>Monthly Salary</th>
                <th>Projects</th>
                <th>Tasks</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredEmployees.map((employee) => (
                <tr key={employee.id}>
                  <td>
                    <div className="employees__identity">
                      <span className="employees__avatar">
                        <UserRound size={19} />
                      </span>

                      <div>
                        <strong>
                          {employee.name}
                        </strong>

                        {employee.email && (
                          <a
                            href={`mailto:${employee.email}`}
                          >
                            <Mail size={12} />
                            {employee.email}
                          </a>
                        )}

                        {employee.phone && (
                          <a
                            href={`tel:+91${employee.phone}`}
                          >
                            <Phone size={12} />
                            {employee.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  </td>

                  <td>
                    <div className="employees__role">
                      <strong>
                        {employee.role}
                      </strong>
                      <small>
                        <Building2 size={12} />
                        {employee.department}
                      </small>
                    </div>
                  </td>

                  <td>
                    {employee.employmentType}
                  </td>

                  <td>
                    <span className="employees__date">
                      <CalendarDays size={14} />
                      {formatDate(
                        employee.joiningDate
                      )}
                    </span>
                  </td>

                  <td className="employees__salary">
                    {money(
                      employee.monthlySalary
                    )}
                  </td>

                  <td>
                    <span className="employees__count">
                      <BriefcaseBusiness size={14} />
                      {employee.assignedProjects || 0}
                    </span>
                  </td>

                  <td>
                    <span className="employees__count">
                      <ClipboardList size={14} />
                      {employee.assignedTasks || 0}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`employees__badge employees__badge--${employee.status
                        .toLowerCase()
                        .replace(/\s+/g, "-")}`}
                    >
                      {employee.status}
                    </span>
                  </td>

                  <td>
                    <div className="employees__actions">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingEmployee(
                            employee
                          );
                          setModalOpen(true);
                        }}
                        title="Edit employee"
                        aria-label={`Edit ${employee.name}`}
                      >
                        <Pencil size={16} />
                      </button>

                      <button
                        type="button"
                        className="employees__delete"
                        onClick={() =>
                          deleteEmployee(employee)
                        }
                        title="Delete employee"
                        aria-label={`Delete ${employee.name}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <div className="employees__empty">
                      <Users size={36} />
                      <h3>
                        No employees found
                      </h3>
                      <p>
                        {employees.length === 0
                          ? "Add your first employee to build the team directory."
                          : "Try adjusting your search or filters."}
                      </p>

                      {employees.length === 0 && (
                        <button
                          type="button"
                          className="employees__button employees__button--primary"
                          onClick={() => {
                            setEditingEmployee(
                              null
                            );
                            setModalOpen(true);
                          }}
                        >
                          <Plus size={16} />
                          Add Employee
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="employees__table-footer">
          Showing {filteredEmployees.length} of{" "}
          {employees.length} employees
        </div>
      </section>

      {modalOpen && (
        <EmployeeModal
          employee={editingEmployee}
          onClose={() => {
            setModalOpen(false);
            setEditingEmployee(null);
          }}
          onSave={saveEmployee}
        />
      )}
    </div>
  );
}
