import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export default function SortableHeader({
  label,
  sortKey,
  activeSortKey,
  direction,
  onSort,
  className = "",
}) {
  const active = activeSortKey === sortKey;
  const Icon = active ? (direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <th scope="col" aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"} className={className}>
      <button
        type="button"
        className={`sortable-header${active ? " sortable-header--active" : ""}`}
        onClick={() => onSort(sortKey)}
        title={`Sort by ${label}${active ? (direction === "asc" ? " descending" : " ascending") : " ascending"}`}
      >
        <span>{label}</span>
        <Icon className="sortable-header__icon" size={14} strokeWidth={2.2} aria-hidden="true" />
      </button>
    </th>
  );
}
