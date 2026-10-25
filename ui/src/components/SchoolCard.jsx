
import {
  Monitor,
  FlaskConical,
  Atom,
  Sprout,
  BriefcaseBusiness,
  Landmark,
  ChevronRight,
} from "lucide-react";

import { getMetricsForEntity } from "../config/metrics";

const iconMap = {
  university: Landmark,
  monitor: Monitor,
  flask: FlaskConical,
  atom: Atom,
  leaf: Sprout,
  briefcase: BriefcaseBusiness,
};

export default function SchoolCard({ entity, onSelect }) {
  const Icon = iconMap[entity.icon] ?? Landmark;
  const metrics = getMetricsForEntity(entity);

  return (
    <article className="school-card">
      <div className="school-card-header">
        <div
          className={`school-icon school-${entity.icon}`}
          aria-hidden="true"
        >
          <Icon size={25} strokeWidth={1.8} />
        </div>
      </div>

      <h2>{entity.shortname}</h2>
      <p className="school-name">{entity.name}</p>

      <div className="school-metrics">
        {metrics.map((metric) => {
          const MetricIcon = metric.icon;
          const value = metric.key === "courses"
            ? (entity.courses ?? entity.totalCourses ?? 0)
            : metric.key === "activeCourses"
              ? (entity.activeCourses ?? entity.activecourses ?? 0)
              : (entity[metric.key] ?? 0);

          return (
            <div className="school-metric" key={metric.key}>
              <span className="metric-icon" aria-hidden="true">
                <MetricIcon size={17} />
              </span>

              <div className="metric-content">
                <span className="metric-label">
                  {metric.label}
                </span>

                <strong className="metric-value">
                  {Number(value).toLocaleString("en-IN")}
                </strong>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        className="school-action"
        onClick={() => onSelect(entity)}
        aria-label={`View details for ${entity.shortname}`}
      >
        View details
        <ChevronRight size={17} aria-hidden="true" />
      </button>
    </article>
  );
}
