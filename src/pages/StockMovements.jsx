import { useState, useEffect } from "react";
import API from "../services/api.js";
import { toast } from "react-toastify";
import { FiSearch } from "react-icons/fi";
import Pagination from "../components/Pagination.jsx";

const typeLabels = {
  INITIAL: "Initial Stock",
  SALE_RESERVE: "Sale Reserve",
  SALE_DEDUCT: "Sale Deduct",
  CANCEL_RESTORE: "Cancel Restore",
  POSITIVE_ADJUSTMENT: "Positive Adj.",
  NEGATIVE_ADJUSTMENT: "Negative Adj.",
  MANUAL_ADD: "Manual Add",
  MANUAL_REMOVE: "Manual Remove",
};

const typeColors = {
  INITIAL: "#3b82f6",
  SALE_RESERVE: "#f59e0b",
  SALE_DEDUCT: "#ef4444",
  CANCEL_RESTORE: "#10b981",
  POSITIVE_ADJUSTMENT: "#10b981",
  NEGATIVE_ADJUSTMENT: "#ef4444",
  MANUAL_ADD: "#3b82f6",
  MANUAL_REMOVE: "#f59e0b",
};

export default function StockMovements() {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchMovements = async (pg = page) => {
    try {
      const res = await API.get("/stock-movements", {
        params: {
          type: typeFilter || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          page: pg,
          limit: 30,
        },
      });
      setMovements(res.data.data);
      setPages(res.data.pages);
      setTotal(res.data.total);
      setPage(res.data.page);
    } catch (err) { toast.error("Failed to load stock movements"); }
    setLoading(false);
  };

  useEffect(() => { setPage(1); fetchMovements(1); }, [typeFilter, startDate, endDate]);
  useEffect(() => { fetchMovements(); }, [page]);

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Stock Movements (Audit Log)</h2>
      </div>

      <div className="filters">
        <select className="form-control" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          {Object.keys(typeLabels).map((t) => <option key={t} value={t}>{typeLabels[t]}</option>)}
        </select>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}>From:</label>
          <input type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <label style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}>To:</label>
          <input type="date" className="form-control" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          {(startDate || endDate) && (
            <button className="btn btn-sm btn-outline" onClick={() => { setStartDate(""); setEndDate(""); }}>Clear</button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-body table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Product</th>
                <th>Type</th>
                <th>Qty</th>
                <th>Warehouse</th>
                <th>Reference</th>
                <th>Reason</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m._id}>
                  <td>{new Date(m.createdAt).toLocaleString()}</td>
                  <td><strong>{m.product?.sku}</strong> — {m.product?.name}</td>
                  <td>
                    <span style={{
                      background: typeColors[m.type] + "20",
                      color: typeColors[m.type],
                      padding: "2px 8px",
                      borderRadius: 12,
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }}>
                      {typeLabels[m.type] || m.type}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600, color: m.quantity > 0 ? "#10b981" : "#ef4444" }}>
                    {m.quantity > 0 ? "+" : ""}{m.quantity}
                  </td>
                  <td>{m.warehouse}</td>
                  <td>{m.reference || "—"}</td>
                  <td style={{ maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.reason || "—"}</td>
                  <td>{m.performedBy?.name || "—"}</td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: "center", color: "#9ca3af", padding: 32 }}>No stock movements</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pages={pages} total={total} onPageChange={setPage} />
      </div>
    </div>
  );
}
