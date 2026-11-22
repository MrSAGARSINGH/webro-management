
import { useMemo } from "react";
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
  Clock3,
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
// DEMO DATA — REPLACE WITH API DATA LATER
// ==========================================

const dashboardStats = {
  totalClients: 24,
  totalRevenue: 320000,
  receivedPayments: 235000,
  pendingPayments: 85000,
  activeProjects: 12,
  todayCalls: 8,
  pendingFollowUps: 5,
  completedTasks: 18,
};

const followUps = [
  {
    id: "FU-001",
    client: "Maple & Thyme",
    contact: "Website project discussion",
    time: "10:30 AM",
    type: "Call",
    status: "Pending",
    priority: "High",
  },
  {
    id: "FU-002",
    client: "Koala Caff",
    contact: "Payment follow-up",
    time: "12:00 PM",
    type: "Payment",
    status: "Pending",
    priority: "High",
  },
  {
    id: "FU-003",
    client: "Dihara",
    contact: "Product page approval",
    time: "02:30 PM",
    type: "Meeting",
    status: "Scheduled",
    priority: "Medium",
  },
  {
    id: "FU-004",
    client: "Om Banna Sa DTH",
    contact: "Website maintenance",
    time: "04:00 PM",
    type: "Call",
    status: "Completed",
    priority: "Low",
  },
];

const recentPayments = [
  {
    id: "PAY-001",
    client: "Maple & Thyme",
    project: "Restaurant Website",
    amount: 15000,
    date: "18 Nov 2026",
    status: "Received",
  },
  {
    id: "PAY-002",
    client: "Koala Caff",
    project: "Website Development",
    amount: 12000,
    date: "17 Nov 2026",
    status: "Pending",
  },
  {
    id: "PAY-003",
    client: "Dihara",
    project: "E-commerce Website",
    amount: 25000,
    date: "15 Nov 2026",
    status: "Received",
  },
  {
    id: "PAY-004",
    client: "Om Banna Sa DTH",
    project: "Business Website",
    amount: 8000,
    date: "12 Nov 2026",
    status: "Partial",
  },
];

const activeProjects = [
  {
    id: "PRJ-001",
    name: "Maple & Thyme",
    category: "Restaurant Website",
    progress: 85,
    status: "In Progress",
    dueDate: "28 Nov 2026",
  },
  {
    id: "PRJ-002",
    name: "Dihara",
    category: "E-commerce Development",
    progress: 60,
    status: "In Progress",
    dueDate: "05 Dec 2026",
  },
  {
    id: "PRJ-003",
    name: "Koala Caff",
    category: "Website Maintenance",
    progress: 95,
    status: "Review",
    dueDate: "25 Nov 2026",
  },
  {
    id: "PRJ-004",
    name: "WEBRO NFC",
    category: "Web Application",
    progress: 40,
    status: "In Progress",
    dueDate: "10 Dec 2026",
  },
];

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

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

const getStatusClass = (status) =>
  status.toLowerCase().replace(/\s+/g, "-");

// ==========================================
// REUSABLE SECTION HEADER
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
        <Link to={path} className="dashboard__view-all">
          {linkText}
          <ArrowUpRight size={16} />
        </Link>
      )}
    </div>
  );
}

// ==========================================
// STATUS BADGE
// ==========================================

function StatusBadge({ status }) {
  return (
    <span
      className={`dashboard__status dashboard__status--${getStatusClass(
        status
      )}`}
    >
      {status}
    </span>
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
        {followUps.length === 0 ? (
          <div className="dashboard__empty">
            No follow-ups scheduled.
          </div>
        ) : (
          followUps.map((item) => (
            <div
              className="dashboard__followup"
              key={item.id}
            >
              <div className="dashboard__followup-icon">
                {item.status === "Completed" ? (
                  <CheckCircle2 size={19} />
                ) : item.priority === "High" ? (
                  <AlertCircle size={19} />
                ) : (
                  <PhoneCall size={19} />
                )}
              </div>

              <div className="dashboard__followup-info">
                <div className="dashboard__followup-title">
                  <h3>{item.client}</h3>

                  {item.priority === "High" && (
                    <span className="dashboard__priority">
                      High Priority
                    </span>
                  )}
                </div>

                <p>{item.contact}</p>

                <div className="dashboard__followup-meta">
                  <span>
                    <Clock3 size={13} />
                    {item.time}
                  </span>

                  <span>{item.type}</span>
                </div>
              </div>

              <StatusBadge status={item.status} />
            </div>
          ))
        )}
      </div>
    </section>
  );
}

// ==========================================
// QUICK ACTIONS
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
          ({ label, description, path, icon: Icon }) => (
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
// RECENT PAYMENTS
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
            {recentPayments.map((payment) => (
              <tr key={payment.id}>
                <td>
                  <strong>{payment.client}</strong>
                </td>

                <td>{payment.project}</td>

                <td className="dashboard__amount">
                  {formatCurrency(payment.amount)}
                </td>

                <td>{payment.date}</td>

                <td>
                  <StatusBadge status={payment.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ==========================================
// ACTIVE PROJECTS
// ==========================================

function ActiveProjectsSection() {
  return (
    <section className="dashboard__panel">
      <SectionHeader
        title="Active Projects"
        subtitle="Current project delivery progress"
        path="/projects"
        icon={FolderKanban}
      />

      <div className="dashboard__projects">
        {activeProjects.map((project) => {
          const progress = Math.min(
            100,
            Math.max(0, project.progress)
          );

          return (
            <div
              className="dashboard__project"
              key={project.id}
            >
              <div className="dashboard__project-top">
                <div>
                  <h3>{project.name}</h3>
                  <p>{project.category}</p>
                </div>

                <StatusBadge status={project.status} />
              </div>

              <div className="dashboard__project-progress">
                <div className="dashboard__project-progress-info">
                  <span>Progress</span>
                  <strong>{progress}%</strong>
                </div>

                <div
                  className="dashboard__progress-track"
                  role="progressbar"
                  aria-label={`${project.name} progress`}
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

              <div className="dashboard__project-footer">
                <span>
                  <CalendarDays size={14} />
                  Due: {project.dueDate}
                </span>

                <Link to="/projects">
                  Details
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ==========================================
// MAIN DASHBOARD
// ==========================================

export default function Dashboard() {
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
            <span className="dashboard__title-accent">.</span>
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

      {/* ================= DEMO NOTICE ================= */}

      <div
        className="dashboard__demo-notice"
        role="status"
      >
        <AlertCircle size={17} />
        <span>
          Preview mode — dashboard values and records
          are sample data, not live WEBRO business records.
        </span>
      </div>

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
            Demo overview
          </span>
        </div>

        <div className="dashboard__stats">
          <StatCard
            title="Total Revenue"
            value={dashboardStats.totalRevenue}
            format="currency"
            icon={IndianRupee}
            variant="primary"
            description="Total contracted revenue"
          />

          <StatCard
            title="Received Payments"
            value={dashboardStats.receivedPayments}
            format="currency"
            icon={CheckCircle2}
            description="Payments collected"
          />

          <StatCard
            title="Pending Payments"
            value={dashboardStats.pendingPayments}
            format="currency"
            icon={Wallet}
            variant="warning"
            description="Outstanding client payments"
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
            title="Today's Calls"
            value={dashboardStats.todayCalls}
            icon={PhoneCall}
            description="Scheduled client calls"
          />

          <StatCard
            title="Pending Follow-ups"
            value={dashboardStats.pendingFollowUps}
            icon={CalendarClock}
            variant="warning"
            description="Follow-ups requiring attention"
          />

          <StatCard
            title="Completed Tasks"
            value={dashboardStats.completedTasks}
            icon={ListTodo}
            description="Tasks marked as completed"
          />
        </div>
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
