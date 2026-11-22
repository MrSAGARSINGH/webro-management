
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  UsersRound,
  UserCheck,
  Wallet,
  IndianRupee,
  Pencil,
  Trash2,
  X,
  Phone,
  Mail,
  Building2,
  ExternalLink,
  Filter,
} from "lucide-react";

import "./Clients.scss";

const STORAGE_KEY = "webro-management-clients-v1";

const STATUS_OPTIONS = [
  "Active",
  "On Hold",
  "Completed",
  "Inactive",
];

const SERVICE_OPTIONS = [
  "Website Development",
  "E-commerce Development",
  "Web Application",
  "SEO",
  "Website Maintenance",
  "Branding",
  "Other",
];

const EMPTY_FORM = {
  name: "",
  company: "",
  phone: "",
  email: "",
  service: "Website Development",
  status: "Active",
  projectName: "",
  contractAmount: "",
  receivedAmount: "",
  startDate: "",
  deadline: "",
  assignedTo: "",
  notes: "",
};

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

function readClients() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];

    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function ClientModal({ client, onClose, onSave }) {
  const [form, setForm] = useState(
    client
      ? {
          ...EMPTY_FORM,
          ...client,
          contractAmount: String(
            client.contractAmount ?? ""
          ),
          receivedAmount: String(
            client.receivedAmount ?? ""
          ),
        }
      : EMPTY_FORM
  );

  const [error, setError] = useState("");

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [onClose]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const name = form.name.trim();
    const phone = form.phone.trim();
    const email = form.email.trim();

    if (!name) {
      setError("Client name is required.");
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

    const contractAmount = Number(
      form.contractAmount || 0
    );

    const receivedAmount = Number(
      form.receivedAmount || 0
    );

    if (
      !Number.isFinite(contractAmount) ||
      !Number.isFinite(receivedAmount) ||
      contractAmount < 0 ||
      receivedAmount < 0 ||
      contractAmount > 1000000000 ||
      receivedAmount > 1000000000
    ) {
      setError("Enter valid payment amounts.");
      return;
    }

    if (receivedAmount > contractAmount) {
      setError(
        "Received amount cannot exceed contract amount."
      );
      return;
    }

    if (
      form.startDate &&
      form.deadline &&
      form.deadline < form.startDate
    ) {
      setError(
        "Deadline cannot be earlier than the start date."
      );
      return;
    }

    onSave({
      ...form,
      name,
      company: form.company.trim(),
      phone,
      email,
      projectName: form.projectName.trim(),
      assignedTo: form.assignedTo.trim(),
      notes: form.notes.trim(),
      contractAmount,
      receivedAmount,
    });
  };

  return (
    <div
      className="clients__modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="clients__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-modal-title"
      >
        <div className="clients__modal-header">
          <div>
            <h2 id="client-modal-title">
              {client ? "Edit Client" : "Add New Client"}
            </h2>

            <p>
              Manage client and project information
            </p>
          </div>

          <button
            type="button"
            className="clients__icon-button"
            onClick={onClose}
            aria-label="Close form"
          >
            <X size={20} />
          </button>
        </div>

        <form
          className="clients__form"
          onSubmit={handleSubmit}
        >
          <div className="clients__form-grid">
            <label>
              Client Name *
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Client full name"
                required
                maxLength={100}
              />
            </label>

            <label>
              Company / Business
              <input
                name="company"
                value={form.company}
                onChange={handleChange}
                placeholder="Business name"
                maxLength={120}
              />
            </label>

            <label>
              Phone Number *
              <input
                name="phone"
                type="tel"
                inputMode="numeric"
                value={form.phone}
                onChange={handleChange}
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
                onChange={handleChange}
                placeholder="client@example.com"
                maxLength={254}
              />
            </label>

            <label>
              Service
              <select
                name="service"
                value={form.service}
                onChange={handleChange}
              >
                {SERVICE_OPTIONS.map((service) => (
                  <option key={service}>
                    {service}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Client Status
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Project Name
              <input
                name="projectName"
                value={form.projectName}
                onChange={handleChange}
                placeholder="Restaurant Website"
                maxLength={150}
              />
            </label>

            <label>
              Assigned Employee
              <input
                name="assignedTo"
                value={form.assignedTo}
                onChange={handleChange}
                placeholder="Employee name"
                maxLength={100}
              />
            </label>

            <label>
              Contract Amount (₹)
              <input
                name="contractAmount"
                type="number"
                min="0"
                max="1000000000"
                step="1"
                value={form.contractAmount}
                onChange={handleChange}
                placeholder="30000"
              />
            </label>

            <label>
              Received Amount (₹)
              <input
                name="receivedAmount"
                type="number"
                min="0"
                max="1000000000"
                step="1"
                value={form.receivedAmount}
                onChange={handleChange}
                placeholder="15000"
              />
            </label>

            <label>
              Project Start Date
              <input
                name="startDate"
                type="date"
                value={form.startDate}
                onChange={handleChange}
              />
            </label>

            <label>
              Project Deadline
              <input
                name="deadline"
                type="date"
                value={form.deadline}
                onChange={handleChange}
              />
            </label>

            <label className="clients__form-full">
              Notes
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                placeholder="Client requirements, payment terms..."
                rows={4}
                maxLength={2000}
              />
            </label>
          </div>

          {error && (
            <p
              className="clients__form-error"
              role="alert"
            >
              {error}
            </p>
          )}

          <div className="clients__modal-actions">
            <button
              type="button"
              className="clients__button clients__button--secondary"
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="clients__button clients__button--primary"
            >
              {client ? "Save Changes" : "Create Client"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function Clients() {
  const [clients, setClients] = useState(readClients);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [storageError, setStorageError] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(clients)
      );

      setStorageError("");
    } catch {
      setStorageError(
        "Unable to save client data in browser storage."
      );
    }
  }, [clients]);

  const stats = useMemo(() => {
    const totalContract = clients.reduce(
      (sum, client) =>
        sum + (Number(client.contractAmount) || 0),
      0
    );

    const totalReceived = clients.reduce(
      (sum, client) =>
        sum + (Number(client.receivedAmount) || 0),
      0
    );

    return {
      total: clients.length,
      active: clients.filter(
        (client) => client.status === "Active"
      ).length,
      totalContract,
      totalReceived,
      pending: totalContract - totalReceived,
    };
  }, [clients]);

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();

    return clients.filter((client) => {
      const matchesSearch = [
        client.name,
        client.company,
        client.phone,
        client.email,
        client.projectName,
        client.service,
        client.assignedTo,
      ].some((value) =>
        String(value ?? "").toLowerCase().includes(query)
      );

      return (
        matchesSearch &&
        (statusFilter === "All" ||
          client.status === statusFilter)
      );
    });
  }, [clients, search, statusFilter]);

  const openAdd = () => {
    setEditingClient(null);
    setModalOpen(true);
  };

  const openEdit = (client) => {
    setEditingClient(client);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingClient(null);
  };

  const saveClient = (form) => {
    const timestamp = new Date().toISOString();

    if (editingClient) {
      setClients((previous) =>
        previous.map((client) =>
          client.id === editingClient.id
            ? {
                ...client,
                ...form,
                updatedAt: timestamp,
              }
            : client
        )
      );
    } else {
      setClients((previous) => [
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

  const deleteClient = (client) => {
    const confirmed = window.confirm(
      `Delete client "${client.name}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    setClients((previous) =>
      previous.filter(
        (item) => item.id !== client.id
      )
    );
  };

  return (
    <div className="clients">
      {/* HEADER */}

      <div className="clients__header">
        <div>
          <span className="clients__eyebrow">
            BUSINESS MANAGEMENT
          </span>

          <h1>Clients Management</h1>

          <p>
            Manage client information, projects,
            contracts, and payment balances.
          </p>
        </div>

        <button
          type="button"
          className="clients__button clients__button--primary"
          onClick={openAdd}
        >
          <Plus size={18} />
          Add New Client
        </button>
      </div>

      {storageError && (
        <div className="clients__error" role="alert">
          {storageError}
        </div>
      )}

      {/* STATS */}

      <div className="clients__stats">
        <div className="clients__stat">
          <UsersRound size={21} />
          <span>Total Clients</span>
          <strong>{stats.total}</strong>
        </div>

        <div className="clients__stat">
          <UserCheck size={21} />
          <span>Active Clients</span>
          <strong>{stats.active}</strong>
        </div>

        <div className="clients__stat">
          <IndianRupee size={21} />
          <span>Contract Value</span>
          <strong>
            {formatCurrency(stats.totalContract)}
          </strong>
        </div>

        <div className="clients__stat">
          <Wallet size={21} />
          <span>Payments Received</span>
          <strong>
            {formatCurrency(stats.totalReceived)}
          </strong>
        </div>

        <div className="clients__stat">
          <IndianRupee size={21} />
          <span>Pending Payments</span>
          <strong>
            {formatCurrency(stats.pending)}
          </strong>
        </div>
      </div>

      {/* CLIENTS TABLE */}

      <section className="clients__panel">
        <div className="clients__toolbar">
          <div className="clients__search">
            <Search size={18} />

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search clients, businesses, projects..."
              aria-label="Search clients"
            />
          </div>

          <div className="clients__filters">
            <Filter size={17} />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              aria-label="Filter clients by status"
            >
              <option value="All">All Statuses</option>

              {STATUS_OPTIONS.map((status) => (
                <option key={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="clients__table-wrap">
          <table className="clients__table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Contact</th>
                <th>Project</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>Contract</th>
                <th>Received</th>
                <th>Pending</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredClients.map((client) => {
                const pending = Math.max(
                  0,
                  Number(client.contractAmount || 0) -
                    Number(client.receivedAmount || 0)
                );

                return (
                  <tr key={client.id}>
                    <td>
                      <div className="clients__identity">
                        <span className="clients__avatar">
                          {client.name
                            ?.charAt(0)
                            ?.toUpperCase() || "C"}
                        </span>

                        <div>
                          <strong>{client.name}</strong>

                          <small>
                            <Building2 size={12} />
                            {client.company ||
                              "Individual"}
                          </small>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="clients__contact">
                        <a href={`tel:${client.phone}`}>
                          <Phone size={13} />
                          {client.phone}
                        </a>

                        {client.email && (
                          <a
                            href={`mailto:${client.email}`}
                          >
                            <Mail size={13} />
                            {client.email}
                          </a>
                        )}
                      </div>
                    </td>

                    <td>
                      <div className="clients__project">
                        <strong>
                          {client.projectName ||
                            "Not assigned"}
                        </strong>

                        <small>{client.service}</small>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`clients__badge clients__badge--${client.status
                          .toLowerCase()
                          .replace(/\s+/g, "-")}`}
                      >
                        {client.status}
                      </span>
                    </td>

                    <td>
                      {client.assignedTo ||
                        "Unassigned"}
                    </td>

                    <td className="clients__amount">
                      {formatCurrency(
                        Number(
                          client.contractAmount
                        ) || 0
                      )}
                    </td>

                    <td className="clients__amount clients__amount--received">
                      {formatCurrency(
                        Number(
                          client.receivedAmount
                        ) || 0
                      )}
                    </td>

                    <td className="clients__amount clients__amount--pending">
                      {formatCurrency(pending)}
                    </td>

                    <td>
                      <div className="clients__actions">
                        <button
                          type="button"
                          onClick={() =>
                            openEdit(client)
                          }
                          aria-label={`Edit ${client.name}`}
                          title="Edit client"
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          type="button"
                          className="clients__delete"
                          onClick={() =>
                            deleteClient(client)
                          }
                          aria-label={`Delete ${client.name}`}
                          title="Delete client"
                        >
                          <Trash2 size={16} />
                        </button>

                        <a
                          href={`tel:${client.phone}`}
                          aria-label={`Call ${client.name}`}
                          title="Call client"
                        >
                          <ExternalLink size={16} />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <div className="clients__empty">
                      <UsersRound size={35} />

                      <h3>No clients found</h3>

                      <p>
                        {clients.length === 0
                          ? "Add your first client to get started."
                          : "Try adjusting your search or filters."}
                      </p>

                      {clients.length === 0 && (
                        <button
                          type="button"
                          className="clients__button clients__button--primary"
                          onClick={openAdd}
                        >
                          <Plus size={16} />
                          Add Client
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="clients__table-footer">
          Showing {filteredClients.length} of{" "}
          {clients.length} clients
        </div>
      </section>

      {modalOpen && (
        <ClientModal
          client={editingClient}
          onClose={closeModal}
          onSave={saveClient}
        />
      )}
    </div>
  );
}
