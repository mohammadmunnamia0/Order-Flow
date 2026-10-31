import { ref, userRef, newestFirst, paginate } from "./utils.js";

// Parses "YYYY-MM-DD" as a local date (falls back to Date parsing for other formats)
function parseDate(value, endOfDay) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) date.setHours(23, 59, 59, 999);
  return date;
}

// GET /stock-movements
export function list({ db, query }) {
  const { product, warehouse, type, startDate, endDate } = query;
  const start = startDate ? parseDate(startDate, false) : null;
  const end = endDate ? parseDate(endDate, true) : null;

  const items = db.stockMovements.filter((m) => {
    if (product && m.product !== product) return false;
    if (warehouse && m.warehouse !== warehouse) return false;
    if (type && m.type !== type) return false;
    const at = new Date(m.createdAt);
    if (start && at < start) return false;
    if (end && at > end) return false;
    return true;
  });

  return paginate(newestFirst(items), query, (m) => ({
    ...m,
    product: ref(db.products, m.product, ["name", "sku"]),
    performedBy: userRef(db, m.performedBy),
  }));
}
