
import { useCallback, useEffect, useMemo, useState } from "react";
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

import {
  employeeApi,
  toEmployeeISODate,
} from "../../services/employeeApi.js";

import "./Employees.scss";

const DEPARTMENTS = [
  "Development",
  "Design",
  "Marketing",
  "Sales",
  "Operations",
  "Human Resources",
  "Finance",
  "Management",
  "Other",
];

const STATUSES = [
  "Active",
  "On Leave",
  "Notice Period",
  "Resigned",
  "Terminated",
];

const EMPLOYMENT_TYPES = [
  "Full Time",
  "Part Time",
  "Internship",
  "Contract",
  "Freelance",
];

const EMPTY_FORM = {
  user: "",
  name: "",
  email: "",
  phone: "",
  password: "",
  role: "",
  department: "Development",
  employmentType: "Full Time",
  status: "Active",
  joiningDate: "",
  monthlySalary: "",
  notes: "",
};

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const getId = (value) =>
  typeof value === "string"
    ? value
    : value?._id || value?.id || "";

const getError = (error) =>
  error instanceof Error
    ? error.message
    : "Something went wrong.";

const dateInputValue = (value) => {
  if (!value) return "";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? ""
    : date.toISOString().slice(0, 10);
};

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
};

const todayKey = () => {
  const date = new Date();
  const pad = (n) => String(n).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-");
};

const mapEmployee = (employee) => {
  const account =
    employee.user &&
    typeof employee.user === "object"
      ? employee.user
      : {};

  return {
    id: getId(employee),
    userId: getId(employee.user),
    employeeId: employee.employeeId || "",
    name: account.name || "Unknown Employee",
    email: account.email || "",
    phone: account.phone || "",
    role: employee.designation || "",
    department: employee.department || "",
    employmentType:
      employee.employmentType || "Full Time",
    status: employee.status || "Active",
    joiningDate: dateInputValue(
      employee.joiningDate
    ),
    monthlySalary:
      employee.salary?.amount ?? null,
    salaryType:
      employee.salary?.type || "Monthly",
    notes: employee.notes || "",
  };
};

function EmployeeModal({
  employee,
  availableUsers,
  onClose,
  onSave,
}) {
  const isEditing = Boolean(employee);

  const [accountMode, setAccountMode] =
    useState("existing");

  const [createdUserId, setCreatedUserId] =
    useState("");

  const [form, setForm] = useState(() =>
    employee
      ? {
          ...EMPTY_FORM,
          ...employee,
          user: employee.userId,
          monthlySalary:
            employee.monthlySalary == null
              ? ""
              : String(employee.monthlySalary),
        }
      : { ...EMPTY_FORM }
  );

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onEscape = (event) => {
      if (event.key === "Escape" && !saving) {
        onClose();
      }
    };

    document.addEventListener("keydown", onEscape);

    return () => {
      document.removeEventListener(
        "keydown",
        onEscape
      );
    };
  }, [onClose, saving]);

  const change = (event) => {
    const { name, value } = event.target;

    if (name === "user") {
      const selected = availableUsers.find(
        (item) => getId(item) === value
      );

      setForm((previous) => ({
        ...previous,
        user: value,
        name: selected?.name || "",
        email: selected?.email || "",
        phone: selected?.phone || "",
      }));
    } else {
      setForm((previous) => ({
        ...previous,
        [name]: value,
      }));
    }

    setError("");
  };

  const changeAccountMode = (value) => {
    if (saving || createdUserId) return;

    setAccountMode(value);
    setError("");

    setForm((previous) => ({
      ...previous,
      user: "",
      name: "",
      email: "",
      phone: "",
      password: "",
    }));
  };

  const submit = async (event) => {
    event.preventDefault();

    if (saving) return;

    const creatingAccount =
      !isEditing && accountMode === "new";

    if (
      !isEditing &&
      !creatingAccount &&
      !form.user
    ) {
      setError("Select an existing user.");
      return;
    }

    if (creatingAccount && !createdUserId) {
      if (form.name.trim().length < 2) {
        setError("Enter a valid employee name.");
        return;
      }

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          form.email.trim()
        )
      ) {
        setError("Enter a valid email.");
        return;
      }

      if (
        form.phone.trim() &&
        !/^[6-9]\d{9}$/.test(form.phone.trim())
      ) {
        setError("Enter a valid mobile number.");
        return;
      }

      const passwordBytes = new TextEncoder().encode(
        form.password
      ).length;

      if (
        form.password.length < 12 ||
        passwordBytes > 72
      ) {
        setError(
          "Password must contain at least 12 characters and at most 72 UTF-8 bytes."
        );
        return;
      }
    }

    if (form.role.trim().length < 2) {
      setError("Enter a valid job role.");
      return;
    }

    if (
      !form.joiningDate ||
      form.joiningDate > todayKey()
    ) {
      setError("Enter a valid joining date.");
      return;
    }

    const salary =
      form.monthlySalary === ""
        ? null
        : Number(form.monthlySalary);

    if (
      salary !== null &&
      (!Number.isFinite(salary) ||
        salary < 0 ||
        salary > 999999999999)
    ) {
      setError("Enter a valid salary.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      let userId = form.user;

      if (creatingAccount) {
        if (createdUserId) {
          userId = createdUserId;
        } else {
          const payload = {
            name: form.name.trim(),
            email: form.email.trim().toLowerCase(),
            password: form.password,
            role: "employee",
          };

          if (form.phone.trim()) {
            payload.phone = form.phone.trim();
          }

          const result =
            await employeeApi.createUser(payload);

          userId = getId(result.user);

          if (!userId) {
            throw new Error(
              "Account created but user ID was not returned. Verify the account before retrying."
            );
          }

          setCreatedUserId(userId);
        }
      }

      const profile = {
        designation: form.role.trim(),
        department: form.department,
        employmentType: form.employmentType,
        joiningDate: toEmployeeISODate(
          form.joiningDate
        ),
        notes: form.notes.trim(),
      };

      if (!isEditing) {
        profile.user = userId;

        if (salary !== null) {
          profile.salary = {
            amount: salary,
            currency: "INR",
            type: "Monthly",
          };
        }
      }

      await onSave({
        profile,
        salary:
          isEditing && salary !== null
            ? {
                amount: salary,
                currency: "INR",
                type: "Monthly",
              }
            : null,
        status: form.status,
      });
    } catch (err) {
      setError(getError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="employees__modal-backdrop"
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
        className="employees__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-modal-title"
      >
        <div className="employees__modal-header">
          <div>
            <h2 id="employee-modal-title">
              {isEditing
                ? "Edit Employee"
                : "Add New Employee"}
            </h2>
            <p>Manage employee details.</p>
          </div>

          <button
            type="button"
            className="employees__icon-button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form
          className="employees__form"
          onSubmit={submit}
        >
          <div className="employees__form-grid">
            {!isEditing && (
              <label className="employees__form-full">
                Account Type
                <select
                  value={accountMode}
                  onChange={(event) =>
                    changeAccountMode(
                      event.target.value
                    )
                  }
                  disabled={
                    saving || Boolean(createdUserId)
                  }
                >
                  <option value="existing">
                    Existing User
                  </option>
                  <option value="new">
                    Create New Account
                  </option>
                </select>
              </label>
            )}

            {!isEditing &&
              accountMode === "existing" && (
                <label className="employees__form-full">
                  User Account *
                  <select
                    name="user"
                    value={form.user}
                    onChange={change}
                    required
                  >
                    <option value="">
                      Select Account
                    </option>
                    {availableUsers.map((item) => (
                      <option
                        key={getId(item)}
                        value={getId(item)}
                      >
                        {item.name} ({item.email})
                      </option>
                    ))}
                  </select>
                </label>
              )}

            <label>
              Full Name
              <input
                name="name"
                value={form.name}
                onChange={change}
                readOnly={
                  isEditing ||
                  accountMode === "existing" ||
                  Boolean(createdUserId)
                }
                required={creatingRequired(
                  isEditing,
                  accountMode
                )}
              />
            </label>

            <label>
              Job Role *
              <input
                name="role"
                value={form.role}
                onChange={change}
                maxLength={100}
                required
              />
            </label>

            <label>
              Email Address
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={change}
                readOnly={
                  isEditing ||
                  accountMode === "existing" ||
                  Boolean(createdUserId)
                }
                required={creatingRequired(
                  isEditing,
                  accountMode
                )}
              />
            </label>

            <label>
              Mobile Number
              <input
                name="phone"
                type="tel"
                value={form.phone}
                onChange={change}
                maxLength={10}
                readOnly={
                  isEditing ||
                  accountMode === "existing" ||
                  Boolean(createdUserId)
                }
              />
            </label>

            {!isEditing &&
              accountMode === "new" &&
              !createdUserId && (
                <label className="employees__form-full">
                  Account Password *
                  <input
                    name="password"
                    type="password"
                    value={form.password}
                    onChange={change}
                    minLength={12}
                    autoComplete="new-password"
                    required
                  />
                </label>
              )}

            <label>
              Department
              <select
                name="department"
                value={form.department}
                onChange={change}
              >
                {DEPARTMENTS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Employment Type
              <select
                name="employmentType"
                value={form.employmentType}
                onChange={change}
              >
                {EMPLOYMENT_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Status
              <select
                name="status"
                value={form.status}
                onChange={change}
                disabled={!isEditing}
              >
                {STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Joining Date *
              <input
                type="date"
                name="joiningDate"
                value={form.joiningDate}
                onChange={change}
                max={todayKey()}
                required
              />
            </label>

            <label>
              Monthly Salary (₹)
              <input
                type="number"
                name="monthlySalary"
                value={form.monthlySalary}
                onChange={change}
                min="0"
                max="999999999999"
                step="0.01"
              />
            </label>

            <label className="employees__form-full">
              Notes
              <textarea
                name="notes"
                value={form.notes}
                onChange={change}
                maxLength={5000}
                rows={3}
              />
            </label>
          </div>

          {createdUserId && (
            <p role="status">
              Account created. Retry will reuse
              the same user account.
            </p>
          )}

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
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="employees__button employees__button--primary"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : isEditing
                  ? "Save Changes"
                  : "Add Employee"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function creatingRequired(isEditing, accountMode) {
  return !isEditing && accountMode === "new";
}

export default function Employees({ user }) {
  const canManageEmployees =
    user?.role === "admin";

  const canViewStats =
    user?.role === "admin" ||
    user?.role === "manager";

  const [employees, setEmployees] = useState([]);
  const [availableUsers, setAvailableUsers] =
    useState([]);

  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] =
    useState("All");
  const [statusFilter, setStatusFilter] =
    useState("All");

  const [editingEmployee, setEditingEmployee] =
    useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [statsData, setStatsData] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");

      try {
        const records = [];
        let page = 1;
        let totalPages = 1;

        do {
          const result = await employeeApi.getAll(
            {
              page,
              limit: 100,
            },
            { signal: controller.signal }
          );

          if (controller.signal.aborted) return;

          records.push(...(result.employees || []));

          totalPages =
            result.pagination?.totalPages || 1;

          page += 1;
        } while (page <= totalPages);

        if (!controller.signal.aborted) {
          setEmployees(records.map(mapEmployee));
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(getError(err));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [refreshKey]);

  useEffect(() => {
    if (!canViewStats) {
      setStatsData(null);
      return;
    }

    const controller = new AbortController();

    async function loadStats() {
      try {
        const result = await employeeApi.getStats({
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setStatsData(result.stats || null);
        }
      } catch {
        if (!controller.signal.aborted) {
          setStatsData(null);
        }
      }
    }

    void loadStats();

    return () => controller.abort();
  }, [refreshKey, canViewStats]);

  const openAdd = async () => {
    if (!canManageEmployees || busy) return;

    try {
      setError("");

      const result =
        await employeeApi.getAvailableUsers();

      setAvailableUsers(result.users || []);
      setEditingEmployee(null);
      setModalOpen(true);
    } catch (err) {
      setError(getError(err));
    }
  };

  const openEdit = (employee) => {
    if (!canManageEmployees || busy) return;

    setEditingEmployee(employee);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (busy) return;

    setModalOpen(false);
    setEditingEmployee(null);
  };

  const saveEmployee = async ({
    profile,
    salary,
    status,
  }) => {
    if (!canManageEmployees) {
      throw new Error("Admin access required.");
    }

    setBusy(true);

    try {
      if (editingEmployee) {
        const id = editingEmployee.id;

        if (
          ["Resigned", "Terminated"].includes(status) &&
          status !== editingEmployee.status
        ) {
          throw new Error(
            "Use the exit-date workflow to resign or terminate an employee."
          );
        }

        await employeeApi.update(id, profile);

        if (salary) {
          await employeeApi.updateSalary(id, salary);
        }

        if (status !== editingEmployee.status) {
          await employeeApi.updateStatus(id, status);
        }
      } else {
        await employeeApi.create(profile);
      }

      setModalOpen(false);
      setEditingEmployee(null);
      refresh();
    } catch (err) {
      refresh();
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const resignEmployee = async (employee) => {
    if (!canManageEmployees || busy) return;

    if (
      ["Resigned", "Terminated"].includes(
        employee.status
      )
    ) {
      return;
    }

    if (
      !window.confirm(
        `Mark "${employee.name}" as resigned?`
      )
    ) {
      return;
    }

    const exitDate = window.prompt(
      "Enter exit date (YYYY-MM-DD):",
      todayKey()
    );

    if (exitDate === null) return;

    const date = new Date(
      `${exitDate}T12:00:00`
    );

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(exitDate) ||
      Number.isNaN(date.getTime()) ||
      dateInputValue(date) !== exitDate
    ) {
      setError("Invalid exit date.");
      return;
    }

    if (
      employee.joiningDate &&
      exitDate < employee.joiningDate
    ) {
      setError(
        "Exit date cannot be before joining date."
      );
      return;
    }

    try {
      setBusy(true);
      setError("");

      await employeeApi.updateStatus(
        employee.id,
        "Resigned",
        exitDate
      );

      refresh();
    } catch (err) {
      setError(getError(err));
    } finally {
      setBusy(false);
    }
  };

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
          String(value || "")
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

  const stats = useMemo(() => {
    const active = employees.filter(
      (employee) => employee.status === "Active"
    ).length;

    const onLeave = employees.filter(
      (employee) => employee.status === "On Leave"
    ).length;

    const payroll = employees
      .filter(
        (employee) =>
          !["Resigned", "Terminated"].includes(
            employee.status
          ) &&
          employee.salaryType === "Monthly"
      )
      .reduce(
        (total, employee) =>
          total +
          (Number(employee.monthlySalary) || 0),
        0
      );

    return {
      total: statsData?.total ?? employees.length,
      active: statsData?.active ?? active,
      onLeave: statsData?.onLeave ?? onLeave,
      payroll,
    };
  }, [employees, statsData]);

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
      value:
        canViewStats &&
        employees.some(
          (employee) =>
            employee.monthlySalary !== null
        )
          ? money(stats.payroll)
          : "—",
      icon: Wallet,
    },
    {
      label: "Assigned Projects",
      value: "—",
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
            Manage employee profiles,
            departments and work assignments.
          </p>
        </div>

        {canManageEmployees && (
          <button
            type="button"
            className="employees__button employees__button--primary"
            onClick={openAdd}
            disabled={busy}
          >
            <Plus size={18} />
            Add Employee
          </button>
        )}
      </div>

      {error && (
        <div
          className="employees__error"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="employees__stats">
        {cards.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="employees__stat"
          >
            <Icon size={21} />
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
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
              placeholder="Search employees..."
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

              {DEPARTMENTS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
              aria-label="Filter status"
            >
              <option value="All">
                All Statuses
              </option>

              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
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
                            href={`tel:${employee.phone}`}
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
                    {canViewStats &&
                    employee.monthlySalary !== null
                      ? money(employee.monthlySalary)
                      : "—"}
                  </td>

                  <td>
                    <span className="employees__count">
                      <BriefcaseBusiness size={14} />
                      —
                    </span>
                  </td>

                  <td>
                    <span className="employees__count">
                      <ClipboardList size={14} />
                      —
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
                    {canManageEmployees && (
                      <div className="employees__actions">
                        <button
                          type="button"
                          onClick={() =>
                            openEdit(employee)
                          }
                          title="Edit employee"
                          aria-label={`Edit ${employee.name}`}
                          disabled={busy}
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          type="button"
                          className="employees__delete"
                          onClick={() =>
                            resignEmployee(employee)
                          }
                          title="Mark as resigned"
                          aria-label={`Resign ${employee.name}`}
                          disabled={
                            busy ||
                            [
                              "Resigned",
                              "Terminated",
                            ].includes(employee.status)
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}

              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <div className="employees__empty">
                      <Users size={36} />

                      <h3>
                        {loading
                          ? "Loading employees..."
                          : "No employees found"}
                      </h3>

                      <p>
                        {loading
                          ? "Fetching employee records."
                          : "Try adjusting your filters or add an employee."}
                      </p>

                      {canManageEmployees &&
                        !loading &&
                        employees.length === 0 && (
                          <button
                            type="button"
                            className="employees__button employees__button--primary"
                            onClick={openAdd}
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

      {canManageEmployees && modalOpen && (
        <EmployeeModal
          employee={editingEmployee}
          availableUsers={availableUsers}
          onClose={closeModal}
          onSave={saveEmployee}
        />
      )}
    </div>
  );
}
