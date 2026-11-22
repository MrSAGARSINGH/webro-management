
import { useEffect, useState } from "react";
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

const navigation = [
  {
    title: "OVERVIEW",
    items: [
      {
        name: "Dashboard",
        path: "/",
        icon: LayoutDashboard,
        end: true,
      },
      {
        name: "Leads",
        path: "/leads",
        icon: UsersRound,
      },
      {
        name: "Clients",
        path: "/clients",
        icon: UserRound,
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
      },
      {
        name: "Follow-ups",
        path: "/follow-ups",
        icon: CalendarClock,
      },
      {
        name: "Payments",
        path: "/payments",
        icon: Wallet,
      },
      {
        name: "Invoices",
        path: "/invoices",
        icon: ReceiptText,
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
      },
      {
        name: "Employees",
        path: "/employees",
        icon: UserCog,
      },
      {
        name: "Tasks",
        path: "/tasks",
        icon: ListTodo,
      },
      {
        name: "Calendar",
        path: "/calendar",
        icon: CalendarDays,
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
      },
      {
        name: "Settings",
        path: "/settings",
        icon: Settings,
      },
    ],
  },
];

export default function Sidebar({
  isOpen = false,
  onClose = () => {},
  collapsed = false,
  onToggleCollapse,
}) {
  const [internalCollapsed, setInternalCollapsed] =
    useState(false);

  const isCollapsed =
    typeof onToggleCollapse === "function"
      ? collapsed
      : internalCollapsed;

  const [openGroups, setOpenGroups] = useState(
    navigation.map((group) => group.title)
  );

  const toggleCollapse = () => {
    if (typeof onToggleCollapse === "function") {
      onToggleCollapse();
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  };

  const toggleGroup = (title) => {
    setOpenGroups((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title]
    );
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <>
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
          isCollapsed && "webro-sidebar--collapsed",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label="Workspace navigation"
      >
        {/* Brand */}

        <div className="webro-sidebar__brand">
          <NavLink
            to="/"
            className="webro-sidebar__brand-link"
            onClick={onClose}
            aria-label="WEBRO Dashboard"
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

        {/* Navigation */}

        <nav className="webro-sidebar__navigation">
          {navigation.map((group) => {
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
                  onClick={() => toggleGroup(group.title)}
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
                          title={isCollapsed ? name : undefined}
                          className={({ isActive }) =>
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

        {/* Footer */}

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

          <div className="webro-sidebar__profile">
            <div className="webro-sidebar__avatar">
              AD
            </div>

            <div className="webro-sidebar__profile-info">
              <strong>Admin</strong>
              <span>Administrator</span>
            </div>
          </div>

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
