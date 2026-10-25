
export default function Pagination({
  currentPage,
  totalPages,
  totalRows,
  pageSize,
  onPageChange,
}) {
  if (totalRows === 0) {
    return (
      <div className="pagination__summary">
        No records found
      </div>
    );
  }

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalRows);

  return (
    <nav className="pagination" aria-label="Table pagination">
      <span className="pagination__summary">
        Showing {start}–{end} of {totalRows}
      </span>

      <div className="pagination__controls">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          Previous
        </button>

        <span>
          Page {currentPage} of {totalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
