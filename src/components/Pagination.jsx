import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

export default function Pagination({ page, pages, total, onPageChange }) {
  if (!pages || pages <= 1) return null;

  const getVisiblePages = () => {
    const visible = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(pages, page + 2);
    for (let i = start; i <= end; i++) visible.push(i);
    return visible;
  };

  return (
    <div className="pagination">
      <span className="pagination-info">
        Page {page} of {pages} ({total} total)
      </span>
      <div className="pagination-buttons">
        <button
          className="btn btn-sm btn-outline"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <FiChevronLeft />
        </button>
        {getVisiblePages().map((p) => (
          <button
            key={p}
            className={`btn btn-sm ${p === page ? "btn-primary" : "btn-outline"}`}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        ))}
        <button
          className="btn btn-sm btn-outline"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
        >
          <FiChevronRight />
        </button>
      </div>
    </div>
  );
}
