
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  UsersRound,
  IndianRupee,
  Wallet,
  FolderKanban,
  PhoneCall,
  CalendarClock,
  ArrowUpRight,
  ArrowRight,
  Plus,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  ListTodo,
  ReceiptText,
  TrendingUp,
  Activity,
  Sparkles,
} from "lucide-react";

import StatCard from "../../components/StatCard/StatCard";
import RevenueChart from "../../components/RevenueChart/RevenueChart";

import "./Dashboard.scss";

// ==========================================
// API CONFIGURATION
// ==========================================

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api"
).replace(/\/+$/, "");

const getNumber = (value) =>
  typeof value === "number" && Number.isFinite(value)
    ? value
    : 0;

// ==========================================
// QUICK ACTIONS
// ==========================================

const quickActions = [
  {
    label: "Add New Lead",
    description: "Create a sales lead",
    path: "/leads",
    icon: UsersRound,
  },
  {
    label: "Add Client",
    description: "Register a new client",
    path: "/clients",
    icon: Plus,
  },
  {
    label: "Record Payment",
    description: "Update payment records",
    path: "/payments",
    icon: Wallet,
  },
  {
    label: "Schedule Call",
    description: "Plan a client follow-up",
    path: "/calling",
    icon: PhoneCall,
  },
];

// ==========================================
// SECTION HEADER
// ==========================================

function SectionHeader({
  title,
  subtitle,
  path,
  linkText = "View All",
  icon: Icon,
}) {
  return (
    <div className="dashboard__section-header">
      <div className="dashboard__section-heading">
        {Icon && (
          <span className="dashboard__section-icon">
            <Icon size={19} strokeWidth={1.9} />
          </span>
        )}

        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>

      {path && (
        <Link
          to={path}
          className="dashboard__view-all"
        >
          {linkText}
          <ArrowUpRight size={16} />
        </Link>
      )}
    </div>
  );
}

// ==========================================
// QUICK ACTIONS SECTION
// ==========================================

function QuickActionsSection() {
  return (
    <section className="dashboard__panel">
      <SectionHeader
        title="Quick Actions"
        subtitle="Frequently used workspace tools"
        icon={Plus}
      />

      <div className="dashboard__quick-actions">
        {quickActions.map(
          ({
            label,
            description,
            path,
            icon: Icon,
          }) => (
            <Link
              to={path}
              key={label}
              className="dashboard__quick-action"
            >
              <span className="dashboard__quick-action-icon">
                <Icon size={20} />
              </span>

              <span className="dashboard__quick-action-info">
                <strong>{label}</strong>
                <small>{description}</small>
              </span>

              <ArrowRight
                size={17}
                className="dashboard__quick-action-arrow"
              />
            </Link>
          )
        )}
      </div>

      <div className="dashboard__quick-note">
        <Sparkles size={18} />

        <div>
          <strong>Stay on top of your work</strong>
          <p>
            Track calls, payments, and project deadlines
            from one place.
          </p>
        </div>
      </div>
    </section>
  );
}

// ==========================================
// FOLLOW-UPS SECTION
// ==========================================

function FollowUpsSection() {
  return (
    <section className="dashboard__panel">
      <SectionHeader
        title="Today's Follow-ups"
        subtitle="Client calls and scheduled activities"
        path="/follow-ups"
        icon={CalendarClock}
      />

      <div className="dashboard__followups">
        <div className="dashboard__empty">
          Follow-up records are not connected yet.
        </div>
      </div>
    </section>
  );
}

// ==========================================
// ACTIVE PROJECTS SECTION
// ==========================================


function ActiveProjectsSection() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const fetchProjects = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `${API_URL}/projects?page=1&limit=10`,
          {
            method: "GET",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
            signal: controller.signal,
          }
        );

        if (response.status === 401) {
          throw new Error("Session expired. Please sign in again.");
        }

        if (response.status === 403) {
          throw new Error("You do not have access to project records.");
        }

        if (!response.ok) {
          throw new Error(`Failed to fetch projects (${response.status})`);
        }

        const result = await response.json();

        if (
          result?.success !== true ||
          !Array.isArray(result.projects)
        ) {
          throw new Error("Invalid projects API response");
        }

        if (!controller.signal.aborted) {
          setProjects(result.projects);
        }
      } catch (err) {
        if (controller.signal.aborted) return;

        setProjects([]);
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load projects"
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchProjects();

    return () => controller.abort();
  }, []);

  const activeProjects = projects.filter((project) => {
    const status = String(project.status ?? "")
      .toLowerCase()
      .replace(/[\s_-]+/g, "");

    return ["active", "inprogress"].includes(status);
  });

  return (
    <section className="dashboard__panel">
      <SectionHeader
        title="Active Projects"
        subtitle="Current project delivery progress"
        path="/projects"
        icon={FolderKanban}
      />

      <div className="dashboard__projects">
        {loading ? (
          <div className="dashboard__empty">
            Loading projects...
          </div>
        ) : error ? (
          <div className="dashboard__empty" role="alert">
            {error}
          </div>
        ) : activeProjects.length === 0 ? (
          <div className="dashboard__empty">
            No active projects found.
          </div>
        ) : (
          activeProjects.map((project) => {
            const id = project._id ?? project.id;
            const name =
              project.name ?? project.title ?? "Untitled Project";

            const status = String(project.status ?? "Active");

            const progress =
              typeof project.progress === "number" &&
              Number.isFinite(project.progress)
                ? Math.min(100, Math.max(0, project.progress))
                : null;

            const dueDate =
              project.dueDate ?? project.deadline ?? null;

            const formattedDate =
              dueDate && !Number.isNaN(new Date(dueDate).getTime())
                ? new Intl.DateTimeFormat("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  }).format(new Date(dueDate))
                : null;

            return (
              <div
                className="dashboard__project"
                key={id}
              >
                <div className="dashboard__project-top">
                  <div>
                    <h3>{name}</h3>
                    <p>{project.category ?? "Project"}</p>
                  </div>

                  <span className="dashboard__status">
                    {status}
                  </span>
                </div>

                {progress !== null && (
                  <div className="dashboard__project-progress">
                    <div className="dashboard__project-progress-info">
                      <span>Progress</span>
                      <strong>{progress}%</strong>
                    </div>

                    <div
                      className="dashboard__progress-track"
                      role="progressbar"
                      aria-label={`${name} progress`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={progress}
                    >
                      <div
                        className="dashboard__progress-fill"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="dashboard__project-footer">
                  <span>
                    <CalendarDays size={14} />
                    {formattedDate
                      ? `Due: ${formattedDate}`
                      : "No due date"}
                  </span>

                  <Link to="/projects">
                    Details
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}


// ==========================================
// RECENT PAYMENTS SECTION
// ==========================================

function RecentPaymentsSection() {
  return (
    <section className="dashboard__panel">
      <SectionHeader
        title="Recent Payments"
        subtitle="Latest client payment records"
        path="/payments"
        icon={Wallet}
      />

      <div className="dashboard__table-wrap">
        <table className="dashboard__table">
          <thead>
            <tr>
              <th scope="col">Client</th>
              <th scope="col">Project</th>
              <th scope="col">Amount</th>
              <th scope="col">Date</th>
              <th scope="col">Status</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td colSpan={5}>
                Payment records are not connected yet.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ==========================================
// MAIN DASHBOARD
// ==========================================

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // ========================================
  // FETCH DASHBOARD OVERVIEW
  // ========================================

  useEffect(() => {
    const controller = new AbortController();

    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `${API_URL}/dashboard/overview`,
          {
            method: "GET",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
            signal: controller.signal,
          }
        );

        if (response.status === 401) {
          throw new Error(
            "Session expired. Please sign in again."
          );
        }

        if (response.status === 403) {
          throw new Error(
            "You do not have permission to view dashboard analytics."
          );
        }

        if (!response.ok) {
          throw new Error(
            `Dashboard API failed (${response.status})`
          );
        }

        const result = await response.json();

        if (
          result?.success !== true ||
          !result.data ||
          typeof result.data !== "object" ||
          Array.isArray(result.data)
        ) {
          throw new Error(
            "Invalid dashboard API response"
          );
        }

        if (!controller.signal.aborted) {
          setOverview(result.data);
        }
      } catch (err) {
        if (controller.signal.aborted) return;

        setOverview(null);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load dashboard"
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchDashboard();

    return () => controller.abort();
  }, [reloadKey]);

  // ========================================
  // LIVE BUSINESS METRICS
  // ========================================

  const dashboardStats = useMemo(
    () => ({
      receivedRevenue: getNumber(
        overview?.finance?.revenue
      ),

      outstandingInvoices: getNumber(
        overview?.invoices?.outstanding
      ),

      totalClients: getNumber(
        overview?.clients?.total
      ),

      activeProjects: getNumber(
        overview?.projects?.active
      ),

      totalLeads: getNumber(
        overview?.leads?.total
      ),

      activeEmployees: getNumber(
        overview?.employees?.active
      ),

      overdueInvoices: getNumber(
        overview?.invoices?.overdue
      ),

      completedTasks: getNumber(
        overview?.tasks?.completed
      ),
    }),
    [overview]
  );

  // ========================================
  // CURRENT DATE
  // ========================================

  const today = useMemo(
    () =>
      new Intl.DateTimeFormat("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date()),
    []
  );

  // ========================================
  // RENDER
  // ========================================

  return (
    <div className="dashboard">
      {/* ================= INTRO ================= */}

      <section className="dashboard__header">
        <div className="dashboard__header-content">
          <div className="dashboard__eyebrow">
            <span className="dashboard__live-dot" />
            WORKSPACE OVERVIEW
          </div>

          <h1>
            Business Overview
            <span className="dashboard__title-accent">
              .
            </span>
          </h1>

          <p>
            Monitor your business performance, manage
            client relationships, and stay updated on
            daily operations.
          </p>

          <span className="dashboard__today">
            <CalendarDays size={15} />
            {today}
          </span>
        </div>

        <Link
          to="/reports"
          className="dashboard__report-button"
        >
          <TrendingUp size={17} />
          View Reports
          <ArrowUpRight size={15} />
        </Link>
      </section>

      {/* ================= API STATUS ================= */}

      {loading && (
        <div
          className="dashboard__demo-notice"
          role="status"
        >
          <Activity size={17} />
          Loading live dashboard data...
        </div>
      )}

      {error && (
        <div
          className="dashboard__demo-notice"
          role="alert"
        >
          <AlertCircle size={17} />

          <span>{error}</span>

          <button
            type="button"
            onClick={() =>
              setReloadKey((previous) => previous + 1)
            }
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && overview && (
        <div
          className="dashboard__demo-notice"
          role="status"
        >
          <CheckCircle2 size={17} />

          <span>
            Live dashboard metrics connected to MongoDB.
            Detailed records are being integrated.
          </span>
        </div>
      )}

      {/* ================= STATS ================= */}

      <section
        className="dashboard__stats-section"
        aria-label="Business statistics"
      >
        <div className="dashboard__stats-heading">
          <div>
            <span className="dashboard__section-kicker">
              PERFORMANCE
            </span>

            <h2>Key Metrics</h2>
          </div>

          <span className="dashboard__stats-period">
            <Activity size={14} />
            Live overview
          </span>
        </div>

        {!loading && !error && overview && (
          <div className="dashboard__stats">
            <StatCard
              title="Received Revenue"
              value={dashboardStats.receivedRevenue}
              format="currency"
              icon={IndianRupee}
              variant="primary"
              description="Completed payments collected"
            />

            <StatCard
              title="Outstanding Invoices"
              value={dashboardStats.outstandingInvoices}
              format="currency"
              icon={Wallet}
              variant="warning"
              description="Unpaid invoice balance"
            />

            <StatCard
              title="Total Clients"
              value={dashboardStats.totalClients}
              icon={UsersRound}
              description="Registered clients"
            />

            <StatCard
              title="Active Projects"
              value={dashboardStats.activeProjects}
              icon={FolderKanban}
              description="Projects currently in progress"
            />

            <StatCard
              title="Total Leads"
              value={dashboardStats.totalLeads}
              icon={UsersRound}
              description="All sales leads"
            />

            <StatCard
              title="Active Employees"
              value={dashboardStats.activeEmployees}
              icon={UsersRound}
              description="Currently active employees"
            />

            <StatCard
              title="Overdue Invoices"
              value={dashboardStats.overdueInvoices}
              icon={ReceiptText}
              variant="warning"
              description="Invoices past due"
            />

            <StatCard
              title="Completed Tasks"
              value={dashboardStats.completedTasks}
              icon={ListTodo}
              description="Tasks marked as completed"
            />
          </div>
        )}
      </section>

      {/* ================= CHART + ACTIONS ================= */}

      <div className="dashboard__grid dashboard__grid--overview">
        <RevenueChart />
        <QuickActionsSection />
      </div>

      {/* ================= ACTIVITY ================= */}

      <div className="dashboard__grid dashboard__grid--activity">
        <FollowUpsSection />
        <ActiveProjectsSection />
      </div>

      {/* ================= PAYMENTS ================= */}

      <RecentPaymentsSection />

      {/* ================= FOOTER ================= */}

      <footer className="dashboard__footer">
        <span>WEBRO Management System</span>

        <div>
          <ReceiptText size={14} />
          Business Operations Dashboard
        </div>
      </footer>
    </div>
  );
}
