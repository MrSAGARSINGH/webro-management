
import { useState } from "react";
import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

// ================= COMPONENTS =================

import Sidebar from "./components/Sidebar/Sidebar";
import Header from "./components/Header/Header";

// ================= PAGES =================

import Dashboard from "./pages/Dashboard/Dashboard";
import Leads from "./pages/Leads/Leads";
import Clients from "./pages/Clients/Clients";
import Calling from "./pages/Calling/Calling";
import FollowUps from "./pages/FollowUps/FollowUps";
import Projects from "./pages/Projects/Projects";
import Payments from "./pages/Payments/Payments";
import Invoices from "./pages/Invoices/Invoices";
import Employees from "./pages/Employees/Employees";
import Tasks from "./pages/Tasks/Tasks";
import Calendar from "./pages/Calendar/Calendar";
import Reports from "./pages/Reports/Reports";
import Settings from "./pages/Settings/Settings";

// ================= GLOBAL STYLES =================

import "./styles/global.scss";

// ================= APP =================

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  const sidebarWidth = sidebarCollapsed
    ? "76px"
    : "260px";

  // ================= SIDEBAR HANDLERS =================

  const handleSidebarOpen = () => {
    setSidebarOpen(true);
  };

  const handleSidebarClose = () => {
    setSidebarOpen(false);
  };

  const handleSidebarCollapse = () => {
    setSidebarCollapsed((previous) => !previous);
  };

  // ================= RENDER =================

  return (
    <div
      className="webro-app"
      style={{
        "--current-sidebar-width": sidebarWidth,
      }}
    >
      {/* ================= SIDEBAR ================= */}

      <Sidebar
        isOpen={sidebarOpen}
        onClose={handleSidebarClose}
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleSidebarCollapse}
      />

      {/* ================= MAIN CONTENT ================= */}

      <div className="webro-app__main">
        {/* ================= HEADER ================= */}

        <Header onMenuClick={handleSidebarOpen} />

        {/* ================= PAGE ROUTES ================= */}

        <main className="webro-app__content">
          <Routes>
            {/* Dashboard */}
            <Route
              index
              element={<Dashboard />}
            />

            {/* CRM */}
            <Route
              path="leads"
              element={<Leads />}
            />

            <Route
              path="clients"
              element={<Clients />}
            />

            <Route
              path="calling"
              element={<Calling />}
            />

            <Route
              path="follow-ups"
              element={<FollowUps />}
            />

            {/* Project Management */}
            <Route
              path="projects"
              element={<Projects />}
            />

            {/* Finance */}
            <Route
              path="payments"
              element={<Payments />}
            />

            <Route
              path="invoices"
              element={<Invoices />}
            />

            {/* Team Management */}
            <Route
              path="employees"
              element={<Employees />}
            />

            <Route
              path="tasks"
              element={<Tasks />}
            />

            {/* Scheduling */}
            <Route
              path="calendar"
              element={<Calendar />}
            />

            {/* Analytics */}
            <Route
              path="reports"
              element={<Reports />}
            />

            {/* Workspace Settings */}
            <Route
              path="settings"
              element={<Settings />}
            />

            {/* Invalid Route */}
            <Route
              path="*"
              element={
                <Navigate to="/" replace />
              }
            />
          </Routes>
        </main>
      </div>
    </div>
  );
}
