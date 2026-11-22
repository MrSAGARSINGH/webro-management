
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Menu,
  Search,
  Bell,
  ChevronDown,
  CalendarDays,
  UserRound,
  Settings,
  X,
  ArrowRight,
  CheckCheck,
  ShieldCheck,
  LayoutDashboard,
  UsersRound,
  PhoneCall,
  CalendarClock,
  FolderKanban,
  Wallet,
  ReceiptText,
  UserCog,
  ListTodo,
  ChartNoAxesCombined,
} from "lucide-react";

import "./Header.scss";

// ================= PAGE CONFIGURATION =================

const pages = [
  {
    label: "Dashboard",
    path: "/",
    icon: LayoutDashboard,
    subtitle: "Your business at a glance",
  },
  {
    label: "Leads",
    path: "/leads",
    icon: UsersRound,
    subtitle: "Track and convert opportunities",
  },
  {
    label: "Clients",
    path: "/clients",
    icon: UserRound,
    subtitle: "Manage client relationships",
  },
  {
    label: "Calling",
    path: "/calling",
    icon: PhoneCall,
    subtitle: "Monitor calls and conversations",
  },
  {
    label: "Follow-ups",
    path: "/follow-ups",
    icon: CalendarClock,
    subtitle: "Stay on top of every follow-up",
  },
  {
    label: "Projects",
    path: "/projects",
    icon: FolderKanban,
    subtitle: "Track progress and delivery",
  },
  {
    label: "Payments",
    path: "/payments",
    icon: Wallet,
    subtitle: "Manage payments and collections",
  },
  {
    label: "Invoices",
    path: "/invoices",
    icon: ReceiptText,
    subtitle: "Manage invoices and quotations",
  },
  {
    label: "Employees",
    path: "/employees",
    icon: UserCog,
    subtitle: "Manage your workforce",
  },
  {
    label: "Tasks",
    path: "/tasks",
    icon: ListTodo,
    subtitle: "Organize and complete work",
  },
  {
    label: "Calendar",
    path: "/calendar",
    icon: CalendarDays,
    subtitle: "Your schedule and reminders",
  },
  {
    label: "Reports",
    path: "/reports",
    icon: ChartNoAxesCombined,
    subtitle: "Insights and business performance",
  },
  {
    label: "Settings",
    path: "/settings",
    icon: Settings,
    subtitle: "Configure your workspace",
  },
];

// ================= DEMO NOTIFICATIONS =================

const initialNotifications = [
  {
    id: 1,
    title: "Payment follow-up",
    description: "Check pending client payments",
    time: "Today",
    read: false,
  },
  {
    id: 2,
    title: "Client follow-ups",
    description: "Review scheduled client calls",
    time: "Today",
    read: false,
  },
  {
    id: 3,
    title: "Project updates",
    description: "Review active project progress",
    time: "Reminder",
    read: true,
  },
];

const formatDate = () =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date());

// ================= HEADER COMPONENT =================

export default function Header({ onMenuClick }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] =
    useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const [notifications, setNotifications] = useState(
    initialNotifications
  );

  const searchRef = useRef(null);
  const searchInputRef = useRef(null);
  const notificationRef = useRef(null);
  const profileRef = useRef(null);

  const activePage =
    pages.find((page) => page.path === location.pathname) ??
    pages[0];

  const CurrentPageIcon = activePage.icon;

  const filteredPages = pages.filter((page) =>
    page.label
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  const unreadCount = notifications.filter(
    (item) => !item.read
  ).length;

  // ================= HANDLERS =================

  const closeDropdowns = () => {
    setSearchOpen(false);
    setNotificationOpen(false);
    setProfileOpen(false);
  };

  const openSearch = () => {
    setSearchOpen(true);
    setNotificationOpen(false);
    setProfileOpen(false);

    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  };

  const handleNavigate = (path) => {
    navigate(path);
    setSearch("");
    closeDropdowns();
  };

  const markAllRead = () => {
    setNotifications((previous) =>
      previous.map((item) => ({
        ...item,
        read: true,
      }))
    );
  };

  // ================= GLOBAL EVENTS =================

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target)
      ) {
        setSearchOpen(false);
      }

      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setNotificationOpen(false);
      }

      if (
        profileRef.current &&
        !profileRef.current.contains(event.target)
      ) {
        setProfileOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
        setNotificationOpen(false);
        setProfileOpen(false);
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        setSearchOpen(true);
        setNotificationOpen(false);
        setProfileOpen(false);

        requestAnimationFrame(() => {
          searchInputRef.current?.focus();
        });
      }
    };

    document.addEventListener(
      "pointerdown",
      handlePointerDown
    );

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDown
      );

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchOpen(false);
      setNotificationOpen(false);
      setProfileOpen(false);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [location.pathname]);

  // ================= RENDER =================

  return (
    <header className="webro-header">
      {/* ================= LEFT SECTION ================= */}

      <div className="webro-header__left">
        <button
          type="button"
          className="webro-header__menu"
          onClick={onMenuClick}
          aria-label="Open navigation"
          aria-controls="webro-sidebar"
        >
          <Menu size={21} />
        </button>

        <div className="webro-header__page-icon">
          <CurrentPageIcon
            size={21}
            strokeWidth={1.9}
            aria-hidden="true"
          />
        </div>

        <div className="webro-header__heading">
          <div className="webro-header__title-row">
            <h1>{activePage.label}</h1>

            {activePage.path === "/" && (
              <span className="webro-header__page-badge">
                Overview
              </span>
            )}
          </div>

          <p>{activePage.subtitle}</p>
        </div>
      </div>

      {/* ================= RIGHT SECTION ================= */}

      <div className="webro-header__right">
        {/* Date */}

        <div className="webro-header__date">
          <CalendarDays size={16} />
          <span>{formatDate()}</span>
        </div>

        {/* Search */}

        <div
          className={`webro-header__search-wrap ${
            searchOpen
              ? "webro-header__search-wrap--open"
              : ""
          }`}
          ref={searchRef}
        >
          <button
            type="button"
            className="webro-header__mobile-search"
            onClick={openSearch}
            aria-label="Search pages"
            aria-expanded={searchOpen}
          >
            <Search size={19} />
          </button>

          <div className="webro-header__search">
            <Search
              size={18}
              className="webro-header__search-icon"
            />

            <input
              ref={searchInputRef}
              type="search"
              value={search}
              placeholder="Search pages..."
              aria-label="Search workspace pages"
              aria-expanded={searchOpen}
              aria-controls="webro-search-results"
              onFocus={() => setSearchOpen(true)}
              onChange={(event) => {
                setSearch(event.target.value);
                setSearchOpen(true);
              }}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  filteredPages.length > 0
                ) {
                  handleNavigate(filteredPages[0].path);
                }
              }}
            />

            <kbd>Ctrl K</kbd>

            <button
              type="button"
              className="webro-header__search-close"
              onClick={() => {
                setSearchOpen(false);
                setSearch("");
              }}
              aria-label="Close search"
            >
              <X size={17} />
            </button>
          </div>

          {searchOpen && (
            <div
              id="webro-search-results"
              className="webro-header__dropdown webro-header__search-results"
            >
              <div className="webro-header__dropdown-heading">
                <span>Navigate to page</span>

                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  aria-label="Close search results"
                >
                  <X size={16} />
                </button>
              </div>

              {filteredPages.length > 0 ? (
                <div className="webro-header__results-list">
                  {filteredPages.map((page) => {
                    const PageIcon = page.icon;

                    return (
                      <button
                        type="button"
                        key={page.path}
                        onClick={() =>
                          handleNavigate(page.path)
                        }
                      >
                        <span className="webro-header__result-name">
                          <PageIcon size={16} />
                          {page.label}
                        </span>

                        <ArrowRight size={15} />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="webro-header__empty">
                  No matching pages found.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Notifications */}

        <div
          className="webro-header__action-wrap"
          ref={notificationRef}
        >
          <button
            type="button"
            className="webro-header__icon-button"
            aria-label={`Notifications, ${unreadCount} unread`}
            aria-expanded={notificationOpen}
            onClick={() => {
              setNotificationOpen((previous) => !previous);
              setProfileOpen(false);
              setSearchOpen(false);
            }}
          >
            <Bell size={19} />

            {unreadCount > 0 && (
              <span className="webro-header__notification-dot" />
            )}
          </button>

          {notificationOpen && (
            <div className="webro-header__dropdown webro-header__notifications">
              <div className="webro-header__dropdown-heading">
                <strong>Notifications</strong>

                <button
                  type="button"
                  onClick={markAllRead}
                  disabled={unreadCount === 0}
                  title="Mark all as read"
                  aria-label="Mark all notifications as read"
                >
                  <CheckCheck size={17} />
                </button>
              </div>

              <div className="webro-header__notification-list">
                {notifications.map((item) => (
                  <div
                    key={item.id}
                    className={`webro-header__notification-item ${
                      !item.read ? "is-unread" : ""
                    }`}
                  >
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.description}</p>
                      <small>{item.time}</small>
                    </div>

                    {!item.read && (
                      <span className="webro-header__unread-dot" />
                    )}
                  </div>
                ))}
              </div>

              <p className="webro-header__demo-note">
                Demo reminders — live notifications
                coming later
              </p>
            </div>
          )}
        </div>

        {/* Profile */}

        <div
          className="webro-header__action-wrap"
          ref={profileRef}
        >
          <button
            type="button"
            className="webro-header__profile"
            aria-expanded={profileOpen}
            aria-label="Open profile menu"
            onClick={() => {
              setProfileOpen((previous) => !previous);
              setNotificationOpen(false);
              setSearchOpen(false);
            }}
          >
            <span className="webro-header__avatar">
              AD
            </span>

            <span className="webro-header__profile-info">
              <strong>Admin</strong>
              <small>Administrator</small>
            </span>

            <ChevronDown
              size={15}
              className={
                profileOpen ? "is-open" : ""
              }
            />
          </button>

          {profileOpen && (
            <div className="webro-header__dropdown webro-header__profile-menu">
              <div className="webro-header__profile-top">
                <span className="webro-header__avatar">
                  AD
                </span>

                <div>
                  <strong>Admin</strong>
                  <small>Demo workspace</small>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  handleNavigate("/settings")
                }
              >
                <Settings size={17} />
                <span>Workspace Settings</span>
              </button>

              <div className="webro-header__profile-status">
                <ShieldCheck size={16} />
                Authentication not configured
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
