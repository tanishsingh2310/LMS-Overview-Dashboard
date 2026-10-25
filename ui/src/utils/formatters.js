
function parseDate(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  // Moodle timestamps are Unix seconds; JavaScript uses milliseconds.
  if (typeof value === "number" ||
      (typeof value === "string" && /^\d+$/.test(value))) {
    const timestamp = Number(value);

    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      return null;
    }

    return new Date(
      timestamp < 1e12 ? timestamp * 1000 : timestamp
    );
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatNumber(value) {
  return new Intl.NumberFormat("en-IN").format(value ?? 0);
}

export function formatDateTime(value) {
  const date = parseDate(value);

  if (!date) return "Never";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDate(value) {
  const date = parseDate(value);

  if (!date) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function getFullName(user) {
  return user?.fullname || user?.name || "Unknown user";
}

