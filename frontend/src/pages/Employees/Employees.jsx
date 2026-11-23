
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

// ======================================
// Constants
// ======================================

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
  assignedProjects: "",
  assignedTasks: "",
  notes: "",
};

const PAGE_SIZE = 100;

// ======================================
// Helpers
// ======================================

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
};

const dateInputValue = (value) => {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
};

const todayKey = () => {
  const date = new Date();

  const pad = (number) =>
    String(number).padStart(2, "0");

  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}`;
};

const getId = (value) => {
  if (typeof value === "string") {
    return value;
  }

  return value?._id || value?.id || "";
};

const getErrorMessage = (error) =>
  error instanceof Error
    ? error.message
    : "Something went wrong.";

const mapEmployee = (employee) => {
  const user =
    employee.user &&
    typeof employee.user === "object"
      ? employee.user
      : {};

  return {
    id: getId(employee),
    userId: getId(employee.user),
    employeeId: employee.employeeId || "",
    name: user.name || "Unknown Employee",
    email: user.email || "",
    phone: user.phone || "",
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
    assignedProjects: null,
    assignedTasks: null,
    notes: employee.notes || "",
  };
};

// ======================================
// Employee Modal
// ======================================

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
            employee.monthlySalary === null
              ? ""
              : String(employee.monthlySalary),
        }
      : { ...EMPTY_FORM }
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

    if (name === "user" && !isEditing) {
      const selected = availableUsers.find(
        (user) => getId(user) === value
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

  const changeAccountMode = (mode) => {
    if (saving || createdUserId) return;

    setAccountMode(mode);
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

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saving) return;

    const creatingAccount =
      !isEditing &&
      accountMode === "new";

    if (
      !isEditing &&
      !creatingAccount &&
      !form.user
    ) {
      setError(
        "Please select an existing user account."
      );
      return;
    }

    if (creatingAccount && !createdUserId) {
      if (form.name.trim().length < 2) {
        setError(
          "Employee name must contain at least 2 characters."
        );
        return;
      }

      const email = form.email.trim();

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          email
        )
      ) {
        setError(
          "Please enter a valid email address."
        );
        return;
      }

      if (
        form.phone.trim() &&
        !/^[6-9]\d{9}$/.test(
          form.phone.trim()
        )
      ) {
        setError(
          "Enter a valid 10-digit Indian mobile number."
        );
        return;
      }

      if (
        form.password.length < 12 ||
        new TextEncoder().encode(
          form.password
        ).length > 72
      ) {
        setError(
          "Password must be at least 12 characters and at most 72 UTF-8 bytes."
        );
        return;
      }
    }

    const role = form.role.trim();

    if (role.length < 2) {
      setError(
        "Employee job role must contain at least 2 characters."
      );
      return;
    }

    if (!form.joiningDate) {
      setError("Joining date is required.");
      return;
    }

    if (form.joiningDate > todayKey()) {
      setError(
        "Joining date cannot be in the future."
      );
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
        salary > 999999999999 ||
        Math.abs(
          salary * 100 -
            Math.round(salary * 100)
        ) > 0.00001)
    ) {
      setError(
        "Enter a valid monthly salary."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      const profile = {
        designation: role,
        department: form.department,
        employmentType:
          form.employmentType,
        joiningDate: toEmployeeISODate(
          form.joiningDate
        ),
        notes: form.notes.trim(),
      };

      let userId = form.user;

      if (creatingAccount) {
        if (createdUserId) {
          userId = createdUserId;
        } else {
          const userPayload = {
            name: form.name.trim(),
            email: form.email
              .trim()
              .toLowerCase(),
            role: "employee",
            password: form.password,
          };

          if (form.phone.trim()) {
            userPayload.phone =
              form.phone.trim();
          }

          const result =
            await employeeApi.createUser(
              userPayload
            );

          userId = getId(result?.user);

          if (!userId) {
            throw new Error(
              "User creation response did not contain a user ID. Check the Users list before retrying."
            );
          }

          // Preserve the newly created account
          // if employee creation fails.
          setCreatedUserId(userId);
        }
      }

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
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="employees__modal-backdrop"
      onMouseDown={(event) => {
        if (
          event.target ===
            event.currentTarget &&
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

            <p>
              Manage employee details and
              work assignments.
            </p>
          </div>

          <button
            type="button"
            className="employees__icon-button"
            onClick={onClose}
            disabled={saving}
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
            {!isEditing && (
              <div className="employees__form-full">
                <label>
                  Employee Account Type *
                  <select
                    value={accountMode}
                    onChange={(event) =>
                      changeAccountMode(
                        event.target.value
                      )
                    }
                    disabled={
                      saving ||
                      Boolean(createdUserId)
                    }
                  >
                    <option value="existing">
                      Select Existing User
                    </option>

                    <option value="new">
                      Create New User Account
                    </option>
                  </select>
                </label>
              </div>
            )}

            {!isEditing &&
              accountMode === "existing" && (
                <label className="employees__form-full">
                  Employee User Account *
                  <select
                    name="user"
                    value={form.user}
                    onChange={handleChange}
                    required
                  >
                    <option value="">
                      Select Employee Account
                    </option>

                    {availableUsers.map(
                      (user) => (
                        <option
                          key={getId(user)}
                          value={getId(user)}
                        >
                          {user.name} (
                          {user.email})
                        </option>
                      )
                    )}
                  </select>
                </label>
              )}

            <label>
              Full Name *
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                maxLength={100}
                placeholder="Employee name"
                readOnly={
                  isEditing ||
                  accountMode === "existing" ||
                  Boolean(createdUserId)
                }
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
                readOnly={
                  isEditing ||
                  accountMode === "existing" ||
                  Boolean(createdUserId)
                }
                required={
                  !isEditing &&
                  accountMode === "new"
                }
              />
            </label>

            <label>
              Mobile Number
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                maxLength={10}
                placeholder="10-digit mobile number"
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
                    type="password"
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    minLength={12}
                    autoComplete="new-password"
                    placeholder="Minimum 12 characters"
                    required
                  />
                </label>
              )}

            <label>
              Department
              <select
                name="department"
                value={form.department}
                onChange={handleChange}
              >
                {DEPARTMENTS.map(
                  (department) => (
                    <option
                      key={department}
                    >
                      {department}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              Employment Type
              <select
                name="employmentType"
                value={form.employmentType}
                onChange={handleChange}
              >
                {EMPLOYMENT_TYPES.map(
                  (type) => (
                    <option key={type}>
                      {type}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              Employment Status
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                disabled={!isEditing}
              >
                {STATUSES.map(
                  (status) => (
                    <option key={status}>
                      {status}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              Joining Date *
              <input
                type="date"
                name="joiningDate"
                value={form.joiningDate}
                onChange={handleChange}
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
                onChange={handleChange}
                min="0"
                max="999999999999"
                step="0.01"
                placeholder="25000"
              />
            </label>

            <label>
              Assigned Projects
              <input
                type="text"
                value="Managed from Projects"
                readOnly
              />
            </label>

            <label>
              Assigned Tasks
              <input
                type="text"
                value="Managed from Tasks"
                readOnly
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

          {!isEditing &&
            accountMode === "existing" &&
            availableUsers.length === 0 && (
              <p
                className="employees__form-error"
                role="status"
              >
                No available employee user
                accounts. Select Create New
                User Account instead.
              </p>
            )}

          {createdUserId && (
            <p role="status">
              User account created. If
              employee saving fails, retry
              will reuse this account.
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
              disabled={
                saving ||
                (!isEditing &&
                  accountMode ===
                    "existing" &&
                  availableUsers.length === 0)
              }
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

// ======================================
// Employees Page
// ======================================

export default function Employees() {
  const [employees, setEmployees] =
    useState([]);

  const [search, setSearch] =
    useState("");

  const [
    departmentFilter,
    setDepartmentFilter,
  ] = useState("All");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("All");

  const [
    editingEmployee,
    setEditingEmployee,
  ] = useState(null);

  const [modalOpen, setModalOpen] =
    useState(false);

  const [
    availableUsers,
    setAvailableUsers,
  ] = useState([]);

  const [
    storageError,
    setStorageError,
  ] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [statsData, setStatsData] =
    useState(null);

  const [
    totalEmployees,
    setTotalEmployees,
  ] = useState(0);

  const [
    refreshKey,
    setRefreshKey,
  ] = useState(0);

  const [busy, setBusy] =
    useState(false);

  // ====================================
  // Fetch Employees
  // ====================================

  useEffect(() => {
    let cancelled = false;

    const loadEmployees = async () => {
      try {
        setLoading(true);
        setStorageError("");

        const allEmployees = [];
        let page = 1;
        let totalPages = 1;

        do {
          const result =
            await employeeApi.getAll({
              page,
              limit: PAGE_SIZE,
            });

          if (cancelled) return;

          allEmployees.push(
            ...(result.employees || [])
          );

          totalPages =
            result.pagination?.totalPages ||
            1;

          page += 1;
        } while (page <= totalPages);

        if (cancelled) return;

        setEmployees(
          allEmployees.map(mapEmployee)
        );

        setTotalEmployees(
          allEmployees.length
        );
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

    void loadEmployees();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // ====================================
  // Fetch Stats
  // ====================================

  useEffect(() => {
    let cancelled = false;

    const loadStats = async () => {
      try {
        const result =
          await employeeApi.getStats();

        if (!cancelled) {
          setStatsData(
            result.stats || null
          );
        }
      } catch {
        if (!cancelled) {
          setStatsData(null);
        }
      }
    };

    void loadStats();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const refreshEmployees =
    useCallback(() => {
      setRefreshKey(
        (value) => value + 1
      );
    }, []);

  // ====================================
  // Add Employee
  // ====================================

  const openAddEmployee = async () => {
    try {
      setStorageError("");

      const result =
        await employeeApi.getAvailableUsers();

      setAvailableUsers(
        result.users || []
      );

      setEditingEmployee(null);
      setModalOpen(true);
    } catch (err) {
      setStorageError(
        getErrorMessage(err)
      );
    }
  };

  const closeModal = () => {
    if (busy) return;

    setModalOpen(false);
    setEditingEmployee(null);
  };

  // ====================================
  // Save Employee
  // ====================================

  const saveEmployee = async ({
    profile,
    salary,
    status,
  }) => {
    setBusy(true);

    try {
      if (editingEmployee) {
        const id =
          editingEmployee.id;

        await employeeApi.update(
          id,
          profile
        );

        if (salary) {
          await employeeApi.updateSalary(
            id,
            salary
          );
        }

        if (
          status !==
          editingEmployee.status
        ) {
          if (
            status === "Resigned" ||
            status === "Terminated"
          ) {
            throw new Error(
              "For Resigned or Terminated status, use the separate exit-date workflow."
            );
          }

          await employeeApi.updateStatus(
            id,
            status
          );
        }
      } else {
        await employeeApi.create(
          profile
        );
      }

      setModalOpen(false);
      setEditingEmployee(null);

      refreshEmployees();
    } catch (err) {
      refreshEmployees();
      throw err;
    } finally {
      setBusy(false);
    }
  };

  // ====================================
  // Mark Employee as Resigned
  // ====================================

  const deleteEmployee = async (
    employee
  ) => {
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

    if (exitDate === null) {
      return;
    }

    const date = new Date(
      `${exitDate}T12:00:00`
    );

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        exitDate
      ) ||
      Number.isNaN(
        date.getTime()
      ) ||
      dateInputValue(date) !==
        exitDate
    ) {
      setStorageError(
        "Invalid exit date."
      );
      return;
    }

    if (
      employee.joiningDate &&
      exitDate <
        employee.joiningDate
    ) {
      setStorageError(
        "Exit date cannot be before joining date."
      );
      return;
    }

    try {
      setBusy(true);
      setStorageError("");

      await employeeApi.updateStatus(
        employee.id,
        "Resigned",
        toEmployeeISODate(
          exitDate
        )
      );

      refreshEmployees();
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
    const active = employees.filter(
      (employee) =>
        employee.status ===
        "Active"
    );

    const onLeave =
      employees.filter(
        (employee) =>
          employee.status ===
          "On Leave"
      );

    const monthlyPayroll =
      employees
        .filter(
          (employee) =>
            ![
              "Resigned",
              "Terminated",
            ].includes(
              employee.status
            ) &&
            employee.salaryType ===
              "Monthly"
        )
        .reduce(
          (sum, employee) =>
            sum +
            (Number(
              employee.monthlySalary
            ) || 0),
          0
        );

    return {
      total:
        statsData?.total ??
        totalEmployees,

      active:
        statsData?.active ??
        active.length,

      onLeave:
        statsData?.onLeave ??
        onLeave.length,

      monthlyPayroll,

      assignedProjects: null,
    };
  }, [
    employees,
    statsData,
    totalEmployees,
  ]);

  // ====================================
  // Search and Filters
  // ====================================

  const filteredEmployees =
    useMemo(() => {
      const query = search
        .trim()
        .toLowerCase();

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
            (departmentFilter ===
              "All" ||
              employee.department ===
                departmentFilter) &&
            (statusFilter ===
              "All" ||
              employee.status ===
                statusFilter)
          );
        })
        .sort((a, b) =>
          a.name.localeCompare(
            b.name
          )
        );
    }, [
      employees,
      search,
      departmentFilter,
      statusFilter,
    ]);

  // ====================================
  // Dashboard Cards
  // ====================================

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
      value: employees.some(
        (employee) =>
          employee.monthlySalary !==
          null
      )
        ? money(
            stats.monthlyPayroll
          )
        : "—",
      icon: Wallet,
    },
    {
      label: "Assigned Projects",
      value: "—",
      icon: BriefcaseBusiness,
    },
  ];

  // ====================================
  // Original UI
  // ====================================

  return (
    <div className="employees">
      <div className="employees__header">
        <div>
          <span className="employees__eyebrow">
            TEAM MANAGEMENT
          </span>

          <h1>
            Employee Management
          </h1>

          <p>
            Manage employee profiles,
            departments, salaries and
            work assignments.
          </p>
        </div>

        <button
          type="button"
          className="employees__button employees__button--primary"
          onClick={() => {
            void openAddEmployee();
          }}
          disabled={busy}
        >
          <Plus size={18} />
          Add Employee
        </button>
      </div>

      {storageError && (
        <div
          className="employees__error"
          role="alert"
        >
          {storageError}
        </div>
      )}

      <div className="employees__stats">
        {cards.map(
          ({
            label,
            value,
            icon: Icon,
          }) => (
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
              Employee profiles and
              employment details.
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
                setSearch(
                  event.target.value
                )
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

              {DEPARTMENTS.map(
                (department) => (
                  <option
                    key={department}
                  >
                    {department}
                  </option>
                )
              )}
            </select>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
              aria-label="Filter employment status"
            >
              <option value="All">
                All Statuses
              </option>

              {STATUSES.map(
                (status) => (
                  <option
                    key={status}
                  >
                    {status}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        <div className="employees__table-wrap">
          <table className="employees__table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>
                  Role / Department
                </th>
                <th>Employment</th>
                <th>Joining Date</th>
                <th>
                  Monthly Salary
                </th>
                <th>Projects</th>
                <th>Tasks</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredEmployees.map(
                (employee) => (
                  <tr
                    key={employee.id}
                  >
                    <td>
                      <div className="employees__identity">
                        <span className="employees__avatar">
                          <UserRound
                            size={19}
                          />
                        </span>

                        <div>
                          <strong>
                            {employee.name}
                          </strong>

                          {employee.email && (
                            <a
                              href={`mailto:${employee.email}`}
                            >
                              <Mail
                                size={12}
                              />
                              {
                                employee.email
                              }
                            </a>
                          )}

                          {employee.phone && (
                            <a
                              href={`tel:${employee.phone}`}
                            >
                              <Phone
                                size={12}
                              />
                              {
                                employee.phone
                              }
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
                          <Building2
                            size={12}
                          />
                          {
                            employee.department
                          }
                        </small>
                      </div>
                    </td>

                    <td>
                      {
                        employee.employmentType
                      }
                    </td>

                    <td>
                      <span className="employees__date">
                        <CalendarDays
                          size={14}
                        />
                        {formatDate(
                          employee.joiningDate
                        )}
                      </span>
                    </td>

                    <td className="employees__salary">
                      {employee.monthlySalary ===
                      null
                        ? "—"
                        : money(
                            employee.monthlySalary
                          )}
                    </td>

                    <td>
                      <span className="employees__count">
                        <BriefcaseBusiness
                          size={14}
                        />
                        —
                      </span>
                    </td>

                    <td>
                      <span className="employees__count">
                        <ClipboardList
                          size={14}
                        />
                        —
                      </span>
                    </td>

                    <td>
                      <span
                        className={`employees__badge employees__badge--${employee.status
                          .toLowerCase()
                          .replace(
                            /\s+/g,
                            "-"
                          )}`}
                      >
                        {
                          employee.status
                        }
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
                            setModalOpen(
                              true
                            );
                          }}
                          title="Edit employee"
                          aria-label={`Edit ${employee.name}`}
                          disabled={busy}
                        >
                          <Pencil
                            size={16}
                          />
                        </button>

                        <button
                          type="button"
                          className="employees__delete"
                          onClick={() => {
                            void deleteEmployee(
                              employee
                            );
                          }}
                          title="Mark as resigned"
                          aria-label={`Mark ${employee.name} as resigned`}
                          disabled={
                            busy ||
                            [
                              "Resigned",
                              "Terminated",
                            ].includes(
                              employee.status
                            )
                          }
                        >
                          <Trash2
                            size={16}
                          />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}

              {filteredEmployees.length ===
                0 && (
                <tr>
                  <td colSpan={9}>
                    <div className="employees__empty">
                      <Users
                        size={36}
                      />

                      <h3>
                        {loading
                          ? "Loading employees..."
                          : "No employees found"}
                      </h3>

                      <p>
                        {loading
                          ? "Fetching employee records from the backend."
                          : employees.length ===
                              0
                            ? "Add your first employee to build the team directory."
                            : "Try adjusting your search or filters."}
                      </p>

                      {!loading &&
                        employees.length ===
                          0 && (
                          <button
                            type="button"
                            className="employees__button employees__button--primary"
                            onClick={() => {
                              void openAddEmployee();
                            }}
                          >
                            <Plus
                              size={16}
                            />
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
          Showing{" "}
          {
            filteredEmployees.length
          }{" "}
          of {totalEmployees}{" "}
          employees
        </div>
      </section>

      {modalOpen && (
        <EmployeeModal
          employee={
            editingEmployee
          }
          availableUsers={
            availableUsers
          }
          onClose={
            closeModal
          }
          onSave={
            saveEmployee
          }
        />
      )}
    </div>
  );
}
