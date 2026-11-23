
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  TrendingUp,
  IndianRupee,
  Users,
  Target,
  FolderKanban,
  CheckCircle2,
  AlertTriangle,
  Download,
  RefreshCw,
  CalendarDays,
  PhoneCall,
  ClipboardList,
  Wallet,
  ArrowUpRight,
  Filter,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import "./Reports.scss";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

const COLORS = [
  "#a3e635",
  "#60a5fa",
  "#fbbf24",
  "#c084fc",
  "#fb7185",
  "#34d399",
];

const EMPTY_DATA = {
  overview: {},
  revenue: {},
  leadAnalytics: {},
  projectAnalytics: {},
  taskAnalytics: {},
  leads: [],
  clients: [],
  projects: [],
  tasks: [],
  calls: [],
  employees: [],
};

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const compactMoney = (value) =>
  new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value) || 0);

const idOf = (value) =>
  typeof value === "string"
    ? value
    : value?._id || value?.id || "";

const pad = (value) => String(value).padStart(2, "0");

const localDate = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;

const dateKey = (value) => {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return localDate(date);
};

const monthKey = (value) => dateKey(value).slice(0, 7);

function getRange(period) {
  const now = new Date();
  const start = new Date(now);

  if (period === "all") {
    return { start: "", end: localDate(now) };
  }

  if (period === "7d") {
    start.setDate(start.getDate() - 6);
  } else if (period === "30d") {
    start.setDate(start.getDate() - 29);
  } else if (period === "90d") {
    start.setDate(start.getDate() - 89);
  } else {
    start.setDate(1);
  }

  return {
    start: localDate(start),
    end: localDate(now),
  };
}

function inRange(value, range) {
  const key = dateKey(value);

  return Boolean(
    key &&
      (!range.start || key >= range.start) &&
      key <= range.end
  );
}

function getMonths(count = 6) {
  const now = new Date();

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(
      now.getFullYear(),
      now.getMonth() - count + index + 1,
      1
    );

    return {
      key: `${date.getFullYear()}-${pad(date.getMonth() + 1)}`,
      label: date.toLocaleDateString("en-IN", {
        month: "short",
        year: "2-digit",
      }),
    };
  });
}

const percent = (part, total) =>
  total > 0 ? Math.round((part / total) * 100) : 0;

async function api(path, signal) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || result?.success !== true) {
    throw new Error(
      result?.message ||
        `Request failed (${response.status})`
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
      throw new Error(`Invalid ${key} response.`);
    }

    records.push(...result[key]);

    totalPages = result.pagination?.totalPages ?? 1;
    page += 1;
  } while (page <= totalPages);

  return records;
}

function safeCsv(value) {
  const raw = String(value ?? "");
  const protectedValue = /^[=+\-@\t\r]/.test(raw.trimStart())
    ? `'${raw}`
    : raw;

  return `"${protectedValue.replace(/"/g, '""')}"`;
}

function exportCsv(filename, headers, rows) {
  const content = [
    headers.map(safeCsv).join(","),
    ...rows.map((row) => row.map(safeCsv).join(",")),
  ].join("\r\n");

  const blob = new Blob(["\uFEFF", content], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = "default",
}) {
  return (
    <article className={`reports__metric reports__metric--${tone}`}>
      <div className="reports__metric-top">
        <span>{title}</span>
        <div className="reports__metric-icon">
          <Icon size={19} />
        </div>
      </div>

      <strong>{value}</strong>

      <p>
        <ArrowUpRight size={13} />
        {subtitle}
      </p>
    </article>
  );
}

function ChartPanel({
  title,
  subtitle,
  children,
  className = "",
}) {
  return (
    <section className={`reports__chart-panel ${className}`}>
      <div className="reports__panel-heading">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

const tooltipStyle = {
  background: "#18181b",
  border: "1px solid #35353a",
  borderRadius: 10,
  color: "#fafafa",
  fontSize: 12,
};

export default function Reports() {
  const [data, setData] = useState(EMPTY_DATA);
  const [period, setPeriod] = useState("30d");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");

      try {
        const [
          overview,
          revenue,
          leadAnalytics,
          projectAnalytics,
          taskAnalytics,
          leads,
          clients,
          projects,
          tasks,
          calls,
          employees,
        ] = await Promise.all([
          api("/dashboard/overview", controller.signal),
          api("/dashboard/revenue", controller.signal),
          api("/dashboard/leads", controller.signal),
          api("/dashboard/projects", controller.signal),
          api("/dashboard/tasks", controller.signal),
          fetchAll("/leads", "leads", controller.signal),
          fetchAll("/clients", "clients", controller.signal),
          fetchAll("/projects", "projects", controller.signal),
          fetchAll("/tasks", "tasks", controller.signal),
          fetchAll("/calls", "calls", controller.signal),
          fetchAll("/employees", "employees", controller.signal),
        ]);

        if (controller.signal.aborted) return;

        setData({
          overview: overview.data || {},
          revenue: revenue.data || {},
          leadAnalytics: leadAnalytics.data || {},
          projectAnalytics: projectAnalytics.data || {},
          taskAnalytics: taskAnalytics.data || {},
          leads,
          clients,
          projects,
          tasks,
          calls,
          employees,
        });

        setLastUpdated(new Date());
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message || "Unable to load reports.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);

  const range = useMemo(() => getRange(period), [period]);

  const analytics = useMemo(() => {
    const leads = data.leads.filter((item) =>
      inRange(item.createdAt, range)
    );

    const clients = data.clients.filter((item) =>
      inRange(item.createdAt, range)
    );

    const projects = data.projects.filter((item) =>
      inRange(item.createdAt, range)
    );

    const tasks = data.tasks.filter((item) =>
      inRange(item.createdAt, range)
    );

    const calls = data.calls.filter((item) =>
      inRange(
        item.callDate || item.createdAt,
        range
      )
    );

    const wonLeads = leads.filter((item) =>
      ["Won", "Converted", "Closed Won"].includes(item.status)
    ).length;

    const completedProjects = projects.filter(
      (item) => item.status === "Completed"
    ).length;

    const completedTasks = tasks.filter(
      (item) => item.status === "Completed"
    ).length;

    const overdueTasks =
      data.taskAnalytics.overdue ??
      data.tasks.filter(
        (item) =>
          item.dueDate &&
          dateKey(item.dueDate) < localDate(new Date()) &&
          !["Completed", "Cancelled"].includes(item.status)
      ).length;

    const leadStatuses = Object.entries(
      leads.reduce((acc, lead) => {
        const status = lead.status || "Unknown";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {})
    ).map(([name, value]) => ({ name, value }));

    const projectStatuses = Object.entries(
      projects.reduce((acc, project) => {
        const status = project.status || "Unknown";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {})
    ).map(([name, value]) => ({ name, value }));

    const months = getMonths(6);

    const monthlyRevenue = months.map((month) => {
      const entry = (data.revenue.monthlyRevenue || []).find(
        (item) => item.month === month.key
      );

      return {
        month: month.label,
        revenue: Number(entry?.total) || 0,
      };
    });

    const monthlyLeads = months.map((month) => ({
      month: month.label,
      leads: data.leads.filter(
        (item) => monthKey(item.createdAt) === month.key
      ).length,
      clients: data.clients.filter(
        (item) => monthKey(item.createdAt) === month.key
      ).length,
    }));

    const employeePerformance = data.employees
      .filter((employee) => employee.status !== "Inactive")
      .map((employee) => {
        const userId = idOf(employee.user);
        const employeeId = idOf(employee);

        const assignedTasks = data.tasks.filter((task) => {
          const assigneeId = idOf(task.assignedTo);
          return Boolean(
            assigneeId &&
              (assigneeId === userId || assigneeId === employeeId)
          );
        });

        return {
          id: employeeId,
          name: employee.name || employee.user?.name || "Employee",
          department: employee.department || "—",
          assigned: assignedTasks.length,
          completed: assignedTasks.filter(
            (task) => task.status === "Completed"
          ).length,
          active: assignedTasks.filter(
            (task) =>
              !["Completed", "Cancelled"].includes(task.status)
          ).length,
        };
      })
      .sort((a, b) => b.assigned - a.assigned);

    const outstanding =
      Number(data.overview.invoices?.outstanding) || 0;

    return {
      leads: leads.length,
      clients: clients.length,
      projects: projects.length,
      tasks: tasks.length,
      calls: calls.length,
      wonLeads,
      conversionRate: percent(wonLeads, leads.length),
      completedProjects,
      projectCompletion: percent(
        completedProjects,
        projects.length
      ),
      completedTasks,
      taskCompletion: percent(completedTasks, tasks.length),
      overdueTasks,
      outstanding,
      revenue: Number(data.revenue.total) || 0,
      leadStatuses,
      projectStatuses,
      monthlyRevenue,
      monthlyLeads,
      employeePerformance,
    };
  }, [data, range]);

  const handleExport = () => {
    if (loading || error) return;

    exportCsv(
      `webro-report-${period}-${localDate(new Date())}.csv`,
      ["Metric", "Value"],
      [
        ["Reporting Period", period],
        ["Revenue (Last 6 Months)", analytics.revenue],
        ["New Leads", analytics.leads],
        ["New Clients", analytics.clients],
        ["Lead Conversion Rate", `${analytics.conversionRate}%`],
        ["New Projects", analytics.projects],
        ["Completed Projects", analytics.completedProjects],
        ["New Tasks", analytics.tasks],
        ["Completed Tasks", analytics.completedTasks],
        ["Calls Logged", analytics.calls],
        ["Current Invoice Outstanding", analytics.outstanding],
        ["Current Overdue Tasks", analytics.overdueTasks],
      ]
    );
  };

  const metrics = [
    {
      title: "Revenue Received",
      value: money(analytics.revenue),
      subtitle: "Last 6 months — backend verified",
      icon: IndianRupee,
      tone: "success",
    },
    {
      title: "New Leads",
      value: analytics.leads,
      subtitle: "Created during selected period",
      icon: Target,
    },
    {
      title: "New Clients",
      value: analytics.clients,
      subtitle: "Created during selected period",
      icon: Users,
    },
    {
      title: "Lead Conversion",
      value: `${analytics.conversionRate}%`,
      subtitle: `${analytics.wonLeads} won leads`,
      icon: TrendingUp,
    },
    {
      title: "New Projects",
      value: analytics.projects,
      subtitle: `${analytics.completedProjects} currently completed`,
      icon: FolderKanban,
    },
    {
      title: "Task Completion",
      value: `${analytics.taskCompletion}%`,
      subtitle: `${analytics.completedTasks} completed tasks`,
      icon: CheckCircle2,
      tone: "success",
    },
    {
      title: "Current Outstanding",
      value: money(analytics.outstanding),
      subtitle: "Across all invoices",
      icon: Wallet,
      tone: "warning",
    },
    {
      title: "Overdue Tasks",
      value: analytics.overdueTasks,
      subtitle: "Current unresolved overdue tasks",
      icon: AlertTriangle,
      tone: "danger",
    },
  ];

  return (
    <div className="reports">
      <div className="reports__header">
        <div>
          <span className="reports__eyebrow">
            BUSINESS INTELLIGENCE
          </span>

          <h1>Reports &amp; Analytics</h1>

          <p>
            Monitor business performance, revenue,
            projects and team productivity.
          </p>
        </div>

        <div className="reports__header-actions">
          <button
            type="button"
            className="reports__button reports__button--secondary"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw size={16} />
            {loading ? "Loading..." : "Refresh"}
          </button>

          <button
            type="button"
            className="reports__button reports__button--primary"
            onClick={handleExport}
            disabled={loading || Boolean(error)}
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="reports__error" role="alert">
          {error}
        </div>
      )}

      <div className="reports__filter-bar">
        <div>
          <Filter size={17} />
          <span>Reporting Period</span>

          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            aria-label="Reporting period"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="month">This Month</option>
            <option value="all">All Time</option>
          </select>
        </div>

        <span className="reports__updated">
          <CalendarDays size={14} />
          {lastUpdated
            ? `Updated ${lastUpdated.toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })}`
            : "Not updated"}
        </span>
      </div>

      <div className="reports__metrics">
        {metrics.map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
      </div>

      <div className="reports__charts">
        <ChartPanel
          title="Revenue Overview"
          subtitle="Completed payment revenue — last 6 calendar months"
          className="reports__chart-panel--wide"
        >
          <div className="reports__chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.monthlyRevenue}>
                <defs>
                  <linearGradient
                    id="revenueGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="#a3e635"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="100%"
                      stopColor="#a3e635"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  stroke="#2a2a2e"
                  strokeDasharray="3 3"
                  vertical={false}
                />

                <XAxis
                  dataKey="month"
                  stroke="#71717a"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                />

                <YAxis
                  stroke="#71717a"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  tickFormatter={compactMoney}
                />

                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [
                    money(value),
                    "Revenue",
                  ]}
                />

                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#a3e635"
                  strokeWidth={3}
                  fill="url(#revenueGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel
          title="Lead & Client Growth"
          subtitle="New records by month — last 6 calendar months"
          className="reports__chart-panel--wide"
        >
          <div className="reports__chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.monthlyLeads}>
                <CartesianGrid
                  stroke="#2a2a2e"
                  strokeDasharray="3 3"
                  vertical={false}
                />

                <XAxis
                  dataKey="month"
                  stroke="#71717a"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                />

                <YAxis
                  stroke="#71717a"
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  fontSize={11}
                />

                <Tooltip contentStyle={tooltipStyle} />
                <Legend />

                <Bar
                  dataKey="leads"
                  name="Leads"
                  fill="#a3e635"
                  radius={[5, 5, 0, 0]}
                />

                <Bar
                  dataKey="clients"
                  name="Clients"
                  fill="#60a5fa"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel
          title="Lead Pipeline"
          subtitle="Lead status distribution for selected period"
        >
          <div className="reports__chart">
            {analytics.leadStatuses.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.leadStatuses}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={65}
                    outerRadius={100}
                    paddingAngle={3}
                  >
                    {analytics.leadStatuses.map((item, index) => (
                      <Cell
                        key={item.name}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>

                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="reports__empty">
                No lead data available.
              </div>
            )}
          </div>
        </ChartPanel>

        <ChartPanel
          title="Project Status"
          subtitle="Project distribution for selected period"
        >
          <div className="reports__chart">
            {analytics.projectStatuses.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.projectStatuses}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={65}
                    outerRadius={100}
                    paddingAngle={3}
                  >
                    {analytics.projectStatuses.map((item, index) => (
                      <Cell
                        key={item.name}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>

                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="reports__empty">
                No project data available.
              </div>
            )}
          </div>
        </ChartPanel>
      </div>

      <section className="reports__table-panel">
        <div className="reports__panel-heading">
          <h2>
            <Users size={19} />
            Employee Workload
          </h2>

          <p>Current task assignments by employee.</p>
        </div>

        <div className="reports__table-wrap">
          <table className="reports__table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Assigned Tasks</th>
                <th>Completed</th>
                <th>Active</th>
                <th>Completion Rate</th>
              </tr>
            </thead>

            <tbody>
              {analytics.employeePerformance.map((employee) => {
                const completion = percent(
                  employee.completed,
                  employee.assigned
                );

                return (
                  <tr key={employee.id}>
                    <td>
                      <strong>{employee.name}</strong>
                    </td>
                    <td>{employee.department}</td>
                    <td>{employee.assigned}</td>
                    <td>{employee.completed}</td>
                    <td>{employee.active}</td>
                    <td>
                      <div className="reports__progress">
                        <div>
                          <span
                            style={{ width: `${completion}%` }}
                          />
                        </div>
                        <strong>{completion}%</strong>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!analytics.employeePerformance.length && (
                <tr>
                  <td colSpan={6}>
                    <div className="reports__empty">
                      No employee records available.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="reports__summary">
        <div>
          <PhoneCall size={19} />
          <span>Calls Logged</span>
          <strong>{analytics.calls}</strong>
        </div>

        <div>
          <ClipboardList size={19} />
          <span>New Tasks</span>
          <strong>{analytics.tasks}</strong>
        </div>

        <div>
          <FolderKanban size={19} />
          <span>Completed Projects</span>
          <strong>{analytics.completedProjects}</strong>
        </div>

        <div>
          <BarChart3 size={19} />
          <span>Project Completion</span>
          <strong>{analytics.projectCompletion}%</strong>
        </div>
      </div>

      <p className="reports__disclaimer">
        Reports use authenticated backend records. The selected
        period applies to leads, clients, projects, tasks and calls.
        Revenue is based on the backend's fixed six-month
        aggregation. Outstanding invoice balances and overdue
        tasks are current totals, not historical snapshots.
      </p>
    </div>
  );
}
