
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

// ================= ROLE PERMISSIONS =================

const ALL_ROLES = ["admin", "manager", "employee"];
const MANAGEMENT_ROLES = ["admin", "manager"];

const ROUTE_CONFIG = [
  {
    path: "dashboard",
    component: Dashboard,
    roles: MANAGEMENT_ROLES,
  },
  {
    path: "leads",
    component: Leads,
    roles: ALL_ROLES,
  },
  {
    path: "clients",
    component: Clients,
    roles: MANAGEMENT_ROLES,
  },
  {
    path: "calling",
    component: Calling,
    roles: ALL_ROLES,
  },
  {
    path: "follow-ups",
    component: FollowUps,
    roles: ALL_ROLES,
  },
  {
    path: "projects",
    component: Projects,
    roles: ALL_ROLES,
  },
  {
    path: "payments",
    component: Payments,
    roles: MANAGEMENT_ROLES,
  },
  {
    path: "invoices",
    component: Invoices,
    roles: MANAGEMENT_ROLES,
  },
  {
    path: "employees",
    component: Employees,
    roles: MANAGEMENT_ROLES,
  },
  {
    path: "tasks",
    component: Tasks,
    roles: MANAGEMENT_ROLES,
  },
  {
    path: "calendar",
    component: Calendar,
    roles: MANAGEMENT_ROLES,
  },
  {
    path: "reports",
    component: Reports,
    roles: MANAGEMENT_ROLES,
  },
  {
    path: "settings",
    component: Settings,
    roles: MANAGEMENT_ROLES,
  },
];

// ================= ROLE HELPERS =================

function getDefaultRoute(user) {
  if (user?.role === "employee") {
    return "/leads";
  }

  return "/dashboard";
}

function hasRouteAccess(user, allowedRoles) {
  if (!user || !Array.isArray(allowedRoles)) {
    return false;
  }

  return allowedRoles.includes(user.role);
}

// ================= PROTECTED PAGE =================

function ProtectedPage({
  user,
  roles,
  component: Component,
}) {
  if (!hasRouteAccess(user, roles)) {
    return (
      <Navigate
        to={getDefaultRoute(user)}
        replace
      />
    );
  }

  return <Component user={user} />;
}

// ================= LOADING SCREEN =================

function LoadingScreen() {
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
        fontSize: "15px",
        fontWeight: 500,
      }}
    >
      Verifying your session...
    </div>
  );
}

// ================= SESSION ERROR SCREEN =================

function SessionErrorScreen({ onRetry }) {
  return (
    <div
      role="alert"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        textAlign: "center",
        background: "#f5f8f6",
        fontFamily: "sans-serif",
      }}
    >
      <div>
        <h2>Unable to verify session</h2>

        <p>
          Check your backend connection and
          try again.
        </p>

        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: "16px",
            padding: "10px 20px",
            border: "none",
            borderRadius: "8px",
            background: "#087f5b",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>
    </div>
  );
}

// ================= MAIN APP =================

export default function App() {
  const location = useLocation();

  // ================= UI STATE =================

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  // ================= AUTH STATE =================

  const [user, setUser] = useState(null);

  const [authStatus, setAuthStatus] =
    useState("loading");

  const [sessionRetryKey, setSessionRetryKey] =
    useState(0);

  const sidebarWidth = sidebarCollapsed
    ? "76px"
    : "260px";

  const isLoginRoute =
    location.pathname === "/login";

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

        if (controller.signal.aborted) {
          return;
        }

        if (response.status === 401) {
          setUser(null);
          setAuthStatus("unauthenticated");
          return;
        }

        if (!response.ok) {
          throw new Error(
            `Session verification failed (${response.status})`
          );
        }

        const data = await response.json();

        if (
          !data?.success ||
          !data?.user ||
          !ALL_ROLES.includes(data.user.role)
        ) {
          throw new Error(
            "Invalid authenticated user response."
          );
        }

        if (controller.signal.aborted) {
          return;
        }

        setUser(data.user);
        setAuthStatus("authenticated");
      } catch (error) {
        if (
          controller.signal.aborted ||
          error?.name === "AbortError"
        ) {
          return;
        }

        console.error(
          "Session verification failed:",
          error
        );

        setUser(null);
        setAuthStatus("error");
      }
    };

    void checkSession();

    return () => {
      controller.abort();
    };
  }, [isLoginRoute, sessionRetryKey]);

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

  // ================= SESSION RETRY =================

  const handleSessionRetry = () => {
    setAuthStatus("loading");

    setSessionRetryKey(
      (previous) => previous + 1
    );
  };

  // ================= AUTH LOADING =================

  if (authStatus === "loading") {
    return <LoadingScreen />;
  }

  // ================= AUTH ERROR =================

  if (authStatus === "error") {
    return (
      <SessionErrorScreen
        onRetry={handleSessionRetry}
      />
    );
  }

  // ================= UNAUTHENTICATED =================

  if (
    authStatus === "unauthenticated" ||
    !user
  ) {
    return (
      <Routes>
        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="*"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />
      </Routes>
    );
  }

  // ================= AUTHENTICATED APP =================

  const defaultRoute = getDefaultRoute(user);

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <Navigate
            to={defaultRoute}
            replace
          />
        }
      />

      <Route
        path="/*"
        element={
          <div
            className="webro-app"
            style={{
              "--current-sidebar-width":
                sidebarWidth,
            }}
          >
            {/* ================= SIDEBAR ================= */}

            <Sidebar
              user={user}
              isOpen={sidebarOpen}
              onClose={handleSidebarClose}
              collapsed={sidebarCollapsed}
              onToggleCollapse={
                handleSidebarCollapse
              }
            />

            {/* ================= MAIN ================= */}

            <div className="webro-app__main">
              <Header
                user={user}
                onMenuClick={
                  handleSidebarOpen
                }
              />

              <main className="webro-app__content">
                <Routes>
                  {/* DEFAULT ROUTE */}

                  <Route
                    index
                    element={
                      <Navigate
                        to={defaultRoute}
                        replace
                      />
                    }
                  />

                  {/* PROTECTED MODULE ROUTES */}

                  {ROUTE_CONFIG.map(
                    ({
                      path,
                      component,
                      roles,
                    }) => (
                      <Route
                        key={path}
                        path={path}
                        element={
                          <ProtectedPage
                            user={user}
                            roles={roles}
                            component={
                              component
                            }
                          />
                        }
                      />
                    )
                  )}

                  {/* UNKNOWN ROUTE */}

                  <Route
                    path="*"
                    element={
                      <Navigate
                        to={defaultRoute}
                        replace
                      />
                    }
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
