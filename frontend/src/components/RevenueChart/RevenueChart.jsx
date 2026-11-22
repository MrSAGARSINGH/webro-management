
import { useId, useMemo, useState } from "react";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

import {
  TrendingUp,
  CalendarDays,
  BarChart3,
} from "lucide-react";

import "./RevenueChart.scss";

// ==========================================
// DEMO DATA
// ==========================================

const demoData = [
  { month: "Jan", received: 35000, pending: 12000 },
  { month: "Feb", received: 48000, pending: 18000 },
  { month: "Mar", received: 42000, pending: 9000 },
  { month: "Apr", received: 65000, pending: 22000 },
  { month: "May", received: 57000, pending: 14000 },
  { month: "Jun", received: 82000, pending: 25000 },
  { month: "Jul", received: 74000, pending: 16000 },
  { month: "Aug", received: 91000, pending: 28000 },
  { month: "Sep", received: 86000, pending: 21000 },
  { month: "Oct", received: 105000, pending: 30000 },
  { month: "Nov", received: 98000, pending: 19000 },
  { month: "Dec", received: 125000, pending: 35000 },
];

// ==========================================
// FORMATTERS
// ==========================================

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const formatCurrency = (value) =>
  currencyFormatter.format(value);

const formatAxis = (value) => {
  if (value >= 100000) {
    return `${Number((value / 100000).toFixed(1))}L`;
  }

  if (value >= 1000) {
    return `${Number((value / 1000).toFixed(1))}k`;
  }

  return String(value);
};

const normalizeAmount = (value) => {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const amount = Number(value);

  return Number.isFinite(amount)
    ? Math.max(0, amount)
    : 0;
};

const normalizeData = (data) => {
  if (!Array.isArray(data)) return [];

  return data
    .filter(
      (item) =>
        item &&
        typeof item === "object" &&
        !Array.isArray(item)
    )
    .map((item) => ({
      ...item,
      month: String(item.month ?? ""),
      received: normalizeAmount(item.received),
      pending: normalizeAmount(item.pending),
    }));
};

// ==========================================
// TOOLTIP
// ==========================================

function RevenueTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="revenue-chart__tooltip">
      <div className="revenue-chart__tooltip-title">
        {label}
      </div>

      {payload.map((entry) => (
        <div
          className="revenue-chart__tooltip-row"
          key={entry.dataKey}
        >
          <span className="revenue-chart__tooltip-name">
            <span
              className={`revenue-chart__dot revenue-chart__dot--${entry.dataKey}`}
            />

            {entry.dataKey === "received"
              ? "Received"
              : "Pending"}
          </span>

          <strong>
            {formatCurrency(normalizeAmount(entry.value))}
          </strong>
        </div>
      ))}
    </div>
  );
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function RevenueChart({
  data = demoData,
  isDemo = true,
}) {
  const [view, setView] = useState("all");

  const uniqueId = useId().replace(/:/g, "");

  const receivedGradientId = `webro-received-${uniqueId}`;
  const pendingGradientId = `webro-pending-${uniqueId}`;

  const safeData = useMemo(
    () => normalizeData(data),
    [data]
  );

  const chartData = useMemo(
    () =>
      view === "six"
        ? safeData.slice(-6)
        : safeData,
    [safeData, view]
  );

  const totals = useMemo(
    () =>
      chartData.reduce(
        (result, item) => ({
          received: result.received + item.received,
          pending: result.pending + item.pending,
        }),
        { received: 0, pending: 0 }
      ),
    [chartData]
  );

  return (
    <section
      className="revenue-chart"
      aria-label="Revenue overview"
    >
      {/* ================= HEADER ================= */}

      <div className="revenue-chart__header">
        <div className="revenue-chart__heading">
          <div className="revenue-chart__title">
            <span className="revenue-chart__title-icon">
              <TrendingUp size={19} />
            </span>

            <h2>Revenue Overview</h2>
          </div>

          <p>
            Received and pending client payments
            {isDemo && " · Demo data"}
          </p>
        </div>

        <div
          className="revenue-chart__filters"
          role="group"
          aria-label="Chart period"
        >
          <button
            type="button"
            className={view === "six" ? "is-active" : ""}
            onClick={() => setView("six")}
            aria-pressed={view === "six"}
          >
            Last 6
          </button>

          <button
            type="button"
            className={view === "all" ? "is-active" : ""}
            onClick={() => setView("all")}
            aria-pressed={view === "all"}
          >
            All
          </button>
        </div>
      </div>

      {/* ================= SUMMARY ================= */}

      <div className="revenue-chart__summary">
        <div className="revenue-chart__summary-item">
          <span className="revenue-chart__summary-label">
            <span className="revenue-chart__dot revenue-chart__dot--received" />
            Total Received
          </span>

          <strong>{formatCurrency(totals.received)}</strong>
        </div>

        <div className="revenue-chart__summary-item">
          <span className="revenue-chart__summary-label">
            <span className="revenue-chart__dot revenue-chart__dot--pending" />
            Pending Payments
          </span>

          <strong>{formatCurrency(totals.pending)}</strong>
        </div>
      </div>

      {/* ================= CHART META ================= */}

      <div className="revenue-chart__meta">
        <span>
          <CalendarDays size={14} />
          {view === "six"
            ? "Last 6 records"
            : "All records"}
        </span>

        {isDemo && (
          <span className="revenue-chart__demo-tag">
            Demo
          </span>
        )}
      </div>

      {/* ================= GRAPH ================= */}

      <div className="revenue-chart__graph">
        {chartData.length === 0 ? (
          <div className="revenue-chart__empty">
            <BarChart3 size={30} />
            <strong>No revenue records</strong>
            <span>
              Revenue data will appear here when available.
            </span>
          </div>
        ) : (
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <AreaChart
              data={chartData}
              margin={{
                top: 15,
                right: 10,
                left: -12,
                bottom: 0,
              }}
            >
              <defs>
                <linearGradient
                  id={receivedGradientId}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="#a3e635"
                    stopOpacity={0.25}
                  />

                  <stop
                    offset="95%"
                    stopColor="#a3e635"
                    stopOpacity={0}
                  />
                </linearGradient>

                <linearGradient
                  id={pendingGradientId}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="#f59e0b"
                    stopOpacity={0.14}
                  />

                  <stop
                    offset="95%"
                    stopColor="#f59e0b"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>

              <CartesianGrid
                stroke="#2a2a2e"
                strokeDasharray="4 5"
                vertical={false}
              />

              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tick={{
                  fill: "#a1a1aa",
                  fontSize: 11,
                }}
                tickMargin={12}
              />

              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{
                  fill: "#a1a1aa",
                  fontSize: 11,
                }}
                tickFormatter={formatAxis}
                width={48}
              />

              <Tooltip
                content={<RevenueTooltip />}
                cursor={{
                  stroke: "#52525b",
                  strokeDasharray: "4 4",
                }}
              />

              <Legend
                formatter={(value) =>
                  value === "received"
                    ? "Received"
                    : "Pending"
                }
                wrapperStyle={{
                  fontSize: "12px",
                  paddingTop: "12px",
                }}
              />

              <Area
                type="monotone"
                dataKey="received"
                name="Received"
                stroke="#a3e635"
                strokeWidth={2.5}
                fill={`url(#${receivedGradientId})`}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />

              <Area
                type="monotone"
                dataKey="pending"
                name="Pending"
                stroke="#f59e0b"
                strokeWidth={2}
                fill={`url(#${pendingGradientId})`}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
