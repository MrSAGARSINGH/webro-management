
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  X,
  Pencil,
  Trash2,
  Phone,
  Mail,
  CalendarDays,
  UsersRound,
  UserCheck,
  Clock3,
  TrendingUp,
  Filter,
  ExternalLink,
} from "lucide-react";

import "./Leads.scss";

const STORAGE_KEY = "webro-management-leads-v1";

const STATUS_OPTIONS = [
  "New",
  "Contacted",
  "Interested",
  "Proposal Sent",
  "Negotiation",
  "Won",
  "Lost",
];

const PRIORITY_OPTIONS = ["Low", "Medium", "High"];

const SOURCE_OPTIONS = [
  "Website",
  "Google Maps",
  "Instagram",
  "Facebook",
  "LinkedIn",
  "Referral",
  "Cold Calling",
  "Other",
];

const EMPTY_FORM = {
  name: "",
  business: "",
  phone: "",
  email: "",
  service: "",
  source: "Website",
  status: "New",
  priority: "Medium",
  assignedTo: "",
  estimatedValue: "",
  nextFollowUp: "",
  notes: "",
};

const currency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (value) => {
  if (!value) return "Not scheduled";

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime())
    ? "Invalid date"
    : new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
};

const readLeads = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];

    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

function LeadModal({ lead, onClose, onSave }) {
  const [form, setForm] = useState(
    lead
      ? {
          ...EMPTY_FORM,
          ...lead,
          estimatedValue: String(lead.estimatedValue ?? ""),
        }
      : EMPTY_FORM
  );

  const [error, setError] = useState("");

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);

    return () =>
      document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const update = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
  };

  const submit = (event) => {
    event.preventDefault();

    const name = form.name.trim();
    const phone = form.phone.trim();
    const email = form.email.trim();

    if (!name) {
      setError("Lead name is required.");
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }

    if (
      email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      setError("Enter a valid email address.");
      return;
    }

    const amount =
      form.estimatedValue === ""
        ? 0
        : Number(form.estimatedValue);

    if (
      !Number.isFinite(amount) ||
      amount < 0 ||
      amount > 1000000000
    ) {
      setError("Enter a valid estimated project value.");
      return;
    }

    onSave({
      ...form,
      name,
      business: form.business.trim(),
      phone,
      email,
      service: form.service.trim(),
      assignedTo: form.assignedTo.trim(),
      notes: form.notes.trim(),
      estimatedValue: amount,
    });
  };

  return (
    <div
      className="leads__modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="leads__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-modal-title"
      >
        <div className="leads__modal-header">
          <div>
            <h2 id="lead-modal-title">
              {lead ? "Edit Lead" : "Add New Lead"}
            </h2>
            <p>Manage client enquiry information</p>
          </div>

          <button
            type="button"
            className="leads__icon-button"
            onClick={onClose}
            aria-label="Close form"
          >
            <X size={19} />
          </button>
        </div>

        <form onSubmit={submit} className="leads__form">
          <div className="leads__form-grid">
            <label>
              Lead Name <span>*</span>
              <input
                name="name"
                value={form.name}
                onChange={update}
                placeholder="Client name"
                required
                maxLength={100}
              />
            </label>

            <label>
              Business Name
              <input
                name="business"
                value={form.business}
                onChange={update}
                placeholder="Company or business"
                maxLength={120}
              />
            </label>

            <label>
              Phone Number <span>*</span>
              <input
                name="phone"
                type="tel"
                inputMode="numeric"
                value={form.phone}
                onChange={update}
                placeholder="9876543210"
                maxLength={10}
                required
              />
            </label>

            <label>
              Email Address
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={update}
                placeholder="client@example.com"
                maxLength={254}
              />
            </label>

            <label>
              Required Service
              <input
                name="service"
                value={form.service}
                onChange={update}
                placeholder="Website Development"
                maxLength={120}
              />
            </label>

            <label>
              Lead Source
              <select
                name="source"
                value={form.source}
                onChange={update}
              >
                {SOURCE_OPTIONS.map((source) => (
                  <option key={source}>{source}</option>
                ))}
              </select>
            </label>

            <label>
              Lead Status
              <select
                name="status"
                value={form.status}
                onChange={update}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>

            <label>
              Priority
              <select
                name="priority"
                value={form.priority}
                onChange={update}
              >
                {PRIORITY_OPTIONS.map((priority) => (
                  <option key={priority}>{priority}</option>
                ))}
              </select>
            </label>

            <label>
              Assigned Employee
              <input
                name="assignedTo"
                value={form.assignedTo}
                onChange={update}
                placeholder="Employee name"
                maxLength={100}
              />
            </label>

            <label>
              Estimated Value (₹)
              <input
                name="estimatedValue"
                type="number"
                min="0"
                max="1000000000"
                step="1"
                value={form.estimatedValue}
                onChange={update}
                placeholder="25000"
              />
            </label>

            <label>
              Next Follow-up
              <input
                name="nextFollowUp"
                type="date"
                value={form.nextFollowUp}
                onChange={update}
              />
            </label>

            <label className="leads__form-full">
              Notes
              <textarea
                name="notes"
                value={form.notes}
                onChange={update}
                placeholder="Discussion details, requirements..."
                rows={4}
                maxLength={2000}
              />
            </label>
          </div>

          {error && (
            <p className="leads__form-error" role="alert">
              {error}
            </p>
          )}

          <div className="leads__modal-actions">
            <button
              type="button"
              className="leads__button leads__button--secondary"
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="leads__button leads__button--primary"
            >
              {lead ? "Save Changes" : "Create Lead"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function Leads() {
  const [leads, setLeads] = useState(readLeads);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [storageError, setStorageError] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
      setStorageError("");
    } catch {
      setStorageError(
        "Unable to save changes in browser storage."
      );
    }
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();

    return leads.filter((lead) => {
      const matchesSearch = [
        lead.name,
        lead.business,
        lead.phone,
        lead.email,
        lead.service,
        lead.assignedTo,
      ].some((field) =>
        String(field ?? "").toLowerCase().includes(query)
      );

      return (
        matchesSearch &&
        (statusFilter === "All" ||
          lead.status === statusFilter) &&
        (priorityFilter === "All" ||
          lead.priority === priorityFilter)
      );
    });
  }, [leads, search, statusFilter, priorityFilter]);

  const stats = useMemo(
    () => ({
      total: leads.length,
      new: leads.filter((lead) => lead.status === "New").length,
      interested: leads.filter((lead) =>
        ["Interested", "Proposal Sent", "Negotiation"].includes(
          lead.status
        )
      ).length,
      won: leads.filter((lead) => lead.status === "Won").length,
      pipeline: leads
        .filter((lead) => !["Won", "Lost"].includes(lead.status))
        .reduce(
          (sum, lead) =>
            sum + (Number(lead.estimatedValue) || 0),
          0
        ),
    }),
    [leads]
  );

  const openAdd = () => {
    setEditingLead(null);
    setModalOpen(true);
  };

  const openEdit = (lead) => {
    setEditingLead(lead);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingLead(null);
  };

  const saveLead = (form) => {
    const timestamp = new Date().toISOString();

    if (editingLead) {
      setLeads((previous) =>
        previous.map((lead) =>
          lead.id === editingLead.id
            ? { ...lead, ...form, updatedAt: timestamp }
            : lead
        )
      );
    } else {
      setLeads((previous) => [
        {
          ...form,
          id: crypto.randomUUID(),
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        ...previous,
      ]);
    }

    closeModal();
  };

  const deleteLead = (lead) => {
    if (
      !window.confirm(
        `Delete lead "${lead.name}"? This cannot be undone.`
      )
    ) {
      return;
    }

    setLeads((previous) =>
      previous.filter((item) => item.id !== lead.id)
    );
  };

  return (
    <div className="leads">
      <div className="leads__header">
        <div>
          <span className="leads__eyebrow">
            SALES MANAGEMENT
          </span>
          <h1>Leads Management</h1>
          <p>
            Track enquiries, assign follow-ups, and convert
            prospects into clients.
          </p>
        </div>

        <button
          type="button"
          className="leads__button leads__button--primary"
          onClick={openAdd}
        >
          <Plus size={18} />
          Add New Lead
        </button>
      </div>

      {storageError && (
        <div className="leads__error" role="alert">
          {storageError}
        </div>
      )}

      <div className="leads__stats">
        <div className="leads__stat">
          <UsersRound size={21} />
          <span>Total Leads</span>
          <strong>{stats.total}</strong>
        </div>

        <div className="leads__stat">
          <Clock3 size={21} />
          <span>New Leads</span>
          <strong>{stats.new}</strong>
        </div>

        <div className="leads__stat">
          <TrendingUp size={21} />
          <span>Active Opportunities</span>
          <strong>{stats.interested}</strong>
        </div>

        <div className="leads__stat">
          <UserCheck size={21} />
          <span>Won Leads</span>
          <strong>{stats.won}</strong>
        </div>

        <div className="leads__stat">
          <TrendingUp size={21} />
          <span>Open Pipeline Value</span>
          <strong>{currency(stats.pipeline)}</strong>
        </div>
      </div>

      <section className="leads__panel">
        <div className="leads__toolbar">
          <div className="leads__search">
            <Search size={18} />
            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search name, business, phone..."
              aria-label="Search leads"
            />
          </div>

          <div className="leads__filters">
            <Filter size={17} />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              aria-label="Filter by status"
            >
              <option value="All">All Statuses</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(event.target.value)
              }
              aria-label="Filter by priority"
            >
              <option value="All">All Priorities</option>
              {PRIORITY_OPTIONS.map((priority) => (
                <option key={priority}>{priority}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="leads__table-wrap">
          <table className="leads__table">
            <thead>
              <tr>
                <th>Lead / Business</th>
                <th>Contact</th>
                <th>Service</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Assigned To</th>
                <th>Value</th>
                <th>Next Follow-up</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredLeads.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <div className="leads__identity">
                      <span className="leads__avatar">
                        {lead.name?.charAt(0)?.toUpperCase() ||
                          "L"}
                      </span>

                      <div>
                        <strong>{lead.name}</strong>
                        <small>
                          {lead.business || "Individual"}
                        </small>
                      </div>
                    </div>
                  </td>

                  <td>
                    <div className="leads__contact">
                      <a href={`tel:${lead.phone}`}>
                        <Phone size={13} />
                        {lead.phone}
                      </a>

                      {lead.email && (
                        <a href={`mailto:${lead.email}`}>
                          <Mail size={13} />
                          {lead.email}
                        </a>
                      )}
                    </div>
                  </td>

                  <td>{lead.service || "—"}</td>

                  <td>
                    <span
                      className={`leads__badge leads__badge--${lead.status
                        .toLowerCase()
                        .replace(/\s+/g, "-")}`}
                    >
                      {lead.status}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`leads__priority leads__priority--${lead.priority.toLowerCase()}`}
                    >
                      {lead.priority}
                    </span>
                  </td>

                  <td>{lead.assignedTo || "Unassigned"}</td>

                  <td className="leads__amount">
                    {currency(
                      Number(lead.estimatedValue) || 0
                    )}
                  </td>

                  <td>
                    <span className="leads__date">
                      <CalendarDays size={14} />
                      {formatDate(lead.nextFollowUp)}
                    </span>
                  </td>

                  <td>
                    <div className="leads__actions">
                      <button
                        type="button"
                        onClick={() => openEdit(lead)}
                        aria-label={`Edit ${lead.name}`}
                        title="Edit lead"
                      >
                        <Pencil size={16} />
                      </button>

                      <button
                        type="button"
                        className="leads__delete"
                        onClick={() => deleteLead(lead)}
                        aria-label={`Delete ${lead.name}`}
                        title="Delete lead"
                      >
                        <Trash2 size={16} />
                      </button>

                      <a
                        href={`tel:${lead.phone}`}
                        aria-label={`Call ${lead.name}`}
                        title="Call lead"
                      >
                        <ExternalLink size={16} />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredLeads.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <div className="leads__empty">
                      <UsersRound size={35} />
                      <h3>No leads found</h3>
                      <p>
                        {leads.length === 0
                          ? "Add your first lead to get started."
                          : "Try changing your search or filters."}
                      </p>

                      {leads.length === 0 && (
                        <button
                          type="button"
                          className="leads__button leads__button--primary"
                          onClick={openAdd}
                        >
                          <Plus size={16} />
                          Add Lead
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="leads__table-footer">
          Showing {filteredLeads.length} of {leads.length} leads
        </div>
      </section>

      {modalOpen && (
        <LeadModal
          lead={editingLead}
          onClose={closeModal}
          onSave={saveLead}
        />
      )}
    </div>
  );
}
