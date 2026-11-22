
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Filter,
  Wallet,
  IndianRupee,
  Clock3,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Pencil,
  Trash2,
  X,
  Building2,
  ReceiptText,
  History,
  CalendarDays,
  ArrowDownLeft,
} from "lucide-react";

import "./Payments.scss";

const STORAGE_KEY = "webro-management-payments-v1";

const METHODS = [
  "UPI",
  "Bank Transfer",
  "Cash",
  "Cheque",
  "Card",
  "Other",
];

const EMPTY_ACCOUNT = {
  clientName: "",
  business: "",
  projectName: "",
  contractAmount: "",
  dueDate: "",
  notes: "",
};

const EMPTY_PAYMENT = {
  amount: "",
  paidAt: "",
  method: "UPI",
  reference: "",
  notes: "",
};

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const pad = (value) => String(value).padStart(2, "0");

function todayKey() {
  const date = new Date();

  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}`;
}

function formatDate(value) {
  if (!value) return "Not set";

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) return "Invalid date";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function readAccounts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed)
      ? parsed.filter(
          (account) =>
            account &&
            typeof account === "object" &&
            typeof account.id === "string" &&
            Array.isArray(account.payments)
        )
      : [];
  } catch {
    return [];
  }
}

function getReceived(account) {
  return account.payments.reduce(
    (total, payment) =>
      total + (Number(payment.amount) || 0),
    0
  );
}

function getBalance(account) {
  return Math.max(
    0,
    (Number(account.contractAmount) || 0) -
      getReceived(account)
  );
}

function getStatus(account, today) {
  const balance = getBalance(account);

  if (balance <= 0) return "Paid";

  if (account.dueDate && account.dueDate < today) {
    return "Overdue";
  }

  if (getReceived(account) > 0) {
    return "Partial";
  }

  return "Unpaid";
}

function AccountModal({ account, onClose, onSave }) {
  const [form, setForm] = useState(() =>
    account
      ? {
          ...EMPTY_ACCOUNT,
          ...account,
          contractAmount: String(
            account.contractAmount ?? ""
          ),
        }
      : EMPTY_ACCOUNT
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

    const clientName = form.clientName.trim();
    const projectName = form.projectName.trim();
    const amount = Number(form.contractAmount);

    if (!clientName || !projectName) {
      setError("Client and project names are required.");
      return;
    }

    if (
      form.contractAmount === "" ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 1000000000 ||
      !Number.isInteger(amount * 100)
    ) {
      setError("Enter a valid contract amount.");
      return;
    }

    const alreadyReceived = account
      ? getReceived(account)
      : 0;

    if (Math.round(amount * 100) <
        Math.round(alreadyReceived * 100)) {
      setError(
        "Contract amount cannot be less than payments already received."
      );
      return;
    }

    onSave({
      clientName,
      business: form.business.trim(),
      projectName,
      contractAmount: amount,
      dueDate: form.dueDate,
      notes: form.notes.trim(),
    });
  };

  return (
    <div
      className="payments__modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="payments__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-account-title"
      >
        <div className="payments__modal-header">
          <div>
            <h2 id="payment-account-title">
              {account
                ? "Edit Payment Account"
                : "Create Payment Account"}
            </h2>
            <p>Set the contract value and payment deadline.</p>
          </div>

          <button
            type="button"
            className="payments__icon-button"
            onClick={onClose}
            aria-label="Close form"
          >
            <X size={19} />
          </button>
        </div>

        <form
          className="payments__form"
          onSubmit={handleSubmit}
        >
          <div className="payments__form-grid">
            <label>
              Client Name *
              <input
                name="clientName"
                value={form.clientName}
                onChange={handleChange}
                maxLength={100}
                placeholder="Client name"
                required
              />
            </label>

            <label>
              Business / Company
              <input
                name="business"
                value={form.business}
                onChange={handleChange}
                maxLength={120}
                placeholder="Business name"
              />
            </label>

            <label className="payments__form-full">
              Project Name *
              <input
                name="projectName"
                value={form.projectName}
                onChange={handleChange}
                maxLength={150}
                placeholder="Website development"
                required
              />
            </label>

            <label>
              Contract Amount (₹) *
              <input
                name="contractAmount"
                type="number"
                min="0.01"
                max="1000000000"
                step="0.01"
                value={form.contractAmount}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              Payment Due Date
              <input
                name="dueDate"
                type="date"
                value={form.dueDate}
                onChange={handleChange}
              />
            </label>

            <label className="payments__form-full">
              Notes
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                maxLength={2000}
                rows={3}
                placeholder="Payment terms or contract notes..."
              />
            </label>
          </div>

          {error && (
            <p className="payments__form-error" role="alert">
              {error}
            </p>
          )}

          <div className="payments__modal-actions">
            <button
              type="button"
              className="payments__button payments__button--secondary"
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="payments__button payments__button--primary"
            >
              {account ? "Save Changes" : "Create Account"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function InstallmentModal({
  account,
  payment,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(() =>
    payment
      ? {
          ...EMPTY_PAYMENT,
          ...payment,
          amount: String(payment.amount),
        }
      : {
          ...EMPTY_PAYMENT,
          paidAt: todayKey(),
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

    const amount = Number(form.amount);

    if (
      form.amount === "" ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Number.isInteger(amount * 100)
    ) {
      setError("Enter a valid payment amount.");
      return;
    }

    if (!form.paidAt || form.paidAt > todayKey()) {
      setError("Payment date cannot be in the future.");
      return;
    }

    const otherPayments = account.payments
      .filter((item) => item.id !== payment?.id)
      .reduce(
        (sum, item) =>
          sum + Math.round(Number(item.amount) * 100),
        0
      );

    const contractCents = Math.round(
      Number(account.contractAmount) * 100
    );

    if (
      otherPayments + Math.round(amount * 100) >
      contractCents
    ) {
      setError(
        `Payment exceeds the remaining balance of ${money(
          (contractCents - otherPayments) / 100
        )}.`
      );
      return;
    }

    onSave({
      amount,
      paidAt: form.paidAt,
      method: form.method,
      reference: form.reference.trim(),
      notes: form.notes.trim(),
    });
  };

  return (
    <div
      className="payments__modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="payments__modal payments__modal--small"
        role="dialog"
        aria-modal="true"
        aria-labelledby="installment-modal-title"
      >
        <div className="payments__modal-header">
          <div>
            <h2 id="installment-modal-title">
              {payment ? "Edit Payment" : "Record Payment"}
            </h2>
            <p>{account.clientName} — {account.projectName}</p>
          </div>

          <button
            type="button"
            className="payments__icon-button"
            onClick={onClose}
            aria-label="Close payment form"
          >
            <X size={19} />
          </button>
        </div>

        <form
          className="payments__form"
          onSubmit={handleSubmit}
        >
          <div className="payments__balance-note">
            <span>Current Outstanding</span>
            <strong>{money(getBalance(account))}</strong>
          </div>

          <div className="payments__form-grid">
            <label>
              Amount Received (₹) *
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              Payment Date *
              <input
                name="paidAt"
                type="date"
                value={form.paidAt}
                onChange={handleChange}
                max={todayKey()}
                required
              />
            </label>

            <label>
              Payment Method
              <select
                name="method"
                value={form.method}
                onChange={handleChange}
              >
                {METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Transaction Reference
              <input
                name="reference"
                value={form.reference}
                onChange={handleChange}
                maxLength={120}
                placeholder="UTR / transaction ID"
              />
            </label>

            <label className="payments__form-full">
              Payment Notes
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                maxLength={2000}
                rows={3}
                placeholder="Additional payment details..."
              />
            </label>
          </div>

          {error && (
            <p className="payments__form-error" role="alert">
              {error}
            </p>
          )}

          <div className="payments__modal-actions">
            <button
              type="button"
              className="payments__button payments__button--secondary"
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="payments__button payments__button--primary"
            >
              {payment ? "Save Changes" : "Record Payment"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function Payments() {
  const [accounts, setAccounts] = useState(readAccounts);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [accountModal, setAccountModal] = useState(null);
  const [installmentModal, setInstallmentModal] =
    useState(null);
  const [historyAccountId, setHistoryAccountId] =
    useState(null);
  const [storageError, setStorageError] = useState("");
  const [today, setToday] = useState(todayKey);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(accounts)
      );
      setStorageError("");
    } catch {
      setStorageError(
        "Unable to save payments in browser storage."
      );
    }
  }, [accounts]);

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
    const contract = accounts.reduce(
      (sum, account) =>
        sum + (Number(account.contractAmount) || 0),
      0
    );

    const received = accounts.reduce(
      (sum, account) => sum + getReceived(account),
      0
    );

    const overdue = accounts.reduce(
      (sum, account) =>
        sum +
        (getStatus(account, today) === "Overdue"
          ? getBalance(account)
          : 0),
      0
    );

    return {
      accounts: accounts.length,
      contract,
      received,
      pending: Math.max(0, contract - received),
      overdue,
    };
  }, [accounts, today]);

  const filteredAccounts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return accounts
      .filter((account) => {
        const matchesSearch = [
          account.clientName,
          account.business,
          account.projectName,
        ].some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(query)
        );

        return (
          matchesSearch &&
          (statusFilter === "All" ||
            getStatus(account, today) === statusFilter)
        );
      })
      .sort((a, b) =>
        (a.dueDate || "9999-12-31").localeCompare(
          b.dueDate || "9999-12-31"
        )
      );
  }, [accounts, search, statusFilter, today]);

  const historyAccount = accounts.find(
    (account) => account.id === historyAccountId
  );

  const history = useMemo(() => {
    if (!historyAccount) return [];

    return [...historyAccount.payments].sort(
      (a, b) =>
        b.paidAt.localeCompare(a.paidAt) ||
        b.createdAt.localeCompare(a.createdAt)
    );
  }, [historyAccount]);

  const saveAccount = (form) => {
    const timestamp = new Date().toISOString();

    if (accountModal?.account) {
      setAccounts((previous) =>
        previous.map((account) =>
          account.id === accountModal.account.id
            ? {
                ...account,
                ...form,
                updatedAt: timestamp,
              }
            : account
        )
      );
    } else {
      setAccounts((previous) => [
        {
          ...form,
          id: crypto.randomUUID(),
          payments: [],
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        ...previous,
      ]);
    }

    setAccountModal(null);
  };

  const deleteAccount = (account) => {
    if (
      !window.confirm(
        `Delete "${account.clientName}" payment account and all its transactions?`
      )
    ) {
      return;
    }

    setAccounts((previous) =>
      previous.filter((item) => item.id !== account.id)
    );

    if (historyAccountId === account.id) {
      setHistoryAccountId(null);
    }
  };

  const saveInstallment = (form) => {
    if (!installmentModal) return;

    const { accountId, payment } = installmentModal;
    const timestamp = new Date().toISOString();

    setAccounts((previous) =>
      previous.map((account) => {
        if (account.id !== accountId) return account;

        const payments = payment
          ? account.payments.map((item) =>
              item.id === payment.id
                ? {
                    ...item,
                    ...form,
                    updatedAt: timestamp,
                  }
                : item
            )
          : [
              ...account.payments,
              {
                ...form,
                id: crypto.randomUUID(),
                createdAt: timestamp,
                updatedAt: timestamp,
              },
            ];

        return {
          ...account,
          payments,
          updatedAt: timestamp,
        };
      })
    );

    setInstallmentModal(null);
  };

  const deleteInstallment = (accountId, payment) => {
    if (
      !window.confirm(
        `Delete payment of ${money(payment.amount)}?`
      )
    ) {
      return;
    }

    setAccounts((previous) =>
      previous.map((account) =>
        account.id === accountId
          ? {
              ...account,
              payments: account.payments.filter(
                (item) => item.id !== payment.id
              ),
              updatedAt: new Date().toISOString(),
            }
          : account
      )
    );
  };

  const cards = [
    {
      label: "Payment Accounts",
      value: stats.accounts,
      icon: Wallet,
    },
    {
      label: "Total Contract Value",
      value: money(stats.contract),
      icon: IndianRupee,
    },
    {
      label: "Payments Received",
      value: money(stats.received),
      icon: CheckCircle2,
    },
    {
      label: "Pending Balance",
      value: money(stats.pending),
      icon: Clock3,
    },
    {
      label: "Overdue Amount",
      value: money(stats.overdue),
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="payments">
      <div className="payments__header">
        <div>
          <span className="payments__eyebrow">
            FINANCIAL MANAGEMENT
          </span>
          <h1>Payment Management</h1>
          <p>
            Track client contracts, installments,
            outstanding balances and payment history.
          </p>
        </div>

        <button
          type="button"
          className="payments__button payments__button--primary"
          onClick={() =>
            setAccountModal({ account: null })
          }
        >
          <Plus size={18} />
          New Payment Account
        </button>
      </div>

      {storageError && (
        <div className="payments__error" role="alert">
          {storageError}
        </div>
      )}

      <div className="payments__stats">
        {cards.map(({ label, value, icon: Icon }) => (
          <div className="payments__stat" key={label}>
            <Icon size={21} />
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <section className="payments__panel">
        <div className="payments__panel-heading">
          <div>
            <h2>
              <ReceiptText size={19} />
              Client Payment Accounts
            </h2>
            <p>
              Contract amounts and installment tracking.
            </p>
          </div>
        </div>

        <div className="payments__toolbar">
          <div className="payments__search">
            <Search size={18} />
            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search client, business, project..."
              aria-label="Search payment accounts"
            />
          </div>

          <div className="payments__filters">
            <Filter size={17} />
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              aria-label="Filter by payment status"
            >
              <option value="All">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Partial">Partial</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Overdue">Overdue</option>
            </select>
          </div>
        </div>

        <div className="payments__table-wrap">
          <table className="payments__table">
            <thead>
              <tr>
                <th>Client / Project</th>
                <th>Contract Value</th>
                <th>Received</th>
                <th>Pending</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Installments</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredAccounts.map((account) => {
                const received = getReceived(account);
                const pending = getBalance(account);
                const status = getStatus(account, today);

                return (
                  <tr key={account.id}>
                    <td>
                      <div className="payments__identity">
                        <span className="payments__avatar">
                          <Building2 size={18} />
                        </span>

                        <div>
                          <strong>
                            {account.clientName}
                          </strong>
                          <small>
                            {account.business ||
                              account.projectName}
                          </small>
                          {account.business && (
                            <small>{account.projectName}</small>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="payments__amount">
                      {money(account.contractAmount)}
                    </td>

                    <td className="payments__amount payments__amount--received">
                      {money(received)}
                    </td>

                    <td className="payments__amount payments__amount--pending">
                      {money(pending)}
                    </td>

                    <td>
                      <span className="payments__date">
                        <CalendarDays size={14} />
                        {formatDate(account.dueDate)}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`payments__badge payments__badge--${status.toLowerCase()}`}
                      >
                        {status}
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="payments__history-link"
                        onClick={() =>
                          setHistoryAccountId(account.id)
                        }
                      >
                        <History size={15} />
                        {account.payments.length} payments
                      </button>
                    </td>

                    <td>
                      <div className="payments__actions">
                        <button
                          type="button"
                          className="payments__record"
                          onClick={() =>
                            setInstallmentModal({
                              accountId: account.id,
                              payment: null,
                            })
                          }
                          disabled={pending <= 0}
                          title="Record installment"
                          aria-label={`Record payment for ${account.clientName}`}
                        >
                          <Plus size={16} />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setAccountModal({ account })
                          }
                          title="Edit account"
                          aria-label={`Edit ${account.clientName}`}
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          type="button"
                          className="payments__delete"
                          onClick={() => deleteAccount(account)}
                          title="Delete account"
                          aria-label={`Delete ${account.clientName}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredAccounts.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="payments__empty">
                      <Wallet size={36} />
                      <h3>No payment accounts found</h3>
                      <p>
                        {accounts.length === 0
                          ? "Create a payment account to start tracking receipts."
                          : "Try adjusting your search or filters."}
                      </p>

                      {accounts.length === 0 && (
                        <button
                          type="button"
                          className="payments__button payments__button--primary"
                          onClick={() =>
                            setAccountModal({
                              account: null,
                            })
                          }
                        >
                          <Plus size={16} />
                          Create Account
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="payments__table-footer">
          Showing {filteredAccounts.length} of{" "}
          {accounts.length} accounts
        </div>
      </section>

      {/* PAYMENT HISTORY */}

      {historyAccount && (
        <section className="payments__panel">
          <div className="payments__history-heading">
            <div>
              <h2>
                <History size={19} />
                Payment History
              </h2>
              <p>
                {historyAccount.clientName} —{" "}
                {historyAccount.projectName}
              </p>
            </div>

            <button
              type="button"
              className="payments__icon-button"
              onClick={() => setHistoryAccountId(null)}
              aria-label="Close payment history"
            >
              <X size={19} />
            </button>
          </div>

          <div className="payments__history-summary">
            <div>
              <span>Contract</span>
              <strong>
                {money(historyAccount.contractAmount)}
              </strong>
            </div>
            <div>
              <span>Received</span>
              <strong>
                {money(getReceived(historyAccount))}
              </strong>
            </div>
            <div>
              <span>Outstanding</span>
              <strong>
                {money(getBalance(historyAccount))}
              </strong>
            </div>
          </div>

          <div className="payments__history-toolbar">
            <h3>Transactions</h3>

            <button
              type="button"
              className="payments__button payments__button--primary"
              onClick={() =>
                setInstallmentModal({
                  accountId: historyAccount.id,
                  payment: null,
                })
              }
              disabled={getBalance(historyAccount) <= 0}
            >
              <Plus size={16} />
              Add Payment
            </button>
          </div>

          {history.length === 0 ? (
            <div className="payments__empty">
              <CreditCard size={32} />
              <h3>No transactions yet</h3>
              <p>
                Record an installment to build payment history.
              </p>
            </div>
          ) : (
            <div className="payments__table-wrap">
              <table className="payments__table payments__table--history">
                <thead>
                  <tr>
                    <th>Payment Date</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Reference</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {history.map((payment) => (
                    <tr key={payment.id}>
                      <td>
                        <span className="payments__date">
                          <CalendarDays size={14} />
                          {formatDate(payment.paidAt)}
                        </span>
                      </td>

                      <td>
                        <span className="payments__transaction-amount">
                          <ArrowDownLeft size={15} />
                          {money(payment.amount)}
                        </span>
                      </td>

                      <td>{payment.method}</td>

                      <td>{payment.reference || "—"}</td>

                      <td>
                        <span className="payments__notes">
                          {payment.notes || "—"}
                        </span>
                      </td>

                      <td>
                        <div className="payments__actions">
                          <button
                            type="button"
                            onClick={() =>
                              setInstallmentModal({
                                accountId: historyAccount.id,
                                payment,
                              })
                            }
                            title="Edit payment"
                            aria-label="Edit payment"
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            type="button"
                            className="payments__delete"
                            onClick={() =>
                              deleteInstallment(
                                historyAccount.id,
                                payment
                              )
                            }
                            title="Delete payment"
                            aria-label="Delete payment"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {accountModal && (
        <AccountModal
          account={accountModal.account}
          onClose={() => setAccountModal(null)}
          onSave={saveAccount}
        />
      )}

      {installmentModal && (
        <InstallmentModal
          account={
            accounts.find(
              (account) =>
                account.id === installmentModal.accountId
            )
          }
          payment={installmentModal.payment}
          onClose={() => setInstallmentModal(null)}
          onSave={saveInstallment}
        />
      )}
    </div>
  );
}
