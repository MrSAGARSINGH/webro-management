
import { useEffect, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

// ================= COMPONENTS =================

import Sidebar from "./components/Sidebar/Sidebar";
import Header from "./components/Header/Header";

// ================= AUTH =================

import Login from "./pages/Login/Login";

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

// ================= API CONFIG =================

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api"
).replace(/\/+$/, "");

// ================= APP =================

export default function App() {
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  const [user, setUser] = useState(null);

  const [authStatus, setAuthStatus] = useState("loading");

  const sidebarWidth = sidebarCollapsed
    ? "76px"
    : "260px";

  // ================= SESSION CHECK =================

  useEffect(() => {
    const controller = new AbortController();

    const checkSession = async () => {
      try {
        const response = await fetch(
          `${API_URL}/auth/me`,
          {
            method: "GET",
            credentials: "include",
            signal: controller.signal,
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (response.status === 401) {
          setUser(null);
          setAuthStatus("unauthenticated");
          return;
        }

        if (!response.ok) {
          throw new Error(
            "Unable to verify your session"
          );
        }

        const data = await response.json();

        if (!data.success || !data.user) {
          throw new Error(
            "Invalid session response"
          );
        }

        setUser(data.user);
        setAuthStatus("authenticated");
      } catch (error) {
        if (controller.signal.aborted) return;

        console.error(
          "Session verification failed:",
          error
        );

        setAuthStatus("error");
      }
    };

    checkSession();

    return () => controller.abort();
  }, [location.pathname === "/login"]);

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

  // ================= LOADING =================

  if (authStatus === "loading") {
    return (
      <div
        role="status"
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f5f8f6",
          color: "#087f5b",
          fontFamily: "sans-serif",
        }}
      >
        Verifying your session...
      </div>
    );
  }

  // ================= SESSION ERROR =================

  if (authStatus === "error") {
    return (
      <div
        role="alert"
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <div>
          <h2>Unable to verify session</h2>
          <p>
            Check your backend connection and try again.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ================= LOGIN ROUTE =================

  if (authStatus === "unauthenticated") {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="*"
          element={<Navigate to="/login" replace />}
        />
      </Routes>
    );
  }

  // ================= AUTHENTICATED APP =================

  return (
    <Routes>
      <Route
        path="/login"
        element={<Navigate to="/dashboard" replace />}
      />

      <Route
        path="/*"
        element={
          <div
            className="webro-app"
            style={{
              "--current-sidebar-width": sidebarWidth,
            }}
          >
            <Sidebar
              isOpen={sidebarOpen}
              onClose={handleSidebarClose}
              collapsed={sidebarCollapsed}
              onToggleCollapse={handleSidebarCollapse}
            />

            <div className="webro-app__main">
              <Header onMenuClick={handleSidebarOpen} />

              <main className="webro-app__content">
                <Routes>
                  <Route
                    index
                    element={<Navigate to="/dashboard" replace />}
                  />

                  <Route
                    path="dashboard"
                    element={<Dashboard />}
                  />

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

                  <Route
                    path="projects"
                    element={<Projects />}
                  />

                  <Route
                    path="payments"
                    element={<Payments />}
                  />

                  <Route
                    path="invoices"
                    element={<Invoices />}
                  />

                  <Route
                    path="employees"
                    element={<Employees />}
                  />

                  <Route
                    path="tasks"
                    element={<Tasks />}
                  />

                  <Route
                    path="calendar"
                    element={<Calendar />}
                  />

                  <Route
                    path="reports"
                    element={<Reports />}
                  />

                  <Route
                    path="settings"
                    element={<Settings />}
                  />

                  <Route
                    path="*"
                    element={<Navigate to="/dashboard" replace />}
                  />
                </Routes>
              </main>
            </div>
          </div>
        }
      />
    </Routes>
  );
}
