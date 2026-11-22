
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  FileText,
  FileCheck2,
  IndianRupee,
  Clock3,
  Pencil,
  Trash2,
  Printer,
  X,
  Filter,
  Download,
  Receipt,
  ArrowRightLeft,
} from "lucide-react";
import "./Invoices.scss";

const STORAGE_KEY = "webro-management-invoices-v1";

const COMPANY = {
  name: "WEBRO Studio",
  address: "Jagatpura, Jaipur, Rajasthan, India",
  email: "",
  phone: "",
  gstin: "",
};

const STATUSES = [
  "Draft",
  "Sent",
  "Partially Paid",
  "Paid",
  "Cancelled",
];

const EMPTY_ITEM = {
  description: "",
  quantity: "1",
  rate: "",
};

const EMPTY_FORM = {
  type: "Invoice",
  clientName: "",
  business: "",
  clientEmail: "",
  clientPhone: "",
  billingAddress: "",
  clientGstin: "",
  projectName: "",
  issueDate: "",
  dueDate: "",
  status: "Draft",
  taxRate: "0",
  amountPaid: "0",
  notes: "",
  items: [{ ...EMPTY_ITEM }],
};

const formatMoney = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value || 0);

const pad = (value) => String(value).padStart(2, "0");

const todayKey = () => {
  const date = new Date();
  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}`;
};

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(`${value}T12:00:00`);

  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
};

const toPaise = (value) =>
  Math.round((Number(value) || 0) * 100);

const calculateTotals = (document) => {
  const subtotalPaise = document.items.reduce(
    (sum, item) =>
      sum +
      Math.round(
        toPaise(item.rate) * Number(item.quantity)
      ),
    0
  );

  const taxPaise = Math.round(
    (subtotalPaise * Number(document.taxRate || 0)) / 100
  );

  const totalPaise = subtotalPaise + taxPaise;
  const paidPaise = toPaise(document.amountPaid);

  return {
    subtotal: subtotalPaise / 100,
    tax: taxPaise / 100,
    total: totalPaise / 100,
    paid: paidPaise / 100,
    balance: Math.max(0, totalPaise - paidPaise) / 100,
  };
};

const getStatus = (document, today) => {
  if (
    document.status === "Draft" ||
    document.status === "Cancelled"
  ) {
    return document.status;
  }

  if (document.type === "Quotation") {
    return document.status === "Paid"
      ? "Accepted"
      : "Sent";
  }

  const totals = calculateTotals(document);

  if (totals.balance === 0) return "Paid";

  if (document.dueDate && document.dueDate < today) {
    return "Overdue";
  }

  if (totals.paid > 0) return "Partially Paid";

  return "Sent";
};

const readDocuments = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed)
      ? parsed.filter(
          (item) =>
            item &&
            typeof item.id === "string" &&
            Array.isArray(item.items)
        )
      : [];
  } catch {
    return [];
  }
};

const getNextNumber = (documents, type) => {
  const prefix = type === "Invoice" ? "INV" : "QUO";
  const year = new Date().getFullYear();
  const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`);

  const max = documents.reduce((highest, document) => {
    const match = String(document.number).match(pattern);
    return match
      ? Math.max(highest, Number(match[1]))
      : highest;
  }, 0);

  return `${prefix}-${year}-${String(max + 1).padStart(
    4,
    "0"
  )}`;
};

function DocumentModal({ document, onClose, onSave }) {
  const [form, setForm] = useState(() =>
    document
      ? {
          ...EMPTY_FORM,
          ...document,
          items: document.items.map((item) => ({
            ...item,
            quantity: String(item.quantity),
            rate: String(item.rate),
          })),
          taxRate: String(document.taxRate),
          amountPaid: String(document.amountPaid),
        }
      : {
          ...EMPTY_FORM,
          issueDate: todayKey(),
        }
  );

  const [error, setError] = useState("");

  useEffect(() => {
    const onEscape = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onEscape);
    return () =>
      document.removeEventListener("keydown", onEscape);
  }, [onClose]);

  const changeField = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
      ...(name === "type" && value === "Quotation"
        ? { amountPaid: "0", status: "Draft" }
        : {}),
    }));

    setError("");
  };

  const changeItem = (index, field, value) => {
    setForm((previous) => ({
      ...previous,
      items: previous.items.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, [field]: value }
          : item
      ),
    }));

    setError("");
  };

  const addItem = () => {
    setForm((previous) => ({
      ...previous,
      items: [...previous.items, { ...EMPTY_ITEM }],
    }));
  };

  const removeItem = (index) => {
    setForm((previous) => ({
      ...previous,
      items:
        previous.items.length === 1
          ? previous.items
          : previous.items.filter(
              (_, itemIndex) => itemIndex !== index
            ),
    }));
  };

  const totals = calculateTotals(form);

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!form.clientName.trim()) {
      setError("Client name is required.");
      return;
    }

    if (
      !form.issueDate ||
      (form.dueDate && form.dueDate < form.issueDate)
    ) {
      setError("Enter valid issue and due dates.");
      return;
    }

    if (
      form.items.some(
        (item) =>
          !item.description.trim() ||
          !Number.isInteger(Number(item.quantity)) ||
          Number(item.quantity) <= 0 ||
          item.rate === "" ||
          !Number.isFinite(Number(item.rate)) ||
          Number(item.rate) < 0 ||
          !Number.isInteger(Number(item.rate) * 100)
      )
    ) {
      setError(
        "Every item needs a description, positive integer quantity and valid rate."
      );
      return;
    }

    const taxRate = Number(form.taxRate);
    const amountPaid = Number(form.amountPaid);

    if (
      !Number.isFinite(taxRate) ||
      taxRate < 0 ||
      taxRate > 100
    ) {
      setError("GST rate must be between 0 and 100.");
      return;
    }

    if (
      !Number.isFinite(amountPaid) ||
      amountPaid < 0 ||
      !Number.isInteger(amountPaid * 100) ||
      amountPaid > totals.total
    ) {
      setError(
        "Amount paid cannot exceed the invoice total."
      );
      return;
    }

    if (
      form.type === "Quotation" &&
      amountPaid !== 0
    ) {
      setError("Quotations cannot record payments.");
      return;
    }

    if (
      form.status === "Paid" &&
      amountPaid !== totals.total &&
      form.type === "Invoice"
    ) {
      setError(
        "A paid invoice must have its full amount received."
      );
      return;
    }

    onSave({
      ...form,
      clientName: form.clientName.trim(),
      business: form.business.trim(),
      clientEmail: form.clientEmail.trim(),
      clientPhone: form.clientPhone.trim(),
      billingAddress: form.billingAddress.trim(),
      clientGstin: form.clientGstin.trim().toUpperCase(),
      projectName: form.projectName.trim(),
      notes: form.notes.trim(),
      taxRate,
      amountPaid,
      items: form.items.map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity),
        rate: Number(item.rate),
      })),
    });
  };

  return (
    <div
      className="invoices__modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
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
              {document ? "Edit Document" : "New Document"}
            </h2>
            <p>Configure billing and line items.</p>
          </div>

          <button
            type="button"
            className="invoices__icon-button"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form
          className="invoices__form"
          onSubmit={handleSubmit}
        >
          <div className="invoices__form-grid">
            <label>
              Document Type
              <select
                name="type"
                value={form.type}
                onChange={changeField}
                disabled={Boolean(document)}
              >
                <option>Invoice</option>
                <option>Quotation</option>
              </select>
            </label>

            <label>
              Status
              <select
                name="status"
                value={form.status}
                onChange={changeField}
              >
                {(form.type === "Quotation"
                  ? ["Draft", "Sent", "Cancelled"]
                  : STATUSES
                ).map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>

            <label>
              Client Name *
              <input
                name="clientName"
                value={form.clientName}
                onChange={changeField}
                required
                maxLength={100}
              />
            </label>

            <label>
              Business Name
              <input
                name="business"
                value={form.business}
                onChange={changeField}
                maxLength={120}
              />
            </label>

            <label>
              Client Email
              <input
                type="email"
                name="clientEmail"
                value={form.clientEmail}
                onChange={changeField}
              />
            </label>

            <label>
              Client Phone
              <input
                name="clientPhone"
                value={form.clientPhone}
                onChange={changeField}
                maxLength={20}
              />
            </label>

            <label className="invoices__form-full">
              Billing Address
              <textarea
                name="billingAddress"
                value={form.billingAddress}
                onChange={changeField}
                rows={2}
              />
            </label>

            <label>
              Client GSTIN
              <input
                name="clientGstin"
                value={form.clientGstin}
                onChange={changeField}
                maxLength={15}
                placeholder="Optional"
              />
            </label>

            <label>
              Project Name
              <input
                name="projectName"
                value={form.projectName}
                onChange={changeField}
              />
            </label>

            <label>
              Issue Date *
              <input
                type="date"
                name="issueDate"
                value={form.issueDate}
                onChange={changeField}
                required
              />
            </label>

            <label>
              Due / Valid Until
              <input
                type="date"
                name="dueDate"
                value={form.dueDate}
                onChange={changeField}
              />
            </label>
          </div>

          <div className="invoices__items-header">
            <h3>Line Items</h3>
            <button
              type="button"
              className="invoices__button invoices__button--secondary"
              onClick={addItem}
            >
              <Plus size={15} />
              Add Item
            </button>
          </div>

          <div className="invoices__items">
            {form.items.map((item, index) => (
              <div className="invoices__item" key={index}>
                <label className="invoices__item-description">
                  Description
                  <input
                    value={item.description}
                    onChange={(event) =>
                      changeItem(
                        index,
                        "description",
                        event.target.value
                      )
                    }
                    placeholder="Website development"
                    required
                  />
                </label>

                <label>
                  Qty
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={item.quantity}
                    onChange={(event) =>
                      changeItem(
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
                      changeItem(
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
                  onClick={() => removeItem(index)}
                  disabled={form.items.length === 1}
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
                name="taxRate"
                value={form.taxRate}
                onChange={changeField}
              >
                <option value="0">0%</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
                <option value="28">28%</option>
              </select>
            </label>

            {form.type === "Invoice" && (
              <label>
                Amount Received (₹)
                <input
                  type="number"
                  name="amountPaid"
                  min="0"
                  step="0.01"
                  value={form.amountPaid}
                  onChange={changeField}
                />
              </label>
            )}

            <label className="invoices__form-full">
              Notes / Payment Terms
              <textarea
                name="notes"
                value={form.notes}
                onChange={changeField}
                rows={3}
              />
            </label>
          </div>

          <div className="invoices__totals">
            <div>
              <span>Subtotal</span>
              <strong>{formatMoney(totals.subtotal)}</strong>
            </div>
            <div>
              <span>GST ({form.taxRate}%)</span>
              <strong>{formatMoney(totals.tax)}</strong>
            </div>
            <div className="invoices__totals-final">
              <span>Total</span>
              <strong>{formatMoney(totals.total)}</strong>
            </div>
            {form.type === "Invoice" && (
              <div>
                <span>Balance Due</span>
                <strong>{formatMoney(totals.balance)}</strong>
              </div>
            )}
          </div>

          {error && (
            <p className="invoices__form-error" role="alert">
              {error}
            </p>
          )}

          <div className="invoices__modal-actions">
            <button
              type="button"
              className="invoices__button invoices__button--secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="invoices__button invoices__button--primary"
            >
              {document ? "Save Changes" : "Create Document"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function PrintableDocument({ document, onClose }) {
  const totals = calculateTotals(document);

  useEffect(() => {
    const onEscape = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onEscape);
    return () =>
      document.removeEventListener("keydown", onEscape);
  }, [onClose]);

  return (
    <div className="invoices__preview-backdrop">
      <div className="invoices__preview-shell">
        <div className="invoices__preview-actions">
          <strong>{document.number}</strong>
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
              {COMPANY.email && <p>{COMPANY.email}</p>}
              {COMPANY.phone && <p>{COMPANY.phone}</p>}
              {COMPANY.gstin && (
                <p>GSTIN: {COMPANY.gstin}</p>
              )}
            </div>
            <div className="invoices__paper-title">
              <h2>{document.type.toUpperCase()}</h2>
              <strong>{document.number}</strong>
            </div>
          </header>

          <div className="invoices__paper-meta">
            <div>
              <span>BILL TO</span>
              <strong>
                {document.business || document.clientName}
              </strong>
              {document.business && (
                <p>{document.clientName}</p>
              )}
              {document.billingAddress && (
                <p>{document.billingAddress}</p>
              )}
              {document.clientEmail && (
                <p>{document.clientEmail}</p>
              )}
              {document.clientPhone && (
                <p>{document.clientPhone}</p>
              )}
              {document.clientGstin && (
                <p>GSTIN: {document.clientGstin}</p>
              )}
            </div>

            <div>
              <p>
                <span>Issue Date:</span>{" "}
                {formatDate(document.issueDate)}
              </p>
              <p>
                <span>
                  {document.type === "Quotation"
                    ? "Valid Until:"
                    : "Due Date:"}
                </span>{" "}
                {formatDate(document.dueDate)}
              </p>
              {document.projectName && (
                <p>
                  <span>Project:</span>{" "}
                  {document.projectName}
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
              {document.items.map((item, index) => (
                <tr key={index}>
                  <td>{item.description}</td>
                  <td>{item.quantity}</td>
                  <td>{formatMoney(item.rate)}</td>
                  <td>
                    {formatMoney(
                      item.quantity * item.rate
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="invoices__paper-totals">
            <div>
              <span>Subtotal</span>
              <strong>{formatMoney(totals.subtotal)}</strong>
            </div>
            <div>
              <span>GST ({document.taxRate}%)</span>
              <strong>{formatMoney(totals.tax)}</strong>
            </div>
            <div className="invoices__paper-total">
              <span>Total Amount</span>
              <strong>{formatMoney(totals.total)}</strong>
            </div>
            {document.type === "Invoice" && (
              <>
                <div>
                  <span>Received</span>
                  <strong>{formatMoney(totals.paid)}</strong>
                </div>
                <div>
                  <span>Balance Due</span>
                  <strong>
                    {formatMoney(totals.balance)}
                  </strong>
                </div>
              </>
            )}
          </div>

          {document.notes && (
            <div className="invoices__paper-notes">
              <strong>Notes / Terms</strong>
              <p>{document.notes}</p>
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
  const [documents, setDocuments] =
    useState(readDocuments);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] =
    useState("All");
  const [editingDocument, setEditingDocument] =
    useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [storageError, setStorageError] =
    useState("");
  const [today, setToday] = useState(todayKey);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(documents)
      );
      setStorageError("");
    } catch {
      setStorageError(
        "Unable to save documents in browser storage."
      );
    }
  }, [documents]);

  useEffect(() => {
    const refresh = () => setToday(todayKey());
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const stats = useMemo(() => {
    const invoices = documents.filter(
      (document) =>
        document.type === "Invoice" &&
        document.status !== "Cancelled"
    );

    const quotations = documents.filter(
      (document) =>
        document.type === "Quotation" &&
        document.status !== "Cancelled"
    );

    return {
      invoices: invoices.length,
      quotations: quotations.length,
      billed: invoices.reduce(
        (sum, document) =>
          sum + calculateTotals(document).total,
        0
      ),
      received: invoices.reduce(
        (sum, document) =>
          sum + calculateTotals(document).paid,
        0
      ),
      outstanding: invoices.reduce(
        (sum, document) =>
          sum + calculateTotals(document).balance,
        0
      ),
    };
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return documents
      .filter((document) => {
        const matchesSearch = [
          document.number,
          document.clientName,
          document.business,
          document.projectName,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(query)
        );

        return (
          matchesSearch &&
          (typeFilter === "All" ||
            document.type === typeFilter) &&
          (statusFilter === "All" ||
            getStatus(document, today) ===
              statusFilter)
        );
      })
      .sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      );
  }, [documents, search, typeFilter, statusFilter, today]);

  const openCreate = () => {
    setEditingDocument(null);
    setModalOpen(true);
  };

  const openEdit = (document) => {
    setEditingDocument(document);
    setModalOpen(true);
  };

  const saveDocument = (form) => {
    const timestamp = new Date().toISOString();

    if (editingDocument) {
      setDocuments((previous) =>
        previous.map((document) =>
          document.id === editingDocument.id
            ? {
                ...document,
                ...form,
                updatedAt: timestamp,
              }
            : document
        )
      );
    } else {
      setDocuments((previous) => [
        {
          ...form,
          id: crypto.randomUUID(),
          number: getNextNumber(
            previous,
            form.type
          ),
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        ...previous,
      ]);
    }

    setModalOpen(false);
    setEditingDocument(null);
  };

  const deleteDocument = (document) => {
    if (
      !window.confirm(
        `Delete ${document.number}? This cannot be undone.`
      )
    ) {
      return;
    }

    setDocuments((previous) =>
      previous.filter(
        (item) => item.id !== document.id
      )
    );
  };

  const convertQuotation = (quotation) => {
    if (
      !window.confirm(
        `Convert ${quotation.number} to an invoice?`
      )
    ) {
      return;
    }

    const timestamp = new Date().toISOString();

    setDocuments((previous) => [
      {
        ...quotation,
        id: crypto.randomUUID(),
        type: "Invoice",
        number: getNextNumber(previous, "Invoice"),
        sourceQuotation: quotation.number,
        status: "Draft",
        amountPaid: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      ...previous,
    ]);
  };

  const cards = [
    {
      label: "Total Invoices",
      value: stats.invoices,
      icon: FileText,
    },
    {
      label: "Quotations",
      value: stats.quotations,
      icon: FileCheck2,
    },
    {
      label: "Total Billed",
      value: formatMoney(stats.billed),
      icon: IndianRupee,
    },
    {
      label: "Amount Received",
      value: formatMoney(stats.received),
      icon: Receipt,
    },
    {
      label: "Outstanding",
      value: formatMoney(stats.outstanding),
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
          <h1>Invoices & Quotations</h1>
          <p>
            Create, manage and print professional
            billing documents.
          </p>
        </div>

        <button
          type="button"
          className="invoices__button invoices__button--primary"
          onClick={openCreate}
        >
          <Plus size={18} />
          New Document
        </button>
      </div>

      {storageError && (
        <div className="invoices__error" role="alert">
          {storageError}
        </div>
      )}

      <div className="invoices__stats">
        {cards.map(({ label, value, icon: Icon }) => (
          <div className="invoices__stat" key={label}>
            <Icon size={21} />
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <section className="invoices__panel">
        <div className="invoices__panel-heading">
          <h2>All Documents</h2>
          <p>Invoices, quotations and billing records.</p>
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
              <option value="Invoice">Invoices</option>
              <option value="Quotation">Quotations</option>
            </select>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              aria-label="Filter document status"
            >
              <option value="All">All Statuses</option>
              {[
                ...STATUSES,
                "Overdue",
                "Accepted",
              ].map((status) => (
                <option key={status}>{status}</option>
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
              {filteredDocuments.map((document) => {
                const totals = calculateTotals(document);
                const status = getStatus(document, today);

                return (
                  <tr key={document.id}>
                    <td>
                      <div className="invoices__identity">
                        <span className="invoices__avatar">
                          {document.type === "Invoice" ? (
                            <FileText size={18} />
                          ) : (
                            <FileCheck2 size={18} />
                          )}
                        </span>
                        <div>
                          <strong>{document.number}</strong>
                          <small>{document.type}</small>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="invoices__client">
                        <strong>
                          {document.business ||
                            document.clientName}
                        </strong>
                        <small>
                          {document.projectName || "—"}
                        </small>
                      </div>
                    </td>

                    <td>{formatDate(document.issueDate)}</td>
                    <td>{formatDate(document.dueDate)}</td>

                    <td className="invoices__amount">
                      {formatMoney(totals.total)}
                    </td>

                    <td className="invoices__amount invoices__amount--pending">
                      {document.type === "Invoice"
                        ? formatMoney(totals.balance)
                        : "—"}
                    </td>

                    <td>
                      <span
                        className={`invoices__badge invoices__badge--${status
                          .toLowerCase()
                          .replace(/\s+/g, "-")}`}
                      >
                        {status}
                      </span>
                    </td>

                    <td>
                      <div className="invoices__actions">
                        <button
                          type="button"
                          onClick={() => setPreview(document)}
                          title="Preview / Print"
                          aria-label={`Preview ${document.number}`}
                        >
                          <Printer size={16} />
                        </button>

                        <button
                          type="button"
                          onClick={() => openEdit(document)}
                          title="Edit"
                          aria-label={`Edit ${document.number}`}
                        >
                          <Pencil size={16} />
                        </button>

                        {document.type === "Quotation" && (
                          <button
                            type="button"
                            onClick={() =>
                              convertQuotation(document)
                            }
                            title="Convert to Invoice"
                            aria-label={`Convert ${document.number} to invoice`}
                          >
                            <ArrowRightLeft size={16} />
                          </button>
                        )}

                        <button
                          type="button"
                          className="invoices__delete"
                          onClick={() =>
                            deleteDocument(document)
                          }
                          title="Delete"
                          aria-label={`Delete ${document.number}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredDocuments.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="invoices__empty">
                      <FileText size={36} />
                      <h3>No documents found</h3>
                      <p>
                        Create an invoice or quotation
                        to get started.
                      </p>
                      {documents.length === 0 && (
                        <button
                          type="button"
                          className="invoices__button invoices__button--primary"
                          onClick={openCreate}
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
          Showing {filteredDocuments.length} of{" "}
          {documents.length} documents
        </div>
      </section>

      {modalOpen && (
        <DocumentModal
          document={editingDocument}
          onClose={() => {
            setModalOpen(false);
            setEditingDocument(null);
          }}
          onSave={saveDocument}
        />
      )}

      {preview && (
        <PrintableDocument
          document={preview}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
