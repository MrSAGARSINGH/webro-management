
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Settings as SettingsIcon,
  Building2,
  Bell,
  Palette,
  Database,
  ShieldCheck,
  Save,
  Download,
  Upload,
  Trash2,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Phone,
  Globe,
  MapPin,
  Clock3,
  Info,
} from "lucide-react";

import { settingsApi } from "../../services/settingsApi.js";
import "./Settings.scss";

// ======================================
// Configuration
// ======================================

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api"
).replace(/\/+$/, "");

const MODULE_KEYS = {
  leads: "webro-management-leads-v1",
  clients: "webro-management-clients-v1",
  calling: "webro-management-calling-v1",
  followups: "webro-management-followups-v1",
  projects: "webro-management-projects-v1",
  payments: "webro-management-payments-v1",
  invoices: "webro-management-invoices-v1",
  employees: "webro-management-employees-v1",
  tasks: "webro-management-tasks-v1",
  calendar: "webro-management-calendar-v1",
};

const DEFAULT_SETTINGS = {
  company: {
    name: "WEBRO Studio",
    email: "",
    phone: "",
    website: "https://webro.studio",
    address: "",
    gstin: "",
  },
  preferences: {
    theme: "dark",
    accent: "lime",
    currency: "INR",
    dateFormat: "DD/MM/YYYY",
    compactMode: false,
  },
  notifications: {
    taskReminders: true,
    followUpReminders: true,
    paymentReminders: true,
    projectDeadlines: true,
    desktopNotifications: false,
  },
};

const TABS = [
  { id: "company", label: "Company Profile", icon: Building2 },
  { id: "preferences", label: "Preferences", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "data", label: "Data Management", icon: Database },
];

const cloneDefaults = () =>
  structuredClone(DEFAULT_SETTINGS);

const normalizeSettings = (value) => {
  const defaults = cloneDefaults();

  return {
    company: {
      ...defaults.company,
      ...(value?.company || {}),
    },
    preferences: {
      ...defaults.preferences,
      ...(value?.preferences || {}),
    },
    notifications: {
      ...defaults.notifications,
      ...(value?.notifications || {}),
    },
  };
};

const getErrorMessage = (error) =>
  error instanceof Error
    ? error.message
    : "An unexpected error occurred.";

const readRecords = (key) => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

function downloadJson(data, filename) {
  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

function SettingToggle({
  title,
  description,
  checked,
  onChange,
  disabled = false,
}) {
  return (
    <label className="settings-page__toggle-row">
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>

      <input
        type="checkbox"
        className="settings-page__toggle-input"
        checked={checked}
        onChange={(event) =>
          onChange(event.target.checked)
        }
        disabled={disabled}
      />

      <span
        className="settings-page__toggle"
        aria-hidden="true"
      />
    </label>
  );
}

// ======================================
// Settings Page
// ======================================

export default function Settings() {
  const [settings, setSettings] = useState(cloneDefaults);
  const [savedSettings, setSavedSettings] = useState(cloneDefaults);

  const [activeTab, setActiveTab] = useState("company");
  const [role, setRole] = useState(null);
  const [message, setMessage] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [recordCounts, setRecordCounts] = useState({});
  const fileInputRef = useRef(null);

  const isAdmin = role === "admin";

  const showMessage = (type, text) => {
    setMessage({ type, text });
  };

  // ====================================
  // Browser-Local Record Counts
  // ====================================

  const refreshCounts = useCallback(() => {
    const counts = Object.fromEntries(
      Object.entries(MODULE_KEYS).map(([name, key]) => [
        name,
        readRecords(key).length,
      ])
    );

    setRecordCounts(counts);
  }, []);

  // ====================================
  // Load Authenticated User + Settings
  // ====================================

  useEffect(() => {
    const controller = new AbortController();

    async function loadSettings() {
      setLoading(true);

      try {
        const [settingsResponse, authResponse] =
          await Promise.all([
            settingsApi.getAll({
              signal: controller.signal,
            }),
            fetch(`${API_URL}/auth/me`, {
              method: "GET",
              credentials: "include",
              signal: controller.signal,
              headers: {
                Accept: "application/json",
              },
            }),
          ]);

        const authResult = await authResponse
          .json()
          .catch(() => null);

        if (
          !authResponse.ok ||
          authResult?.success !== true ||
          !authResult.user?.role
        ) {
          throw new Error(
            "Unable to verify your account permissions."
          );
        }

        if (controller.signal.aborted) return;

        const normalized = normalizeSettings(
          settingsResponse.settings
        );

        setSettings(normalized);
        setSavedSettings(structuredClone(normalized));
        setRole(authResult.user.role);
        setMessage(null);
      } catch (error) {
        if (controller.signal.aborted) return;

        setRole(null);
        showMessage(
          "error",
          `Unable to load settings: ${getErrorMessage(error)}`
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadSettings();
    refreshCounts();

    return () => controller.abort();
  }, [refreshCounts]);

  // ====================================
  // Form Updates
  // ====================================

  const updateSection = (section, field, value) => {
    if (loading || saving) return;
    if (section === "company" && !isAdmin) return;

    setSettings((previous) => ({
      ...previous,
      [section]: {
        ...previous[section],
        [field]: value,
      },
    }));

    setMessage(null);
  };

  const updateCompany = (field, value) =>
    updateSection("company", field, value);

  const updatePreference = (field, value) =>
    updateSection("preferences", field, value);

  const updateNotification = (field, value) =>
    updateSection("notifications", field, value);

  // ====================================
  // Validate Company
  // ====================================

  const validateCompany = (company) => {
    if (
      company.name.trim().length < 2 ||
      company.name.trim().length > 150
    ) {
      throw new Error(
        "Company name must contain 2–150 characters."
      );
    }

    if (
      company.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        company.email
      )
    ) {
      throw new Error(
        "Enter a valid company email address."
      );
    }

    if (company.website) {
      try {
        const url = new URL(company.website);

        if (
          !["http:", "https:"].includes(url.protocol) ||
          !url.hostname
        ) {
          throw new Error("Invalid URL");
        }
      } catch {
        throw new Error(
          "Enter a valid HTTP or HTTPS website URL."
        );
      }
    }

    if (
      company.gstin &&
      !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(
        company.gstin
      )
    ) {
      throw new Error("Enter a valid GSTIN.");
    }
  };

  // ====================================
  // Save Active Settings Section
  // ====================================

  const saveSettings = async () => {
    if (saving || loading || !role) return;

    if (activeTab === "data") {
      showMessage(
        "error",
        "Select Company, Preferences or Notifications to save."
      );
      return;
    }

    if (activeTab === "company" && !isAdmin) {
      showMessage(
        "error",
        "Only Admin can update company information."
      );
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const section = activeTab;
      const current = settings[section];
      const previous = savedSettings[section];

      const changes = Object.fromEntries(
        Object.entries(current).filter(
          ([key, value]) => value !== previous[key]
        )
      );

      if (Object.keys(changes).length === 0) {
        showMessage("success", "No changes to save.");
        return;
      }

      if (section === "company") {
        validateCompany(current);
      }

      let result;

      if (section === "company") {
        result = await settingsApi.updateCompany(changes);
      } else if (section === "preferences") {
        result = await settingsApi.updatePreferences(changes);
      } else {
        result = await settingsApi.updateNotifications(changes);
      }

      const updatedSection = {
        ...current,
        ...result[section],
      };

      setSettings((state) => ({
        ...state,
        [section]: updatedSection,
      }));

      setSavedSettings((state) => ({
        ...state,
        [section]: structuredClone(updatedSection),
      }));

      showMessage(
        "success",
        `${
          section === "company"
            ? "Company information"
            : section === "preferences"
              ? "Preferences"
              : "Notification preferences"
        } saved to MongoDB successfully.`
      );
    } catch (error) {
      showMessage(
        "error",
        `Unable to save settings: ${getErrorMessage(error)}`
      );
    } finally {
      setSaving(false);
    }
  };

  // ====================================
  // Browser-Only Backup
  // ====================================

  const exportBackup = () => {
    try {
      const records = Object.fromEntries(
        Object.entries(MODULE_KEYS).map(([name, key]) => [
          name,
          readRecords(key),
        ])
      );

      const backup = {
        application: "WEBRO Management",
        version: 1,
        backupScope: "browser-local-only",
        warning:
          "This backup contains only legacy browser records. MongoDB data and settings are NOT included.",
        exportedAt: new Date().toISOString(),
        records,
      };

      const date = new Date().toISOString().slice(0, 10);

      downloadJson(
        backup,
        `webro-browser-local-backup-${date}.json`
      );

      showMessage(
        "success",
        "Browser-only backup exported. MongoDB records and settings are not included."
      );
    } catch (error) {
      showMessage("error", getErrorMessage(error));
    }
  };

  const restoreBackup = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      if (file.size > 10 * 1024 * 1024) {
        throw new Error(
          "Backup file must be smaller than 10 MB."
        );
      }

      const content = await file.text();
      const backup = JSON.parse(content);

      if (
        backup.application !== "WEBRO Management" ||
        backup.version !== 1 ||
        !backup.records ||
        typeof backup.records !== "object" ||
        Array.isArray(backup.records)
      ) {
        throw new Error(
          "Invalid WEBRO Management backup file."
        );
      }

      if (
        backup.backupScope &&
        backup.backupScope !== "browser-local-only"
      ) {
        throw new Error("Unsupported backup scope.");
      }

      for (const [name, records] of Object.entries(
        backup.records
      )) {
        if (
          !Object.hasOwn(MODULE_KEYS, name) ||
          !Array.isArray(records)
        ) {
          throw new Error(
            "Backup contains invalid module data."
          );
        }
      }

      if (
        !window.confirm(
          "Restore legacy browser-local records? MongoDB records and settings will NOT be changed. Existing local records for included modules will be replaced."
        )
      ) {
        return;
      }

      const previousValues = new Map();

      const updates = Object.entries(
        backup.records
      ).map(([name, records]) => [
        MODULE_KEYS[name],
        JSON.stringify(records),
      ]);

      for (const [key] of updates) {
        previousValues.set(key, localStorage.getItem(key));
      }

      try {
        for (const [key, value] of updates) {
          localStorage.setItem(key, value);
        }
      } catch (error) {
        for (const [key, value] of previousValues) {
          try {
            if (value === null) {
              localStorage.removeItem(key);
            } else {
              localStorage.setItem(key, value);
            }
          } catch {
            // Storage may be unavailable.
          }
        }

        throw error;
      }

      refreshCounts();

      showMessage(
        "success",
        "Legacy browser data restored. MongoDB data remains unchanged."
      );
    } catch (error) {
      showMessage("error", getErrorMessage(error));
    } finally {
      event.target.value = "";
    }
  };

  // ====================================
  // Reset Current Settings Section
  // ====================================

  const resetSettings = async () => {
    if (saving || loading || !role) return;

    if (
      !window.confirm(
        "Reset your personal preferences and notifications to defaults? Company information will remain unchanged."
      )
    ) {
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const defaults = cloneDefaults();

      const [preferencesResult, notificationsResult] =
        await Promise.allSettled([
          settingsApi.updatePreferences(defaults.preferences),
          settingsApi.updateNotifications(defaults.notifications),
        ]);

      // Reload server state even if one request failed.
      const latest = await settingsApi.getAll();
      const normalized = normalizeSettings(latest.settings);

      setSettings(normalized);
      setSavedSettings(structuredClone(normalized));

      if (
        preferencesResult.status === "fulfilled" &&
        notificationsResult.status === "fulfilled"
      ) {
        showMessage(
          "success",
          "Personal settings reset to defaults in MongoDB."
        );
      } else {
        showMessage(
          "error",
          "Some settings could not be reset. Current MongoDB values have been reloaded."
        );
      }
    } catch (error) {
      showMessage(
        "error",
        `Unable to reset settings: ${getErrorMessage(error)}`
      );
    } finally {
      setSaving(false);
    }
  };

  // ====================================
  // Clear Legacy Browser Module
  // ====================================

  const clearModule = (name) => {
    const key = MODULE_KEYS[name];

    if (!key) return;

    if (
      !window.confirm(
        `Delete all legacy ${name} records from this browser? MongoDB records will not be deleted.`
      )
    ) {
      return;
    }

    try {
      localStorage.removeItem(key);
      refreshCounts();

      showMessage(
        "success",
        `Legacy ${name} browser records deleted. MongoDB records were not changed.`
      );
    } catch {
      showMessage(
        "error",
        `Unable to clear ${name} browser records.`
      );
    }
  };

  // ====================================
  // Render
  // ====================================

  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <div>
          <span className="settings-page__eyebrow">
            WORKSPACE CONFIGURATION
          </span>

          <h1>Settings</h1>

          <p>
            Manage company information, preferences,
            notifications and workspace data.
          </p>
        </div>

        <button
          type="button"
          className="settings-page__button settings-page__button--primary"
          onClick={saveSettings}
          disabled={
            loading ||
            saving ||
            !role ||
            activeTab === "data" ||
            (activeTab === "company" && !isAdmin)
          }
        >
          <Save size={17} />
          {saving
            ? "Saving..."
            : loading
              ? "Loading..."
              : "Save Settings"}
        </button>
      </div>

      {message && (
        <div
          role="status"
          className={`settings-page__message settings-page__message--${message.type}`}
        >
          {message.type === "success" ? (
            <CheckCircle2 size={18} />
          ) : (
            <AlertTriangle size={18} />
          )}

          <span>{message.text}</span>
        </div>
      )}

      <div className="settings-page__layout">
        <aside className="settings-page__navigation">
          <div className="settings-page__nav-heading">
            <SettingsIcon size={18} />
            <span>Workspace Settings</span>
          </div>

          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`settings-page__nav-item ${
                activeTab === id
                  ? "settings-page__nav-item--active"
                  : ""
              }`}
              onClick={() => {
                if (saving) return;
                setActiveTab(id);
                setMessage(null);
              }}
              disabled={saving}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}

          <div className="settings-page__nav-footer">
            <ShieldCheck size={17} />
            <p>
              MongoDB-backed settings
              <small>
                Legacy browser data is managed separately.
              </small>
            </p>
          </div>
        </aside>

        <main className="settings-page__content">
          {activeTab === "company" && (
            <section className="settings-page__panel">
              <div className="settings-page__panel-header">
                <div className="settings-page__panel-icon">
                  <Building2 size={21} />
                </div>

                <div>
                  <h2>Company Information</h2>
                  <p>
                    Configure business contact and
                    billing information.
                  </p>
                </div>
              </div>

              <div className="settings-page__form">
                <div className="settings-page__form-grid">
                  <label>
                    Company Name *
                    <div className="settings-page__input">
                      <Building2 size={17} />
                      <input
                        value={settings.company.name}
                        onChange={(e) =>
                          updateCompany("name", e.target.value)
                        }
                        maxLength={150}
                        placeholder="Company name"
                        disabled={loading || saving || !isAdmin}
                      />
                    </div>
                  </label>

                  <label>
                    Email Address
                    <div className="settings-page__input">
                      <Mail size={17} />
                      <input
                        type="email"
                        value={settings.company.email}
                        onChange={(e) =>
                          updateCompany("email", e.target.value)
                        }
                        maxLength={254}
                        placeholder="company@example.com"
                        disabled={loading || saving || !isAdmin}
                      />
                    </div>
                  </label>

                  <label>
                    Phone Number
                    <div className="settings-page__input">
                      <Phone size={17} />
                      <input
                        type="tel"
                        value={settings.company.phone}
                        onChange={(e) =>
                          updateCompany("phone", e.target.value)
                        }
                        maxLength={25}
                        placeholder="Business phone"
                        disabled={loading || saving || !isAdmin}
                      />
                    </div>
                  </label>

                  <label>
                    Website
                    <div className="settings-page__input">
                      <Globe size={17} />
                      <input
                        type="url"
                        value={settings.company.website}
                        onChange={(e) =>
                          updateCompany("website", e.target.value)
                        }
                        maxLength={500}
                        placeholder="https://example.com"
                        disabled={loading || saving || !isAdmin}
                      />
                    </div>
                  </label>

                  <label>
                    GSTIN
                    <div className="settings-page__input">
                      <ShieldCheck size={17} />
                      <input
                        value={settings.company.gstin}
                        onChange={(e) =>
                          updateCompany(
                            "gstin",
                            e.target.value.toUpperCase()
                          )
                        }
                        maxLength={15}
                        placeholder="GST registration number"
                        disabled={loading || saving || !isAdmin}
                      />
                    </div>
                  </label>

                  <label className="settings-page__form-full">
                    Business Address
                    <div className="settings-page__input settings-page__input--textarea">
                      <MapPin size={17} />
                      <textarea
                        value={settings.company.address}
                        onChange={(e) =>
                          updateCompany("address", e.target.value)
                        }
                        rows={3}
                        maxLength={1000}
                        placeholder="Company office address"
                        disabled={loading || saving || !isAdmin}
                      />
                    </div>
                  </label>
                </div>

                <div className="settings-page__notice">
                  <Info size={17} />
                  {isAdmin
                    ? "Company information is stored in MongoDB. Other modules must explicitly integrate these values before using them."
                    : "Company information is read-only. Only an Admin can modify workspace details."}
                </div>
              </div>
            </section>
          )}

          {activeTab === "preferences" && (
            <section className="settings-page__panel">
              <div className="settings-page__panel-header">
                <div className="settings-page__panel-icon">
                  <Palette size={21} />
                </div>

                <div>
                  <h2>Workspace Preferences</h2>
                  <p>
                    Configure your preferred dashboard
                    display options.
                  </p>
                </div>
              </div>

              <div className="settings-page__form">
                <div className="settings-page__form-grid">
                  <label>
                    Dashboard Theme
                    <select
                      value={settings.preferences.theme}
                      onChange={(e) =>
                        updatePreference("theme", e.target.value)
                      }
                      disabled={loading || saving || !role}
                    >
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                      <option value="system">System</option>
                    </select>
                  </label>

                  <label>
                    Accent Color
                    <select
                      value={settings.preferences.accent}
                      onChange={(e) =>
                        updatePreference("accent", e.target.value)
                      }
                      disabled={loading || saving || !role}
                    >
                      <option value="lime">Lime Green</option>
                      <option value="blue">Blue</option>
                      <option value="purple">Purple</option>
                      <option value="orange">Orange</option>
                      <option value="cyan">Cyan</option>
                    </select>
                  </label>

                  <label>
                    Currency
                    <select
                      value={settings.preferences.currency}
                      onChange={(e) =>
                        updatePreference("currency", e.target.value)
                      }
                      disabled={loading || saving || !role}
                    >
                      <option value="INR">INR — Indian Rupee</option>
                      <option value="USD">USD — US Dollar</option>
                      <option value="EUR">EUR — Euro</option>
                    </select>
                  </label>

                  <label>
                    Date Format
                    <select
                      value={settings.preferences.dateFormat}
                      onChange={(e) =>
                        updatePreference("dateFormat", e.target.value)
                      }
                      disabled={loading || saving || !role}
                    >
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </label>
                </div>

                <SettingToggle
                  title="Compact Dashboard"
                  description="Preference for reduced spacing and denser layouts."
                  checked={settings.preferences.compactMode}
                  onChange={(value) =>
                    updatePreference("compactMode", value)
                  }
                  disabled={loading || saving || !role}
                />

                <div className="settings-page__notice">
                  <Info size={17} />
                  Preferences are saved per user in MongoDB.
                  Applying them globally requires connecting
                  these values to the dashboard layout and styles.
                </div>
              </div>
            </section>
          )}

          {activeTab === "notifications" && (
            <section className="settings-page__panel">
              <div className="settings-page__panel-header">
                <div className="settings-page__panel-icon">
                  <Bell size={21} />
                </div>

                <div>
                  <h2>Notification Preferences</h2>
                  <p>
                    Choose which reminders should be
                    enabled when notification delivery
                    is implemented.
                  </p>
                </div>
              </div>

              <div className="settings-page__toggles">
                <SettingToggle
                  title="Task Reminders"
                  description="Reminders for upcoming task deadlines."
                  checked={settings.notifications.taskReminders}
                  onChange={(value) =>
                    updateNotification("taskReminders", value)
                  }
                  disabled={loading || saving || !role}
                />

                <SettingToggle
                  title="Follow-up Reminders"
                  description="Reminders for scheduled client callbacks."
                  checked={settings.notifications.followUpReminders}
                  onChange={(value) =>
                    updateNotification("followUpReminders", value)
                  }
                  disabled={loading || saving || !role}
                />

                <SettingToggle
                  title="Payment Reminders"
                  description="Reminders for upcoming and overdue payments."
                  checked={settings.notifications.paymentReminders}
                  onChange={(value) =>
                    updateNotification("paymentReminders", value)
                  }
                  disabled={loading || saving || !role}
                />

                <SettingToggle
                  title="Project Deadlines"
                  description="Reminders for project delivery dates."
                  checked={settings.notifications.projectDeadlines}
                  onChange={(value) =>
                    updateNotification("projectDeadlines", value)
                  }
                  disabled={loading || saving || !role}
                />

                <SettingToggle
                  title="Desktop Notifications"
                  description="Browser notification permission and delivery are not implemented yet."
                  checked={settings.notifications.desktopNotifications}
                  onChange={(value) =>
                    updateNotification("desktopNotifications", value)
                  }
                  disabled={loading || saving || !role}
                />
              </div>
            </section>
          )}

          {activeTab === "data" && (
            <div className="settings-page__data-panels">
              <section className="settings-page__panel">
                <div className="settings-page__panel-header">
                  <div className="settings-page__panel-icon">
                    <Database size={21} />
                  </div>

                  <div>
                    <h2>Data Backup &amp; Restore</h2>
                    <p>
                      Legacy browser-only records.
                      MongoDB data is not included.
                    </p>
                  </div>
                </div>

                <div className="settings-page__data-actions">
                  <div className="settings-page__data-action">
                    <div>
                      <h3>
                        <Download size={18} />
                        Export Browser Backup
                      </h3>
                      <p>
                        Download legacy browser records only.
                        MongoDB records and settings are excluded.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="settings-page__button settings-page__button--primary"
                      onClick={exportBackup}
                    >
                      <Download size={16} />
                      Export Backup
                    </button>
                  </div>

                  <div className="settings-page__data-action">
                    <div>
                      <h3>
                        <Upload size={18} />
                        Restore Browser Backup
                      </h3>
                      <p>
                        Restore legacy browser data from a
                        compatible JSON backup. MongoDB is unaffected.
                      </p>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,application/json"
                      hidden
                      onChange={restoreBackup}
                    />

                    <button
                      type="button"
                      className="settings-page__button settings-page__button--secondary"
                      onClick={() =>
                        fileInputRef.current?.click()
                      }
                    >
                      <Upload size={16} />
                      Restore Backup
                    </button>
                  </div>
                </div>
              </section>

              <section className="settings-page__panel">
                <div className="settings-page__panel-header">
                  <div className="settings-page__panel-icon">
                    <Trash2 size={21} />
                  </div>

                  <div>
                    <h2>Legacy Browser Data</h2>
                    <p>
                      Review or clear records stored on this device.
                      This does not delete MongoDB data.
                    </p>
                  </div>
                </div>

                <div className="settings-page__module-list">
                  {Object.keys(MODULE_KEYS).map((name) => (
                    <div
                      className="settings-page__module"
                      key={name}
                    >
                      <div>
                        <strong>
                          {name === "followups"
                            ? "Follow-ups"
                            : name.charAt(0).toUpperCase() +
                              name.slice(1)}
                        </strong>

                        <span>
                          {recordCounts[name] || 0} local records
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => clearModule(name)}
                        disabled={!recordCounts[name]}
                        aria-label={`Clear local ${name} records`}
                      >
                        <Trash2 size={16} />
                        Clear
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="settings-page__panel">
                <div className="settings-page__panel-header">
                  <div className="settings-page__panel-icon">
                    <RotateCcw size={21} />
                  </div>

                  <div>
                    <h2>Reset Personal Settings</h2>
                    <p>
                      Restore your preferences and notifications
                      to default values.
                    </p>
                  </div>
                </div>

                <div className="settings-page__reset">
                  <p>
                    Reset personal settings in MongoDB.
                    Company information and module records
                    will remain unchanged.
                  </p>

                  <button
                    type="button"
                    className="settings-page__button settings-page__button--danger"
                    onClick={resetSettings}
                    disabled={saving || loading || !role}
                  >
                    <RotateCcw size={16} />
                    {saving ? "Resetting..." : "Reset Settings"}
                  </button>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>

      <div className="settings-page__footer">
        <span>
          <ShieldCheck size={15} />
          WEBRO Management Workspace
        </span>

        <span>
          <Clock3 size={15} />
          MongoDB Settings Mode
        </span>
      </div>
    </div>
  );
}
