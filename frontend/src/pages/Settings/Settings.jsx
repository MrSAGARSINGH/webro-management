
import { useEffect, useRef, useState } from "react";
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

import "./Settings.scss";

const SETTINGS_KEY = "webro-management-settings-v1";

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

const cloneDefaults = () =>
  JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

function readSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);

    if (!raw) return cloneDefaults();

    const parsed = JSON.parse(raw);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return cloneDefaults();
    }

    const defaults = cloneDefaults();

    return {
      company: {
        ...defaults.company,
        ...parsed.company,
      },
      preferences: {
        ...defaults.preferences,
        ...parsed.preferences,
      },
      notifications: {
        ...defaults.notifications,
        ...parsed.notifications,
      },
    };
  } catch {
    return cloneDefaults();
  }
}

function readRecords(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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

export default function Settings() {
  const [settings, setSettings] =
    useState(readSettings);

  const [activeTab, setActiveTab] =
    useState("company");

  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [recordCounts, setRecordCounts] =
    useState({});

  const fileInputRef = useRef(null);

  const showMessage = (type, text) => {
    setMessage({ type, text });
  };

  const refreshCounts = () => {
    const counts = Object.fromEntries(
      Object.entries(MODULE_KEYS).map(
        ([name, key]) => [
          name,
          readRecords(key).length,
        ]
      )
    );

    setRecordCounts(counts);
  };

  useEffect(() => {
    refreshCounts();
  }, []);

  const updateCompany = (field, value) => {
    setSettings((previous) => ({
      ...previous,
      company: {
        ...previous.company,
        [field]: value,
      },
    }));
    setMessage(null);
  };

  const updatePreference = (field, value) => {
    setSettings((previous) => ({
      ...previous,
      preferences: {
        ...previous.preferences,
        [field]: value,
      },
    }));
    setMessage(null);
  };

  const updateNotification = (field, value) => {
    setSettings((previous) => ({
      ...previous,
      notifications: {
        ...previous.notifications,
        [field]: value,
      },
    }));
    setMessage(null);
  };

  const saveSettings = () => {
    const company = settings.company;

    if (!company.name.trim()) {
      showMessage(
        "error",
        "Company name is required."
      );
      return;
    }

    if (
      company.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        company.email
      )
    ) {
      showMessage(
        "error",
        "Enter a valid company email address."
      );
      return;
    }

    if (
      company.website &&
      !/^https?:\/\/[^.\s]+\.[^\s]+$/i.test(
        company.website
      )
    ) {
      showMessage(
        "error",
        "Enter a valid website URL."
      );
      return;
    }

    setSaving(true);

    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify(settings)
      );

      showMessage(
        "success",
        "Workspace settings saved successfully."
      );
    } catch {
      showMessage(
        "error",
        "Unable to save workspace settings."
      );
    } finally {
      setSaving(false);
    }
  };

  const exportBackup = () => {
    try {
      const records = Object.fromEntries(
        Object.entries(MODULE_KEYS).map(
          ([name, key]) => [
            name,
            readRecords(key),
          ]
        )
      );

      const backup = {
        application: "WEBRO Management",
        version: 1,
        backupScope: "browser-local-only",
        warning:
          "Browser localStorage only; MongoDB records are not included.",
        exportedAt: new Date().toISOString(),
        settings,
        records,
      };

      const date = new Date()
        .toISOString()
        .slice(0, 10);

      downloadJson(
        backup,
        `webro-browser-local-backup-${date}.json`
      );

      showMessage(
        "success",
        "Browser-only backup exported. MongoDB records are NOT included."
      );
    } catch {
      showMessage(
        "error",
        "Unable to generate backup."
      );
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
          !(name in MODULE_KEYS) ||
          !Array.isArray(records)
        ) {
          throw new Error(
            "Backup contains invalid module data."
          );
        }
      }

      if (
        !window.confirm(
          "Restore browser-local data only? This will NOT restore MongoDB records. Existing local records in the included modules will be replaced."
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

      if (backup.settings) {
        updates.push([
          SETTINGS_KEY,
          JSON.stringify(backup.settings),
        ]);
      }

      updates.forEach(([key]) => {
        previousValues.set(
          key,
          localStorage.getItem(key)
        );
      });

      try {
        updates.forEach(([key, value]) => {
          localStorage.setItem(key, value);
        });
      } catch (error) {
        previousValues.forEach((value, key) => {
          try {
            if (value === null) {
              localStorage.removeItem(key);
            } else {
              localStorage.setItem(key, value);
            }
          } catch {
            // Browser storage may be unavailable.
          }
        });

        throw error;
      }

      setSettings(readSettings());
      refreshCounts();

      showMessage(
        "success",
        "Backup restored. Reload the dashboard to refresh all modules."
      );
    } catch (error) {
      showMessage(
        "error",
        error.message || "Backup restore failed."
      );
    } finally {
      event.target.value = "";
    }
  };

  const resetSettings = () => {
    if (
      !window.confirm(
        "Reset workspace settings to defaults?"
      )
    ) {
      return;
    }

    const defaults = cloneDefaults();

    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify(defaults)
      );

      setSettings(defaults);

      showMessage(
        "success",
        "Workspace settings reset to defaults."
      );
    } catch {
      showMessage(
        "error",
        "Unable to reset settings."
      );
    }
  };

  const clearModule = (name) => {
    const key = MODULE_KEYS[name];

    if (!key) return;

    if (
      !window.confirm(
        `Delete all ${name} records from this browser? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      localStorage.removeItem(key);
      refreshCounts();

      showMessage(
        "success",
        `${name} records deleted successfully. Reload other open views to refresh them.`
      );
    } catch {
      showMessage(
        "error",
        `Unable to delete ${name} records.`
      );
    }
  };

  const tabs = [
    {
      id: "company",
      label: "Company Profile",
      icon: Building2,
    },
    {
      id: "preferences",
      label: "Preferences",
      icon: Palette,
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: Bell,
    },
    {
      id: "data",
      label: "Data Management",
      icon: Database,
    },
  ];

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
          disabled={saving}
        >
          <Save size={17} />
          Save Settings
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

          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`settings-page__nav-item ${
                activeTab === id
                  ? "settings-page__nav-item--active"
                  : ""
              }`}
              onClick={() => {
                setActiveTab(id);
                setMessage(null);
              }}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}

          <div className="settings-page__nav-footer">
            <ShieldCheck size={17} />
            <p>
              Browser-local workspace
              <small>
                Data is stored on this device.
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
                          updateCompany(
                            "name",
                            e.target.value
                          )
                        }
                        maxLength={120}
                        placeholder="Company name"
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
                          updateCompany(
                            "email",
                            e.target.value
                          )
                        }
                        placeholder="company@example.com"
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
                          updateCompany(
                            "phone",
                            e.target.value
                          )
                        }
                        placeholder="Business phone"
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
                          updateCompany(
                            "website",
                            e.target.value
                          )
                        }
                        placeholder="https://example.com"
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
                          updateCompany(
                            "address",
                            e.target.value
                          )
                        }
                        rows={3}
                        maxLength={500}
                        placeholder="Company office address"
                      />
                    </div>
                  </label>
                </div>

                <div className="settings-page__notice">
                  <Info size={17} />
                  Company details are saved locally.
                  Existing invoices and other modules
                  will not automatically use these
                  values until integrated.
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
                      value={
                        settings.preferences.theme
                      }
                      onChange={(e) =>
                        updatePreference(
                          "theme",
                          e.target.value
                        )
                      }
                    >
                      <option value="dark">
                        Dark
                      </option>
                      <option value="light">
                        Light
                      </option>
                    </select>
                  </label>

                  <label>
                    Accent Color
                    <select
                      value={
                        settings.preferences.accent
                      }
                      onChange={(e) =>
                        updatePreference(
                          "accent",
                          e.target.value
                        )
                      }
                    >
                      <option value="lime">
                        Lime Green
                      </option>
                      <option value="blue">
                        Blue
                      </option>
                      <option value="purple">
                        Purple
                      </option>
                    </select>
                  </label>

                  <label>
                    Currency
                    <select
                      value={
                        settings.preferences.currency
                      }
                      onChange={(e) =>
                        updatePreference(
                          "currency",
                          e.target.value
                        )
                      }
                    >
                      <option value="INR">
                        INR — Indian Rupee
                      </option>
                    </select>
                  </label>

                  <label>
                    Date Format
                    <select
                      value={
                        settings.preferences.dateFormat
                      }
                      onChange={(e) =>
                        updatePreference(
                          "dateFormat",
                          e.target.value
                        )
                      }
                    >
                      <option value="DD/MM/YYYY">
                        DD/MM/YYYY
                      </option>
                      <option value="YYYY-MM-DD">
                        YYYY-MM-DD
                      </option>
                    </select>
                  </label>
                </div>

                <SettingToggle
                  title="Compact Dashboard"
                  description="Preference for reduced spacing and denser layouts."
                  checked={
                    settings.preferences.compactMode
                  }
                  onChange={(value) =>
                    updatePreference(
                      "compactMode",
                      value
                    )
                  }
                />

                <div className="settings-page__notice">
                  <Info size={17} />
                  These are stored preferences.
                  Applying theme, accent, date format
                  and compact mode across the dashboard
                  requires connecting them to the global
                  layout and styles.
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
                  checked={
                    settings.notifications.taskReminders
                  }
                  onChange={(value) =>
                    updateNotification(
                      "taskReminders",
                      value
                    )
                  }
                />

                <SettingToggle
                  title="Follow-up Reminders"
                  description="Reminders for scheduled client callbacks."
                  checked={
                    settings.notifications.followUpReminders
                  }
                  onChange={(value) =>
                    updateNotification(
                      "followUpReminders",
                      value
                    )
                  }
                />

                <SettingToggle
                  title="Payment Reminders"
                  description="Reminders for upcoming and overdue payments."
                  checked={
                    settings.notifications.paymentReminders
                  }
                  onChange={(value) =>
                    updateNotification(
                      "paymentReminders",
                      value
                    )
                  }
                />

                <SettingToggle
                  title="Project Deadlines"
                  description="Reminders for project delivery dates."
                  checked={
                    settings.notifications.projectDeadlines
                  }
                  onChange={(value) =>
                    updateNotification(
                      "projectDeadlines",
                      value
                    )
                  }
                />

                <SettingToggle
                  title="Desktop Notifications"
                  description="Preference for browser notifications. Permission and delivery are not implemented yet."
                  checked={
                    settings.notifications.desktopNotifications
                  }
                  onChange={(value) =>
                    updateNotification(
                      "desktopNotifications",
                      value
                    )
                  }
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
                    <h2>Data Backup & Restore</h2>
                    <p>
                      Export or restore browser-only records. MongoDB data is not included.
                    </p>
                  </div>
                </div>

                <div className="settings-page__data-actions">
                  <div className="settings-page__data-action">
                    <div>
                      <h3>
                        <Download size={18} />
                        Export Workspace Backup
                      </h3>
                      <p>
                        Download local settings and browser records only. This is not a MongoDB backup.
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
                        Restore Workspace Backup
                      </h3>
                      <p>
                        Restore browser-local data from a compatible WEBRO Management backup file. MongoDB is unaffected.
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
                    <h2>Module Data Management</h2>
                    <p>
                      Review and delete individual
                      module records.
                    </p>
                  </div>
                </div>

                <div className="settings-page__module-list">
                  {Object.keys(MODULE_KEYS).map(
                    (name) => (
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
                            {recordCounts[name] || 0} records
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            clearModule(name)
                          }
                          disabled={
                            !recordCounts[name]
                          }
                          aria-label={`Delete all ${name} records`}
                        >
                          <Trash2 size={16} />
                          Clear
                        </button>
                      </div>
                    )
                  )}
                </div>
              </section>

              <section className="settings-page__panel">
                <div className="settings-page__panel-header">
                  <div className="settings-page__panel-icon">
                    <RotateCcw size={21} />
                  </div>

                  <div>
                    <h2>Reset Settings</h2>
                    <p>
                      Restore workspace preferences
                      to default values.
                    </p>
                  </div>
                </div>

                <div className="settings-page__reset">
                  <p>
                    This resets company information,
                    preferences and notification
                    settings. Module records remain
                    unchanged.
                  </p>

                  <button
                    type="button"
                    className="settings-page__button settings-page__button--danger"
                    onClick={resetSettings}
                  >
                    <RotateCcw size={16} />
                    Reset Settings
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
          Local Storage Mode
        </span>
      </div>
    </div>
  );
}
