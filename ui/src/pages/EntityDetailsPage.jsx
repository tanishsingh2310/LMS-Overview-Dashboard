import { ArrowLeft } from "lucide-react";

import { getMetricsForEntity } from "../config/metrics";
import MetricCard from "../components/MetricCard";

export default function EntityDetailsPage({
  entity,
  onBack,
  onMetricSelect,
}) {
  const metrics = getMetricsForEntity(entity);

  const heading =
    entity.type === "university"
      ? "GSFC University Overview"
      : `${entity.shortname} Overview`;

  return (
    <main className="school-details-page">
      <button
        type="button"
        className="back-button"
        onClick={onBack}
      >
        <ArrowLeft size={18} aria-hidden="true" />
        Back
      </button>

      <div className="details-heading">
        <div>
          <h1>{heading}</h1>
          <p>{entity.name}</p>
        </div>
      </div>

      <section
        className="metric-overview-grid"
        aria-label={`${entity.shortname} metrics`}
      >
        {metrics.map((metric) => (
          <MetricCard
            key={metric.key}
            metric={metric}
            value={Number(entity[metric.key] ?? 0)}
            onClick={() => onMetricSelect(entity, metric)}
          />
        ))}
      </section>
    </main>
  );
}
