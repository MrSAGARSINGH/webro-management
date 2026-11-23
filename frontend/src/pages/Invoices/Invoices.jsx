
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  FileText,
  FileCheck2,
  IndianRupee,
  Clock3,
  Pencil,
  Printer,
  X,
  Filter,
  Receipt,
  Trash2,
} from "lucide-react";
import "./Invoices.scss";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

const STATUSES = [
  "Draft",
  "Issued",
  "Partially Paid",
  "Paid",
  "Overdue",
  "Cancelled",
];

const COMPANY = {
  name: "WEBRO Studio",
  address: "Jagatpura, Jaipur, Rajasthan, India",
};

const blankItem = () => ({
  description: "",
  quantity: "1",
  rate: "",
  unit: "Service",
  taxRate: "0",
});

const blankForm = () => ({
  client: "",
  project: "",
  issueDate: "",
  dueDate: "",
  items: [blankItem()],
  discountAmount: "0",
  taxRate: "0",
  billingDetails: {
    businessName: "",
    billingAddress: "",
    email: "",
    phone: "",
    gstin: "",
  },
  notes: "",
  termsAndConditions: "",
});

const idOf = (value) =>
  typeof value === "string"
    ? value
    : value?._id || value?.id || "";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const day = (value) => {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const dateText = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const toISO = (value) =>
  value ? new Date(`${value}T12:00:00`).toISOString() : null;

const calculate = (items, discount = 0) => {
  const subtotal = items.reduce((sum, item) => {
    const amount =
      (Number(item.quantity) || 0) *
      (Number(item.rate ?? item.unitPrice) || 0);

    return sum + Math.round(amount * 100) / 100;
  }, 0);

  const tax = items.reduce((sum, item) => {
    const amount =
      (Number(item.quantity) || 0) *
      (Number(item.rate ?? item.unitPrice) || 0);

    return (
      sum +
      Math.round(amount * (Number(item.taxRate) || 0)) / 100
    );
  }, 0);

  return {
    subtotal,
    tax,
    total: Math.max(
      0,
      Math.round(
        (subtotal + tax - (Number(discount) || 0)) * 100
      ) / 100
    ),
  };
};

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || data?.success !== true) {
    const errors = Array.isArray(data?.errors)
      ? data.errors
          .map((error) => error.message)
          .filter(Boolean)
          .join("; ")
      : "";

    throw new Error(
      errors ||
        data?.message ||
        `Request failed (${response.status})`
    );
  }

  return data;
}

async function mutate(path, method, body) {
  const csrf = await request("/auth/csrf");

  if (!csrf.csrfToken) {
    throw new Error("Session expired. Sign in again.");
  }

  return request(path, {
    method,
    headers: {
      "X-CSRF-Token": csrf.csrfToken,
    },
    ...(body !== undefined
      ? { body: JSON.stringify(body) }
      : {}),
  });
}

async function all(path, key) {
  const rows = [];
  let page = 1;
  let pages = 1;

  do {
    const separator = path.includes("?") ? "&" : "?";

    const data = await request(
      `${path}${separator}page=${page}&limit=100`
    );

    if (!Array.isArray(data[key])) {
      throw new Error(`Invalid ${key} API response`);
    }

    rows.push(...data[key]);
    pages = data.pagination?.totalPages ?? 1;
    page++;
  } while (page <= pages);

  return rows;
}

function DocumentModal({
  invoice,
  clients,
  projects,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(() =>
    invoice
      ? {
          ...blankForm(),
          client: idOf(invoice.client),
          project: idOf(invoice.project),
          issueDate: day(invoice.issueDate),
          dueDate: day(invoice.dueDate),
          items: invoice.items?.length
            ? invoice.items.map((item) => ({
                description: item.description,
                quantity: String(item.quantity),
                rate: String(item.unitPrice),
                unit: item.unit || "Service",
                taxRate: String(item.taxRate),
              }))
            : [blankItem()],
          discountAmount: String(
            invoice.discountAmount || 0
          ),
          taxRate: String(
            invoice.items?.[0]?.taxRate ?? 0
          ),
          billingDetails: {
            ...blankForm().billingDetails,
            ...invoice.billingDetails,
          },
          notes: invoice.notes || "",
          termsAndConditions:
            invoice.termsAndConditions || "",
        }
      : {
          ...blankForm(),
          issueDate: day(new Date()),
        }
  );

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const totals = useMemo(
    () =>
      calculate(
        form.items.map((item) => ({
          ...item,
          taxRate: form.taxRate,
        })),
        form.discountAmount
      ),
    [form.items, form.taxRate, form.discountAmount]
  );

  const set = (name, value) => {
    setForm((previous) => ({
      ...previous,
      [name]: value,
      ...(name === "client" ? { project: "" } : {}),
    }));

    setError("");
  };

  const itemSet = (index, name, value) => {
    setForm((previous) => ({
      ...previous,
      items: previous.items.map((item, position) =>
        position === index
          ? { ...item, [name]: value }
          : item
      ),
    }));
  };

  const billingSet = (name, value) => {
    setForm((previous) => ({
      ...previous,
      billingDetails: {
        ...previous.billingDetails,
        [name]: value,
      },
    }));
  };

  const save = async (event) => {
    event.preventDefault();

    if (saving) return;

    if (!form.client) {
      setError("Select a client.");
      return;
    }

    if (
      form.dueDate &&
      form.issueDate &&
      form.dueDate < form.issueDate
    ) {
      setError("Due date must not be before issue date.");
      return;
    }

    const items = form.items.map((item) => ({
      description: item.description.trim(),
      quantity: Number(item.quantity),
      unit: item.unit,
      unitPrice: Number(item.rate),
      taxRate: Number(form.taxRate),
    }));

    if (
      !items.length ||
      items.some(
        (item) =>
          item.description.length < 2 ||
          !Number.isFinite(item.quantity) ||
          item.quantity < 0.001 ||
          item.quantity > 1000000 ||
          !Number.isFinite(item.unitPrice) ||
          item.unitPrice < 0 ||
          Math.abs(
            Math.round(item.unitPrice * 100) -
              item.unitPrice * 100
          ) > 0.000001 ||
          !Number.isFinite(item.taxRate) ||
          item.taxRate < 0 ||
          item.taxRate > 100
      )
    ) {
      setError(
        "Check item descriptions, quantities, rates and tax."
      );
      return;
    }

    const discount = Number(form.discountAmount);

    if (
      !Number.isFinite(discount) ||
      discount < 0 ||
      Math.abs(
        Math.round(discount * 100) - discount * 100
      ) > 0.000001
    ) {
      setError("Invalid discount amount.");
      return;
    }

    const payload = {
      client: form.client,
      project: form.project || null,
      issueDate: toISO(form.issueDate),
      dueDate: toISO(form.dueDate),
      items,
      discountAmount: discount,
      billingDetails: {
        ...form.billingDetails,
        gstin: form.billingDetails.gstin
          .trim()
          .toUpperCase(),
      },
      notes: form.notes.trim(),
      termsAndConditions:
        form.termsAndConditions.trim(),
    };

    if (!invoice) {
      payload.currency = "INR";
    }

    try {
      setSaving(true);
      setError("");
      await onSave(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const availableProjects = projects.filter(
    (project) => idOf(project.client) === form.client
  );

  return (
    <div
      className="invoices__modal-backdrop"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !saving
        ) {
          onClose();
        }
      }}
    >
      <section
        className="invoices__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invoice-modal-title"
      >
        <div className="invoices__modal-header">
          <div>
            <h2 id="invoice-modal-title">
              {invoice ? "Edit Document" : "New Document"}
            </h2>
            <p>Configure billing and line items.</p>
          </div>

          <button
            type="button"
            className="invoices__icon-button"
            disabled={saving}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form className="invoices__form" onSubmit={save}>
          <div className="invoices__form-grid">
            <label>
              Document Type
              <select value="Invoice" disabled>
                <option>Invoice</option>
              </select>
            </label>

            <label>
              Status
              <select
                value={invoice?.status || "Draft"}
                disabled
              >
                <option>
                  {invoice?.status || "Draft"}
                </option>
              </select>
            </label>

            <label>
              Client Name *
              <select
                value={form.client}
                onChange={(event) =>
                  set("client", event.target.value)
                }
                required
              >
                <option value="">Select client</option>

                {clients.map((client) => (
                  <option
                    key={idOf(client)}
                    value={idOf(client)}
                  >
                    {client.name}
                    {client.company
                      ? ` — ${client.company}`
                      : ""}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Project Name
              <select
                value={form.project}
                onChange={(event) =>
                  set("project", event.target.value)
                }
              >
                <option value="">No project</option>

                {availableProjects.map((project) => (
                  <option
                    key={idOf(project)}
                    value={idOf(project)}
                  >
                    {project.name || project.title}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Business Name
              <input
                value={form.billingDetails.businessName}
                onChange={(event) =>
                  billingSet(
                    "businessName",
                    event.target.value
                  )
                }
                maxLength={200}
              />
            </label>

            <label>
              Client Email
              <input
                type="email"
                value={form.billingDetails.email}
                onChange={(event) =>
                  billingSet("email", event.target.value)
                }
              />
            </label>

            <label>
              Client Phone
              <input
                value={form.billingDetails.phone}
                onChange={(event) =>
                  billingSet("phone", event.target.value)
                }
                maxLength={30}
              />
            </label>

            <label>
              Client GSTIN
              <input
                value={form.billingDetails.gstin}
                onChange={(event) =>
                  billingSet("gstin", event.target.value)
                }
                maxLength={15}
              />
            </label>

            <label className="invoices__form-full">
              Billing Address
              <textarea
                rows={2}
                value={
                  form.billingDetails.billingAddress
                }
                onChange={(event) =>
                  billingSet(
                    "billingAddress",
                    event.target.value
                  )
                }
                maxLength={1000}
              />
            </label>

            <label>
              Issue Date
              <input
                type="date"
                value={form.issueDate}
                onChange={(event) =>
                  set("issueDate", event.target.value)
                }
              />
            </label>

            <label>
              Due Date
              <input
                type="date"
                value={form.dueDate}
                onChange={(event) =>
                  set("dueDate", event.target.value)
                }
              />
            </label>
          </div>

          <div className="invoices__items-header">
            <h3>Line Items</h3>

            <button
              type="button"
              className="invoices__button invoices__button--secondary"
              disabled={form.items.length >= 100}
              onClick={() =>
                setForm((previous) => ({
                  ...previous,
                  items: [
                    ...previous.items,
                    blankItem(),
                  ],
                }))
              }
            >
              <Plus size={15} />
              Add Item
            </button>
          </div>

          <div className="invoices__items">
            {form.items.map((item, index) => (
              <div
                className="invoices__item"
                key={index}
              >
                <label className="invoices__item-description">
                  Description
                  <input
                    value={item.description}
                    maxLength={500}
                    required
                    onChange={(event) =>
                      itemSet(
                        index,
                        "description",
                        event.target.value
                      )
                    }
                    placeholder="Website development"
                  />
                </label>

                <label>
                  Qty
                  <input
                    type="number"
                    min="0.001"
                    max="1000000"
                    step="any"
                    value={item.quantity}
                    onChange={(event) =>
                      itemSet(
                        index,
                        "quantity",
                        event.target.value
                      )
                    }
                    required
                  />
                </label>

                <label>
                  Rate (₹)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.rate}
                    onChange={(event) =>
                      itemSet(
                        index,
                        "rate",
                        event.target.value
                      )
                    }
                    required
                  />
                </label>

                <button
                  type="button"
                  className="invoices__icon-button invoices__item-delete"
                  disabled={form.items.length === 1}
                  onClick={() =>
                    setForm((previous) => ({
                      ...previous,
                      items: previous.items.filter(
                        (_, position) =>
                          position !== index
                      ),
                    }))
                  }
                  aria-label={`Remove item ${index + 1}`}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
          </div>

          <div className="invoices__form-grid">
            <label>
              GST Rate (%)
              <select
                value={form.taxRate}
                onChange={(event) =>
                  set("taxRate", event.target.value)
                }
              >
                {[0, 5, 12, 18, 28].map((rate) => (
                  <option
                    key={rate}
                    value={String(rate)}
                  >
                    {rate}%
                  </option>
                ))}
              </select>
            </label>

            <label>
              Discount (₹)
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.discountAmount}
                onChange={(event) =>
                  set(
                    "discountAmount",
                    event.target.value
                  )
                }
              />
            </label>

            <label className="invoices__form-full">
              Notes / Payment Terms
              <textarea
                value={form.notes}
                onChange={(event) =>
                  set("notes", event.target.value)
                }
                rows={3}
              />
            </label>

            <label className="invoices__form-full">
              Terms & Conditions
              <textarea
                value={form.termsAndConditions}
                onChange={(event) =>
                  set(
                    "termsAndConditions",
                    event.target.value
                  )
                }
                rows={3}
              />
            </label>
          </div>

          <div className="invoices__totals">
            <div>
              <span>Subtotal</span>
              <strong>
                {money(totals.subtotal)}
              </strong>
            </div>

            <div>
              <span>GST ({form.taxRate}%)</span>
              <strong>{money(totals.tax)}</strong>
            </div>

            <div>
              <span>Discount</span>
              <strong>
                {money(form.discountAmount)}
              </strong>
            </div>

            <div className="invoices__totals-final">
              <span>Total</span>
              <strong>{money(totals.total)}</strong>
            </div>
          </div>

          {error && (
            <p
              className="invoices__form-error"
              role="alert"
            >
              {error}
            </p>
          )}

          <div className="invoices__modal-actions">
            <button
              type="button"
              className="invoices__button invoices__button--secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="invoices__button invoices__button--primary"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : invoice
                  ? "Save Changes"
                  : "Create Document"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function PrintableDocument({ invoice, onClose }) {
  const items = invoice.items || [];

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [onClose]);

  return (
    <div className="invoices__preview-backdrop">
      <div className="invoices__preview-shell">
        <div className="invoices__preview-actions">
          <strong>{invoice.invoiceNumber}</strong>

          <div>
            <button
              type="button"
              className="invoices__button invoices__button--primary"
              onClick={() => window.print()}
            >
              <Printer size={16} />
              Print / Save PDF
            </button>

            <button
              type="button"
              className="invoices__icon-button"
              onClick={onClose}
              aria-label="Close preview"
            >
              <X size={19} />
            </button>
          </div>
        </div>

        <article className="invoices__paper">
          <header className="invoices__paper-header">
            <div>
              <h1>{COMPANY.name}</h1>
              <p>{COMPANY.address}</p>
            </div>

            <div className="invoices__paper-title">
              <h2>INVOICE</h2>
              <strong>
                {invoice.invoiceNumber}
              </strong>
            </div>
          </header>

          <div className="invoices__paper-meta">
            <div>
              <span>BILL TO</span>

              <strong>
                {invoice.billingDetails?.businessName ||
                  invoice.client?.company ||
                  invoice.client?.name ||
                  "Client"}
              </strong>

              {invoice.client?.name && (
                <p>{invoice.client.name}</p>
              )}

              {invoice.billingDetails?.billingAddress && (
                <p>
                  {
                    invoice.billingDetails
                      .billingAddress
                  }
                </p>
              )}

              {invoice.billingDetails?.email && (
                <p>
                  {invoice.billingDetails.email}
                </p>
              )}

              {invoice.billingDetails?.phone && (
                <p>
                  {invoice.billingDetails.phone}
                </p>
              )}

              {invoice.billingDetails?.gstin && (
                <p>
                  GSTIN:{" "}
                  {invoice.billingDetails.gstin}
                </p>
              )}
            </div>

            <div>
              <p>
                <span>Issue Date:</span>{" "}
                {dateText(invoice.issueDate)}
              </p>

              <p>
                <span>Due Date:</span>{" "}
                {dateText(invoice.dueDate)}
              </p>

              {invoice.project?.name && (
                <p>
                  <span>Project:</span>{" "}
                  {invoice.project.name}
                </p>
              )}
            </div>
          </div>

          <table className="invoices__paper-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Amount</th>
              </tr>
            </thead>

            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td>{item.description}</td>
                  <td>
                    {item.quantity} {item.unit}
                  </td>
                  <td>
                    {money(item.unitPrice)}
                  </td>
                  <td>
                    {money(
                      Number(item.quantity) *
                        Number(item.unitPrice)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="invoices__paper-totals">
            <div>
              <span>Subtotal</span>
              <strong>
                {money(invoice.subtotal)}
              </strong>
            </div>

            <div>
              <span>Tax</span>
              <strong>
                {money(invoice.taxAmount)}
              </strong>
            </div>

            <div>
              <span>Discount</span>
              <strong>
                {money(invoice.discountAmount)}
              </strong>
            </div>

            <div className="invoices__paper-total">
              <span>Total Amount</span>
              <strong>
                {money(invoice.grandTotal)}
              </strong>
            </div>

            <div>
              <span>Received</span>
              <strong>
                {money(invoice.paidAmount)}
              </strong>
            </div>

            <div>
              <span>Balance Due</span>
              <strong>
                {money(
                  invoice.balanceDue ??
                    Math.max(
                      0,
                      Number(invoice.grandTotal) -
                        Number(invoice.paidAmount)
                    )
                )}
              </strong>
            </div>
          </div>

          {invoice.notes && (
            <div className="invoices__paper-notes">
              <strong>Notes / Terms</strong>
              <p>{invoice.notes}</p>
            </div>
          )}

          {invoice.termsAndConditions && (
            <div className="invoices__paper-notes">
              <strong>Terms & Conditions</strong>
              <p>
                {invoice.termsAndConditions}
              </p>
            </div>
          )}

          <footer className="invoices__paper-footer">
            <p>Thank you for your business.</p>
            <strong>{COMPANY.name}</strong>
          </footer>
        </article>
      </div>
    </div>
  );
}

export default function Invoices() {
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState({});

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] =
    useState("All");
  const [statusFilter, setStatusFilter] =
    useState("All");

  const [editingDocument, setEditingDocument] =
    useState(null);
  const [modalOpen, setModalOpen] =
    useState(false);
  const [preview, setPreview] = useState(null);

  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);

      try {
        const [records, summary] =
          await Promise.all([
            all("/invoices", "invoices"),
            request("/invoices/stats"),
          ]);

        if (!active) return;

        setDocuments(records);
        setStats(summary.stats || {});
        setError("");
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [revision]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return documents.filter((invoice) => {
      const matchesStatus =
        statusFilter === "All" ||
        invoice.status === statusFilter;

      const matchesSearch = [
        invoice.invoiceNumber,
        invoice.client?.name,
        invoice.client?.company,
        invoice.project?.name,
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query)
      );

      return matchesStatus && matchesSearch;
    });
  }, [documents, search, statusFilter]);

  const openForm = async (invoice = null) => {
    if (busy) return;

    try {
      setBusy(true);
      setError("");

      const [clientList, projectList] =
        await Promise.all([
          all("/clients", "clients"),
          all("/projects", "projects"),
        ]);

      if (
        invoice?.client &&
        typeof invoice.client === "object" &&
        !clientList.some(
          (client) =>
            idOf(client) === idOf(invoice.client)
        )
      ) {
        clientList.unshift(invoice.client);
      }

      setClients(clientList);
      setProjects(projectList);
      setEditingDocument(invoice);
      setModalOpen(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const save = async (payload) => {
    const path = editingDocument
      ? `/invoices/${idOf(editingDocument)}`
      : "/invoices";

    const method = editingDocument
      ? "PATCH"
      : "POST";

    await mutate(path, method, payload);

    setModalOpen(false);
    setEditingDocument(null);
    refresh();
  };

  const issue = async (invoice) => {
    if (!invoice.issueDate || !invoice.dueDate) {
      setError(
        "Edit draft and set issue date and due date before issuing."
      );
      return;
    }

    if (
      !window.confirm(
        `Issue invoice ${invoice.invoiceNumber}?`
      )
    ) {
      return;
    }

    try {
      setBusy(true);
      setError("");

      await mutate(
        `/invoices/${idOf(invoice)}/issue`,
        "PATCH",
        {
          issueDate: new Date(
            invoice.issueDate
          ).toISOString(),
          dueDate: new Date(
            invoice.dueDate
          ).toISOString(),
        }
      );

      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (invoice) => {
    const reason = window.prompt(
      `Reason for cancelling ${invoice.invoiceNumber} (minimum 3 characters):`
    );

    if (reason === null) return;

    if (reason.trim().length < 3) {
      setError(
        "Cancellation reason must contain at least 3 characters."
      );
      return;
    }

    try {
      setBusy(true);
      setError("");

      await mutate(
        `/invoices/${idOf(invoice)}/cancel`,
        "PATCH",
        {
          reason: reason.trim(),
        }
      );

      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const cards = [
    {
      label: "Total Invoices",
      value: stats.total ?? documents.length,
      icon: FileText,
    },
    {
      label: "Draft",
      value: stats.draft ?? 0,
      icon: FileCheck2,
    },
    {
      label: "Total Billed",
      value: money(stats.totalInvoiced),
      icon: IndianRupee,
    },
    {
      label: "Amount Received",
      value: money(stats.totalReceived),
      icon: Receipt,
    },
    {
      label: "Outstanding",
      value: money(stats.totalOutstanding),
      icon: Clock3,
    },
  ];

  return (
    <div className="invoices">
      <div className="invoices__header">
        <div>
          <span className="invoices__eyebrow">
            BILLING MANAGEMENT
          </span>

          <h1>Invoices &amp; Quotations</h1>

          <p>
            Create, manage and print professional
            billing documents.
          </p>
        </div>

        <button
          type="button"
          className="invoices__button invoices__button--primary"
          onClick={() => void openForm()}
          disabled={busy}
        >
          <Plus size={18} />
          New Document
        </button>
      </div>

      {error && (
        <div
          className="invoices__error"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="invoices__stats">
        {cards.map(
          ({ label, value, icon: Icon }) => (
            <div
              className="invoices__stat"
              key={label}
            >
              <Icon size={21} />
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          )
        )}
      </div>

      <section className="invoices__panel">
        <div className="invoices__panel-heading">
          <h2>All Documents</h2>
          <p>
            Invoices and billing records.
            Quotations require a separate backend API.
          </p>
        </div>

        <div className="invoices__toolbar">
          <div className="invoices__search">
            <Search size={18} />

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search number, client, project..."
              aria-label="Search documents"
            />
          </div>

          <div className="invoices__filters">
            <Filter size={17} />

            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(event.target.value)
              }
              aria-label="Filter document type"
            >
              <option value="All">All Types</option>
              <option value="Invoice">
                Invoices
              </option>
              <option
                value="Quotation"
                disabled
              >
                Quotations (not connected)
              </option>
            </select>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              aria-label="Filter document status"
            >
              <option value="All">
                All Statuses
              </option>

              {STATUSES.map((status) => (
                <option key={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="invoices__table-wrap">
          <table className="invoices__table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Client / Project</th>
                <th>Issue Date</th>
                <th>Due Date</th>
                <th>Total</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((invoice) => (
                <tr key={idOf(invoice)}>
                  <td>
                    <div className="invoices__identity">
                      <span className="invoices__avatar">
                        <FileText size={18} />
                      </span>

                      <div>
                        <strong>
                          {invoice.invoiceNumber}
                        </strong>
                        <small>Invoice</small>
                      </div>
                    </div>
                  </td>

                  <td>
                    <div className="invoices__client">
                      <strong>
                        {invoice.client?.company ||
                          invoice.client?.name ||
                          "Unknown client"}
                      </strong>

                      <small>
                        {invoice.project?.name || "—"}
                      </small>
                    </div>
                  </td>

                  <td>
                    {dateText(invoice.issueDate)}
                  </td>

                  <td>
                    {dateText(invoice.dueDate)}
                  </td>

                  <td className="invoices__amount">
                    {money(invoice.grandTotal)}
                  </td>

                  <td className="invoices__amount invoices__amount--pending">
                    {money(
                      invoice.balanceDue ??
                        Math.max(
                          0,
                          Number(invoice.grandTotal) -
                            Number(invoice.paidAmount)
                        )
                    )}
                  </td>

                  <td>
                    <span
                      className={`invoices__badge invoices__badge--${invoice.status
                        .toLowerCase()
                        .replace(/\s+/g, "-")}`}
                    >
                      {invoice.status}
                    </span>
                  </td>

                  <td>
                    <div className="invoices__actions">
                      <button
                        type="button"
                        onClick={() =>
                          setPreview(invoice)
                        }
                        title="Preview / Print"
                        aria-label={`Preview ${invoice.invoiceNumber}`}
                      >
                        <Printer size={16} />
                      </button>

                      {invoice.status === "Draft" && (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void openForm(invoice)
                            }
                            title="Edit"
                            aria-label={`Edit ${invoice.invoiceNumber}`}
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void issue(invoice)
                            }
                            title="Issue invoice"
                          >
                            <FileCheck2 size={16} />
                          </button>
                        </>
                      )}

                      {[
                        "Draft",
                        "Issued",
                        "Overdue",
                      ].includes(invoice.status) && (
                        <button
                          type="button"
                          disabled={busy}
                          className="invoices__delete"
                          onClick={() =>
                            void cancel(invoice)
                          }
                          title="Cancel invoice"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="invoices__empty">
                      <FileText size={36} />

                      <h3>
                        {loading
                          ? "Loading documents..."
                          : "No documents found"}
                      </h3>

                      <p>
                        {loading
                          ? "Fetching invoices from backend."
                          : "Create an invoice to get started."}
                      </p>

                      {!loading &&
                        documents.length === 0 && (
                          <button
                            type="button"
                            className="invoices__button invoices__button--primary"
                            onClick={() =>
                              void openForm()
                            }
                          >
                            <Plus size={16} />
                            Create Document
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="invoices__table-footer">
          Showing {filtered.length} of{" "}
          {documents.length} documents
        </div>
      </section>

      {modalOpen && (
        <DocumentModal
          invoice={editingDocument}
          clients={clients}
          projects={projects}
          onClose={() => {
            setModalOpen(false);
            setEditingDocument(null);
          }}
          onSave={save}
        />
      )}

      {preview && (
        <PrintableDocument
          invoice={preview}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
