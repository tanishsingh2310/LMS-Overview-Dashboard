export function sortRowsBy(rows, sortKey, direction = "asc", getters = {}) {
  if (!sortKey) return rows;

  const read = getters[sortKey] ?? ((row) => row?.[sortKey]);
  const multiplier = direction === "desc" ? -1 : 1;

  return [...rows].sort((a, b) => {
    const aValue = read(a);
    const bValue = read(b);

    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return 1;
    if (bValue == null) return -1;

    if (typeof aValue === "number" && typeof bValue === "number") {
      return (aValue - bValue) * multiplier;
    }
    if (typeof aValue === "boolean" && typeof bValue === "boolean") {
      return (Number(aValue) - Number(bValue)) * multiplier;
    }

    return String(aValue).localeCompare(String(bValue), undefined, {
      numeric: true,
      sensitivity: "base",
    }) * multiplier;
  });
}
