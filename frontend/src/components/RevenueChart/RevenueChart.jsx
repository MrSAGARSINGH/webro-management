
import { useEffect, useId, useMemo, useState } from "react";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

import {
  TrendingUp,
  CalendarDays,
  BarChart3,
  AlertCircle,
} from "lucide-react";

import "./RevenueChart.scss";

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api"
).replace(/\/+$/, "");

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

const formatMonth = (month) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return month;
  }

  const [year, monthNumber] = month.split("-").map(Number);

  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
};

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
            <span className="revenue-chart__dot revenue-chart__dot--received" />
            Received
          </span>

          <strong>
            {formatCurrency(entry.value ?? 0)}
          </strong>
        </div>
      ))}
    </div>
  );
}

export default function RevenueChart() {
  const [revenueData, setRevenueData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  const uniqueId = useId().replace(/:/g, "");
  const receivedGradientId = `webro-received-${uniqueId}`;

  useEffect(() => {
    const controller = new AbortController();

    const fetchRevenue = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `${API_URL}/dashboard/revenue`,
          {
            method: "GET",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
            signal: controller.signal,
          }
        );

        if (response.status === 401) {
          throw new Error(
            "Session expired. Please sign in again."
          );
        }

        if (response.status === 403) {
          throw new Error(
            "You do not have permission to view revenue analytics."
          );
        }

        if (!response.ok) {
          throw new Error(
            `Revenue API failed (${response.status})`
          );
        }

        const result = await response.json();

        if (
          result?.success !== true ||
          !Array.isArray(result?.data?.monthlyRevenue)
        ) {
          throw new Error("Invalid revenue API response");
        }

        const normalized = result.data.monthlyRevenue.map(
          (item) => {
            if (
              typeof item?.month !== "string" ||
              typeof item?.total !== "number" ||
              !Number.isFinite(item.total) ||
              item.total < 0
            ) {
              throw new Error(
                "Invalid monthly revenue record"
              );
            }

            return {
              month: formatMonth(item.month),
              received: item.total,
            };
          }
        );

        if (!controller.signal.aborted) {
          setRevenueData(normalized);
        }
      } catch (err) {
        if (controller.signal.aborted) return;

        setRevenueData([]);
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load revenue analytics"
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchRevenue();

    return () => controller.abort();
  }, [retryKey]);

  const totalReceived = useMemo(
    () =>
      revenueData.reduce(
        (sum, item) => sum + item.received,
        0
      ),
    [revenueData]
  );

  const hasRevenue = revenueData.some(
    (item) => item.received > 0
  );

  return (
    <section
      className="revenue-chart"
      aria-label="Revenue overview"
    >
      {/* HEADER */}

      <div className="revenue-chart__header">
        <div className="revenue-chart__heading">
          <div className="revenue-chart__title">
            <span className="revenue-chart__title-icon">
              <TrendingUp size={19} />
            </span>

            <h2>Revenue Overview</h2>
          </div>

          <p>
            Received client payments · Live data
          </p>
        </div>

        <div
          className="revenue-chart__filters"
          role="group"
          aria-label="Chart period"
        >
          <span className="is-active">
            Last 6 Months
          </span>
        </div>
      </div>

      {/* SUMMARY */}

      <div className="revenue-chart__summary">
        <div className="revenue-chart__summary-item">
          <span className="revenue-chart__summary-label">
            <span className="revenue-chart__dot revenue-chart__dot--received" />
            Total Received
          </span>

          <strong>
            {loading
              ? "Loading..."
              : error
                ? "Unavailable"
                : formatCurrency(totalReceived)}
          </strong>
        </div>
      </div>

      {/* META */}

      <div className="revenue-chart__meta">
        <span>
          <CalendarDays size={14} />
          Last 6 months · INR
        </span>
      </div>

      {/* GRAPH */}

      <div className="revenue-chart__graph">
        {loading ? (
          <div
            className="revenue-chart__empty"
            role="status"
          >
            <BarChart3 size={30} />
            <strong>Loading revenue analytics...</strong>
          </div>
        ) : error ? (
          <div
            className="revenue-chart__empty"
            role="alert"
          >
            <AlertCircle size={30} />
            <strong>Unable to load revenue</strong>
            <span>{error}</span>

            <button
              type="button"
              onClick={() =>
                setRetryKey((value) => value + 1)
              }
            >
              Retry
            </button>
          </div>
        ) : revenueData.length === 0 ? (
          <div className="revenue-chart__empty">
            <BarChart3 size={30} />
            <strong>No revenue records</strong>
            <span>
              Monthly revenue data is not available.
            </span>
          </div>
        ) : !hasRevenue ? (
          <div className="revenue-chart__empty">
            <BarChart3 size={30} />
            <strong>No payments received yet</strong>
            <span>
              All reported months have zero revenue.
              The chart will appear when payments
              are recorded.
            </span>
          </div>
        ) : (
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <AreaChart
              data={revenueData}
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
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
