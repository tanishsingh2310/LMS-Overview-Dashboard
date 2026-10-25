
export default function MetricCard({
  metric,
  value,
  onClick,
}) {
  const Icon = metric.icon;
  const displayedValue = metric.key === "courses"
    ? (value ?? 0)
    : metric.key === "activeCourses"
      ? (value ?? 0)
      : (value ?? 0);

  return (
    <button
      type="button"
      className="metric-card metric-card--clickable"
      onClick={onClick}
      aria-label={`View ${metric.label} details`}
    >
      <div className="metric-card__top">
        <span className="metric-card__label">
          {metric.label}
        </span>

        {Icon && (
          <span className="metric-card__icon" aria-hidden="true">
            <Icon size={22} />
          </span>
        )}
      </div>

      <div className="metric-card__value">
        {Number(displayedValue).toLocaleString("en-IN")}
      </div>

    </button>
  );
}