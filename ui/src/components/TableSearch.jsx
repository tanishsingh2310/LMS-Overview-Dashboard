
import { Search } from "lucide-react";
export default function TableSearch({
  value,
  onChange,
  placeholder = "Search records...",
}) {
  return (
    <div className="table-search">
      <label className="table-search__label">
        <Search size={18} aria-hidden="true" />
        <span className="sr-only">Search table</span>
        <input
          type="search"
          className="table-search__input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      </label>

      {value && (
        <button
          type="button"
          className="table-search__clear"
          onClick={() => onChange("")}
          aria-label="Clear search"
        >
          Clear
        </button>
      )}
    </div>
  );
}
