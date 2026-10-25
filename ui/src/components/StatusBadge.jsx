
export default function StatusBadge({ online = false }) {
  return (
    <span
      className={`status-badge ${
        online ? "status-badge--online" : "status-badge--offline"
      }`}
      aria-label={online ? "Online" : "Offline"}
    >
      <span className="status-badge__dot" aria-hidden="true" />
      {online ? "Online" : "Offline"}
    </span>
  );
}
