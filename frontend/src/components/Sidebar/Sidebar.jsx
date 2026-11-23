
import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";

import {
  LayoutDashboard,
  UsersRound,
  UserRound,
  PhoneCall,
  CalendarClock,
  FolderKanban,
  Wallet,
  ReceiptText,
  UserCog,
  ListTodo,
  CalendarDays,
  ChartNoAxesCombined,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";

import "./Sidebar.scss";

// ======================================
// ROLE PERMISSIONS
// Must match App.jsx route permissions
// ======================================

const ALL_ROLES = ["admin", "manager", "employee"];
const MANAGEMENT_ROLES = ["admin", "manager"];

const navigation = [
  {
    title: "OVERVIEW",
    items: [
      {
        name: "Dashboard",
        path: "/dashboard",
        icon: LayoutDashboard,
        roles: MANAGEMENT_ROLES,
      },
      {
        name: "Leads",
        path: "/leads",
        icon: UsersRound,
        roles: ALL_ROLES,
      },
      {
        name: "Clients",
        path: "/clients",
        icon: UserRound,
        roles: MANAGEMENT_ROLES,
      },
    ],
  },
  {
    title: "SALES & FINANCE",
    items: [
      {
        name: "Calling",
        path: "/calling",
        icon: PhoneCall,
        roles: ALL_ROLES,
      },
      {
        name: "Follow-ups",
        path: "/follow-ups",
        icon: CalendarClock,
        roles: ALL_ROLES,
      },
      {
        name: "Payments",
        path: "/payments",
        icon: Wallet,
        roles: MANAGEMENT_ROLES,
      },
      {
        name: "Invoices",
        path: "/invoices",
        icon: ReceiptText,
        roles: MANAGEMENT_ROLES,
      },
    ],
  },
  {
    title: "OPERATIONS",
    items: [
      {
        name: "Projects",
        path: "/projects",
        icon: FolderKanban,
        roles: ALL_ROLES,
      },
      {
        name: "Employees",
        path: "/employees",
        icon: UserCog,
        roles: MANAGEMENT_ROLES,
      },
      {
        name: "Tasks",
        path: "/tasks",
        icon: ListTodo,
        roles: MANAGEMENT_ROLES,
      },
      {
        name: "Calendar",
        path: "/calendar",
        icon: CalendarDays,
        roles: MANAGEMENT_ROLES,
      },
    ],
  },
  {
    title: "WORKSPACE",
    items: [
      {
        name: "Reports",
        path: "/reports",
        icon: ChartNoAxesCombined,
        roles: MANAGEMENT_ROLES,
      },
      {
        name: "Settings",
        path: "/settings",
        icon: Settings,
        roles: MANAGEMENT_ROLES,
      },
    ],
  },
];

// ======================================
// HELPERS
// ======================================

const getInitials = (name) => {
  if (!name || typeof name !== "string") {
    return "U";
  }

  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "U";
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
};

const getRoleLabel = (role) => {
  const labels = {
    admin: "Administrator",
    manager: "Manager",
    employee: "Employee",
  };

  return labels[role] || "User";
};

const getDefaultRoute = (role) =>
  role === "employee" ? "/leads" : "/dashboard";

// ======================================
// SIDEBAR COMPONENT
// ======================================

export default function Sidebar({
  user,
  isOpen = false,
  onClose = () => {},
  collapsed = false,
  onToggleCollapse,
}) {
  const [internalCollapsed, setInternalCollapsed] =
    useState(false);

  const [openGroups, setOpenGroups] = useState(
    navigation.map((group) => group.title)
  );

  const isCollapsed =
    typeof onToggleCollapse === "function"
      ? collapsed
      : internalCollapsed;

  const role = user?.role || "";

  const userName =
    typeof user?.name === "string" &&
    user.name.trim()
      ? user.name.trim()
      : "User";

  const userInitials = getInitials(userName);
  const roleLabel = getRoleLabel(role);
  const homeRoute = getDefaultRoute(role);

  // ======================================
  // FILTER NAVIGATION BY ROLE
  // ======================================

  const visibleNavigation = useMemo(() => {
    if (!ALL_ROLES.includes(role)) {
      return [];
    }

    return navigation
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          item.roles.includes(role)
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [role]);

  // ======================================
  // COLLAPSE SIDEBAR
  // ======================================

  const toggleCollapse = () => {
    if (typeof onToggleCollapse === "function") {
      onToggleCollapse();
    } else {
      setInternalCollapsed((previous) => !previous);
    }
  };

  // ======================================
  // TOGGLE NAVIGATION GROUP
  // ======================================

  const toggleGroup = (title) => {
    setOpenGroups((previous) =>
      previous.includes(title)
        ? previous.filter((item) => item !== title)
        : [...previous, title]
    );
  };

  // ======================================
  // CLOSE MOBILE SIDEBAR ON ESCAPE
  // ======================================

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [isOpen, onClose]);

  // ======================================
  // RENDER
  // ======================================

  return (
    <>
      {/* MOBILE OVERLAY */}

      {isOpen && (
        <button
          type="button"
          className="webro-sidebar-overlay"
          onClick={onClose}
          aria-label="Close navigation"
          tabIndex={-1}
        />
      )}

      <aside
        id="webro-sidebar"
        className={[
          "webro-sidebar",
          isOpen && "webro-sidebar--open",
          isCollapsed &&
            "webro-sidebar--collapsed",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label="Workspace navigation"
      >
        {/* ================= BRAND ================= */}

        <div className="webro-sidebar__brand">
          <NavLink
            to={homeRoute}
            className="webro-sidebar__brand-link"
            onClick={onClose}
            aria-label="WEBRO Workspace Home"
          >
            <div className="webro-sidebar__logo">
              <span>W</span>
            </div>

            <div className="webro-sidebar__brand-text">
              <strong>WEBRO</strong>
              <span>MANAGEMENT</span>
            </div>
          </NavLink>

          <button
            type="button"
            className="webro-sidebar__mobile-close"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        {/* ================= NAVIGATION ================= */}

        <nav className="webro-sidebar__navigation">
          {visibleNavigation.map((group) => {
            const groupOpen =
              isCollapsed ||
              openGroups.includes(group.title);

            return (
              <div
                className="webro-sidebar__group"
                key={group.title}
              >
                <button
                  type="button"
                  className="webro-sidebar__group-title"
                  onClick={() =>
                    toggleGroup(group.title)
                  }
                  aria-expanded={groupOpen}
                  disabled={isCollapsed}
                >
                  <span>{group.title}</span>

                  <ChevronDown
                    size={14}
                    className={
                      groupOpen ? "is-open" : ""
                    }
                  />
                </button>

                {groupOpen && (
                  <div className="webro-sidebar__links">
                    {group.items.map(
                      ({
                        name,
                        path,
                        icon: Icon,
                        end,
                      }) => (
                        <NavLink
                          key={path}
                          to={path}
                          end={end}
                          onClick={onClose}
                          title={
                            isCollapsed
                              ? name
                              : undefined
                          }
                          className={({
                            isActive,
                          }) =>
                            [
                              "webro-sidebar__link",
                              isActive &&
                                "webro-sidebar__link--active",
                            ]
                              .filter(Boolean)
                              .join(" ")
                          }
                        >
                          <Icon
                            size={19}
                            strokeWidth={1.8}
                            aria-hidden="true"
                          />

                          <span className="webro-sidebar__link-text">
                            {name}
                          </span>

                          <span className="webro-sidebar__active-indicator" />
                        </NavLink>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* ================= FOOTER ================= */}

        <div className="webro-sidebar__footer">
          <div className="webro-sidebar__workspace">
            <div className="webro-sidebar__workspace-icon">
              <ShieldCheck size={17} />
            </div>

            <div className="webro-sidebar__workspace-text">
              <strong>WEBRO Workspace</strong>
              <span>Internal Management</span>
            </div>
          </div>

          {/* LOGGED-IN USER PROFILE */}

          <div className="webro-sidebar__profile">
            <div className="webro-sidebar__avatar">
              {userInitials}
            </div>

            <div className="webro-sidebar__profile-info">
              <strong title={userName}>
                {userName}
              </strong>

              <span>{roleLabel}</span>
            </div>
          </div>

          {/* COLLAPSE / EXPAND */}

          <button
            type="button"
            className="webro-sidebar__collapse"
            onClick={toggleCollapse}
            aria-label={
              isCollapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
            }
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}

            <span>
              {isCollapsed
                ? "Expand"
                : "Collapse sidebar"}
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}
