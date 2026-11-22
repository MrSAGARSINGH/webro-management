
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
} from "lucide-react";

import "./StatCard.scss";

const numberFormatter = new Intl.NumberFormat("en-IN");

const formatValue = (value, format, currency) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return value ?? "—";
  }

  if (format === "currency") {
    try {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(value);
    } catch {
      return numberFormatter.format(value);
    }
  }

  if (format === "number") {
    return numberFormatter.format(value);
  }

  if (format === "percent") {
    return `${numberFormatter.format(value)}%`;
  }

  return String(value);
};

export default function StatCard({
  title,
  value,
  icon: Icon,
  format = "number",
  currency = "INR",
  change,
  changeLabel = "vs previous period",
  description,
  variant = "default",
  loading = false,
  onClick,
}) {
  const hasChange =
    typeof change === "number" &&
    Number.isFinite(change);

  const trend = !hasChange
    ? "neutral"
    : change > 0
      ? "up"
      : change < 0
        ? "down"
        : "neutral";

  const TrendIcon =
    trend === "up"
      ? ArrowUpRight
      : trend === "down"
        ? ArrowDownRight
        : Minus;

  const formattedValue = formatValue(
    value,
    format,
    currency
  );

  const className = [
    "stat-card",
    `stat-card--${variant}`,
    onClick && "stat-card--clickable",
    loading && "stat-card--loading",
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      <div className="stat-card__top">
        <div className="stat-card__heading">
          <span className="stat-card__label">
            {title}
          </span>
        </div>

        {Icon && (
          <span
            className="stat-card__icon"
            aria-hidden="true"
          >
            <Icon size={21} strokeWidth={1.8} />
          </span>
        )}
      </div>

      {loading ? (
        <div
          className="stat-card__skeleton"
          aria-hidden="true"
        >
          <span className="stat-card__skeleton-value" />
          <span className="stat-card__skeleton-text" />
        </div>
      ) : (
        <>
          <div className="stat-card__value">
            {formattedValue}
          </div>

          {(hasChange || description) && (
            <div className="stat-card__bottom">
              {hasChange && (
                <div className="stat-card__change-row">
                  <span
                    className={`stat-card__trend stat-card__trend--${trend}`}
                    aria-label={`${Math.abs(change)} percent ${
                      trend === "up"
                        ? "increase"
                        : trend === "down"
                          ? "decrease"
                          : "change"
                    }`}
                  >
                    <TrendIcon
                      size={15}
                      aria-hidden="true"
                    />
                    {Math.abs(change)}%
                  </span>

                  <span className="stat-card__change-label">
                    {changeLabel}
                  </span>
                </div>
              )}

              {description && (
                <span className="stat-card__description">
                  {description}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        disabled={loading}
        aria-busy={loading}
        aria-label={
          loading
            ? `${title}: loading`
            : `${title}: ${formattedValue}`
        }
      >
        {content}
      </button>
    );
  }

  return (
    <article
      className={className}
      aria-busy={loading}
      aria-label={loading ? `${title}: loading` : undefined}
    >
      {content}
    </article>
  );
}
