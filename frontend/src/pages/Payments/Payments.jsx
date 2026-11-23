
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus, Search, Filter, Wallet, IndianRupee, Clock3,
  AlertTriangle, CheckCircle2, CreditCard, Pencil, X,
  Building2, ReceiptText, History, CalendarDays, ArrowDownLeft,
} from "lucide-react";
import "./Payments.scss";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");

const METHODS = ["UPI", "Bank Transfer", "Cash", "Cheque", "Credit Card", "Debit Card", "Payment Gateway", "Other"];
const TYPES = ["Advance", "Milestone", "Final", "Maintenance", "Other"];
const STATUSES = ["Pending", "Completed", "Failed", "Refunded", "Partially Refunded", "Cancelled"];

const INITIAL_FORM = {
  client: "",
  project: "",
  amount: "",
  paymentType: "Advance",
  paymentMethod: "UPI",
  transactionId: "",
  referenceNumber: "",
  gatewayProvider: "",
  dueDate: "",
  description: "",
  notes: "",
};

const getId = (value) => typeof value === "string" ? value : value?._id || value?.id || "";
const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value) || 0);
const dateInput = (value) => value ? new Date(value).toISOString().slice(0, 10) : "";
const formatDate = (value) => value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Not set";

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.success !== true) {
    const issues = Array.isArray(data?.errors) ? data.errors.map((e) => e.message).filter(Boolean).join("; ") : "";
    throw new Error(issues || data?.message || `Request failed (${response.status})`);
  }
  return data;
}

async function mutation(path, method, payload) {
  const csrf = await request("/auth/csrf");
  if (!csrf.csrfToken) throw new Error("CSRF token unavailable. Please sign in again.");
  return request(path, {
    method,
    headers: { "X-CSRF-Token": csrf.csrfToken },
    ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
  });
}

async function fetchAll(path, key) {
  const output = [];
  let page = 1;
  let totalPages = 1;
  do {
    const separator = path.includes("?") ? "&" : "?";
    const data = await request(`${path}${separator}page=${page}&limit=100`);
    if (!Array.isArray(data[key])) throw new Error(`Unexpected ${key} response.`);
    output.push(...data[key]);
    totalPages = data.pagination?.totalPages ?? 1;
    page += 1;
  } while (page <= totalPages);
  return output;
}

function PaymentModal({ payment, clients, projects, onClose, onSave }) {
  const editing = Boolean(payment);
  const [form, setForm] = useState(() => payment ? {
    ...INITIAL_FORM,
    dueDate: dateInput(payment.dueDate),
    description: payment.description || "",
    notes: payment.notes || "",
  } : { ...INITIAL_FORM });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const change = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: value,
      ...(name === "client" ? { project: "" } : {}),
    }));
    setError("");
  };

  const availableProjects = projects.filter((project) => getId(project.client) === form.client);

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;

    let payload;

    if (editing) {
      payload = {
        dueDate: form.dueDate ? new Date(`${form.dueDate}T12:00:00`).toISOString() : null,
        description: form.description.trim(),
        notes: form.notes.trim(),
      };
    } else {
      const amount = Number(form.amount);
      if (!form.client) { setError("Select a client."); return; }
      if (!Number.isFinite(amount) || amount <= 0 || amount > 999999999999 || Math.abs(Math.round(amount * 100) - amount * 100) > 0.000001) {
        setError("Enter a valid amount with maximum two decimal places.");
        return;
      }
      if (form.paymentMethod === "Payment Gateway" && !form.gatewayProvider.trim()) {
        setError("Gateway provider is required.");
        return;
      }
      payload = {
        client: form.client,
        project: form.project || null,
        amount,
        currency: "INR",
        paymentType: form.paymentType,
        paymentMethod: form.paymentMethod,
        transactionId: form.transactionId.trim() || null,
        referenceNumber: form.referenceNumber.trim() || null,
        gatewayProvider: form.paymentMethod === "Payment Gateway" ? form.gatewayProvider.trim() : "",
        gatewayPaymentId: null,
        gatewayOrderId: null,
        dueDate: form.dueDate ? new Date(`${form.dueDate}T12:00:00`).toISOString() : null,
        description: form.description.trim(),
        notes: form.notes.trim(),
      };
    }

    try {
      setSaving(true);
      await onSave(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="payments__modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <section className="payments__modal" role="dialog" aria-modal="true" aria-labelledby="payment-modal-title">
        <div className="payments__modal-header">
          <div>
            <h2 id="payment-modal-title">{editing ? "Edit Payment Details" : "Create Payment"}</h2>
            <p>{editing ? "Only non-financial fields can be updated." : "Create a pending payment record."}</p>
          </div>
          <button type="button" className="payments__icon-button" onClick={onClose} disabled={saving} aria-label="Close"><X size={20} /></button>
        </div>
        <form className="payments__form" onSubmit={submit}>
          <div className="payments__form-grid">
            {!editing && (
              <>
                <label>Client *<select name="client" value={form.client} onChange={change} required><option value="">Select client</option>{clients.map((client) => <option key={getId(client)} value={getId(client)}>{client.name}{client.company ? ` — ${client.company}` : ""}</option>)}</select></label>
                <label>Project<select name="project" value={form.project} onChange={change}><option value="">No project</option>{availableProjects.map((project) => <option key={getId(project)} value={getId(project)}>{project.name || project.title}</option>)}</select></label>
                <label>Amount (₹) *<input name="amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={change} required /></label>
                <label>Payment Type<select name="paymentType" value={form.paymentType} onChange={change}>{TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
                <label>Payment Method<select name="paymentMethod" value={form.paymentMethod} onChange={change}>{METHODS.map((method) => <option key={method}>{method}</option>)}</select></label>
                <label>Transaction ID<input name="transactionId" value={form.transactionId} onChange={change} maxLength={150} placeholder="Optional" /></label>
                <label>Reference Number<input name="referenceNumber" value={form.referenceNumber} onChange={change} maxLength={100} placeholder="Optional" /></label>
                {form.paymentMethod === "Payment Gateway" && <label>Gateway Provider *<input name="gatewayProvider" value={form.gatewayProvider} onChange={change} maxLength={100} required placeholder="Razorpay, Stripe..." /></label>}
              </>
            )}
            <label>Due Date<input name="dueDate" type="date" value={form.dueDate} onChange={change} /></label>
            <label className="payments__form-full">Description<textarea name="description" value={form.description} onChange={change} rows={2} maxLength={2000} /></label>
            <label className="payments__form-full">Notes<textarea name="notes" value={form.notes} onChange={change} rows={3} maxLength={5000} /></label>
          </div>
          {error && <p className="payments__form-error" role="alert">{error}</p>}
          <div className="payments__modal-actions">
            <button type="button" className="payments__button payments__button--secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="payments__button payments__button--primary" disabled={saving}>{saving ? "Saving..." : editing ? "Save Changes" : "Create Payment"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ActionModal({ payment, action, onClose, onSubmit }) {
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const remaining = Math.round((Number(payment.amount) - Number(payment.refundedAmount || 0)) * 100) / 100;

  const submit = async (event) => {
    event.preventDefault();
    let payload;
    if (action === "verify") {
      const date = new Date(paymentDate);
      if (Number.isNaN(date.getTime())) { setError("Enter a valid payment date."); return; }
      payload = { paymentDate: date.toISOString(), notes: notes.trim() };
    } else if (action === "refund") {
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0 || value > remaining || Math.abs(Math.round(value * 100) - value * 100) > 0.000001) {
        setError(`Refund amount must be between ₹0.01 and ${money(remaining)}.`);
        return;
      }
      if (!referenceNumber.trim()) { setError("Refund reference is required."); return; }
      payload = { amount: value, reason: reason.trim(), referenceNumber: referenceNumber.trim() };
    } else {
      payload = { reason: reason.trim() };
    }
    if (action !== "verify" && reason.trim().length < 3) {
      setError("Reason must contain at least 3 characters.");
      return;
    }
    try {
      setSaving(true);
      await onSubmit(action, payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="payments__modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <section className="payments__modal payments__modal--small" role="dialog" aria-modal="true" aria-labelledby="payment-action-title">
        <div className="payments__modal-header">
          <div><h2 id="payment-action-title">{action === "verify" ? "Verify Payment" : action === "refund" ? "Refund Payment" : action === "fail" ? "Mark Payment Failed" : "Cancel Payment"}</h2><p>{payment.client?.name || "Client"} — {money(payment.amount)}</p></div>
          <button type="button" className="payments__icon-button" onClick={onClose} disabled={saving} aria-label="Close"><X size={20} /></button>
        </div>
        <form className="payments__form" onSubmit={submit}>
          <div className="payments__form-grid">
            {action === "verify" ? (
              <>
                <label>Payment Date *<input type="datetime-local" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required /></label>
                <label className="payments__form-full">Verification Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={5000} rows={3} /></label>
              </>
            ) : (
              <>
                {action === "refund" && (
                  <>
                    <div className="payments__balance-note">Available for refund: {money(remaining)}</div>
                    <label>Refund Amount *<input type="number" min="0.01" max={remaining} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></label>
                    <label>Refund Reference *<input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} maxLength={100} required /></label>
                  </>
                )}
                <label className="payments__form-full">Reason *<textarea value={reason} onChange={(e) => setReason(e.target.value)} minLength={3} maxLength={1000} rows={3} required /></label>
              </>
            )}
          </div>
          {error && <p className="payments__form-error" role="alert">{error}</p>}
          <div className="payments__modal-actions">
            <button type="button" className="payments__button payments__button--secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="payments__button payments__button--primary" disabled={saving}>{saving ? "Processing..." : "Confirm"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [paymentModal, setPaymentModal] = useState(null);
  const [actionModal, setActionModal] = useState(null);
  const [historyPayment, setHistoryPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [records, summary] = await Promise.all([
          fetchAll("/payments", "payments"),
          request("/payments/stats"),
        ]);
        if (active) {
          setPayments(records);
          setStats(summary.stats);
        }
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [revision]);

  const filteredPayments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return payments.filter((payment) =>
      (statusFilter === "All" || payment.status === statusFilter) &&
      [payment.client?.name, payment.client?.company, payment.project?.name, payment.transactionId, payment.referenceNumber, payment.description]
        .some((value) => String(value || "").toLowerCase().includes(query))
    );
  }, [payments, search, statusFilter]);

  const openPaymentModal = async (payment = null) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (!payment) {
        const [clientList, projectList] = await Promise.all([
          fetchAll("/clients", "clients"),
          fetchAll("/projects", "projects"),
        ]);
        setClients(clientList);
        setProjects(projectList);
      }
      setPaymentModal(payment || "new");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const savePayment = async (payload) => {
    if (paymentModal === "new") {
      await mutation("/payments", "POST", payload);
    } else {
      await mutation(`/payments/${getId(paymentModal)}`, "PATCH", payload);
    }
    setPaymentModal(null);
    refresh();
  };

  const executeAction = async (action, payload) => {
    const paymentId = getId(actionModal.payment);
    const route = action === "refund" ? "refund" : action;
    await mutation(`/payments/${paymentId}/${route}`, action === "refund" ? "POST" : "PATCH", payload);
    setActionModal(null);
    refresh();
  };

  const cards = [
    { label: "Total Payments", value: stats?.total ?? 0, Icon: Wallet },
    { label: "Gross Revenue", value: money(stats?.grossRevenue), Icon: IndianRupee },
    { label: "Net Revenue", value: money(stats?.netRevenue), Icon: CheckCircle2 },
    { label: "Pending Amount", value: money(stats?.pendingAmount), Icon: Clock3 },
    { label: "Overdue Amount", value: money(stats?.overdueAmount), Icon: AlertTriangle },
    { label: "Total Refunded", value: money(stats?.totalRefunded), Icon: ArrowDownLeft },
  ];

  return (
    <div className="payments">
      <div className="payments__header">
        <div>
          <span className="payments__eyebrow">FINANCIAL MANAGEMENT</span>
          <h1>Payments Management</h1>
          <p>Track transactions, verify payments and manage refunds.</p>
        </div>
        <button type="button" className="payments__button payments__button--primary" onClick={() => void openPaymentModal()} disabled={busy}>
          <Plus size={18} /> Create Payment
        </button>
      </div>

      {error && <div className="payments__error" role="alert">{error}</div>}

      <div className="payments__stats">
        {cards.map(({ label, value, Icon }) => (
          <div className="payments__stat" key={label}>
            <Icon size={21} />
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <section className="payments__panel">
        <div className="payments__panel-heading">
          <div><h2><ReceiptText size={19} /> Payment Records</h2><p>All recorded transactions</p></div>
        </div>
        <div className="payments__toolbar">
          <div className="payments__search">
            <Search size={18} />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search client, project, reference..." />
          </div>
          <div className="payments__filters">
            <Filter size={17} />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="All">All Statuses</option>
              {STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </div>
        </div>

        <div className="payments__table-wrap">
          <table className="payments__table">
            <thead>
              <tr>
                <th>Client / Project</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Type</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Reference</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((payment) => (
                <tr key={getId(payment)}>
                  <td>
                    <div className="payments__identity">
                      <span className="payments__avatar"><Building2 size={17} /></span>
                      <div>
                        <strong>{payment.client?.name || "Unknown Client"}</strong>
                        <small>{payment.project?.name || payment.client?.company || "No project"}</small>
                      </div>
                    </div>
                  </td>
                  <td className="payments__amount">{money(payment.amount)}</td>
                  <td><CreditCard size={14} /> {payment.paymentMethod}</td>
                  <td>{payment.paymentType}</td>
                  <td><span className="payments__date"><CalendarDays size={14} /> {formatDate(payment.dueDate)}</span></td>
                  <td><span className={`payments__badge payments__badge--${payment.status.toLowerCase().replace(/\s+/g, "-")}`}>{payment.status}</span></td>
                  <td>{payment.referenceNumber || payment.transactionId || "—"}</td>
                  <td>
                    <div className="payments__actions">
                      <button type="button" title="Edit details" onClick={() => void openPaymentModal(payment)} disabled={busy}><Pencil size={16} /></button>
                      {payment.status === "Pending" && (
                        <>
                          <button type="button" title="Verify payment" onClick={() => setActionModal({ payment, action: "verify" })} disabled={busy}><CheckCircle2 size={16} /></button>
                          <button type="button" title="Mark failed" onClick={() => setActionModal({ payment, action: "fail" })} disabled={busy}><AlertTriangle size={16} /></button>
                          <button type="button" title="Cancel payment" onClick={() => setActionModal({ payment, action: "cancel" })} disabled={busy}><X size={16} /></button>
                        </>
                      )}
                      {["Completed", "Partially Refunded"].includes(payment.status) && (
                        <button type="button" title="Refund payment" onClick={() => setActionModal({ payment, action: "refund" })} disabled={busy}><ArrowDownLeft size={16} /></button>
                      )}
                      <button type="button" title="View payment details" onClick={() => setHistoryPayment(payment)}><History size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredPayments.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="payments__empty">
                      <Wallet size={36} />
                      <h3>{loading ? "Loading payments..." : "No payments found"}</h3>
                      <p>{loading ? "Fetching payment records." : "Create a payment or adjust your filters."}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="payments__table-footer">Showing {filteredPayments.length} of {payments.length} payments</div>
      </section>

      {historyPayment && (
        <section className="payments__panel">
          <div className="payments__history-heading">
            <h2><History size={19} /> Payment Details</h2>
            <button type="button" className="payments__icon-button" onClick={() => setHistoryPayment(null)} aria-label="Close details"><X size={18} /></button>
          </div>
          <div className="payments__history-summary">
            <div><span>Client</span><strong>{historyPayment.client?.name || "—"}</strong></div>
            <div><span>Amount</span><strong>{money(historyPayment.amount)}</strong></div>
            <div><span>Refunded</span><strong>{money(historyPayment.refundedAmount)}</strong></div>
            <div><span>Payment Date</span><strong>{formatDate(historyPayment.paymentDate)}</strong></div>
            <div><span>Status</span><strong>{historyPayment.status}</strong></div>
            <div><span>Notes</span><strong>{historyPayment.notes || "—"}</strong></div>
          </div>
        </section>
      )}

      {paymentModal && (
        <PaymentModal
          payment={paymentModal === "new" ? null : paymentModal}
          clients={clients}
          projects={projects}
          onClose={() => setPaymentModal(null)}
          onSave={savePayment}
        />
      )}

      {actionModal && (
        <ActionModal
          payment={actionModal.payment}
          action={actionModal.action}
          onClose={() => setActionModal(null)}
          onSubmit={executeAction}
        />
      )}
    </div>
  );
}
