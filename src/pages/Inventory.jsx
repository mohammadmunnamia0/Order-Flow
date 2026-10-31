import { useState, useEffect } from "react";
import API from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { toast } from "react-toastify";
import { FiSearch, FiPlus, FiMinus } from "react-icons/fi";
import Pagination from "../components/Pagination.jsx";

export default function Inventory() {
  const { hasRole } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [adjustModal, setAdjustModal] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ quantity: "", type: "MANUAL_ADD", reason: "" });

  const fetchInventory = async (pg = page) => {
    try {
      const res = await API.get("/inventory", { params: { lowStock: lowStockOnly || undefined, page: pg, limit: 20 } });
      setInventory(res.data.data);
      setPages(res.data.pages);
      setTotal(res.data.total);
      setPage(res.data.page);
    } catch (err) { toast.error("Failed to load inventory"); }
    setLoading(false);
  };

  useEffect(() => { setPage(1); fetchInventory(1); }, [lowStockOnly]);
  useEffect(() => { fetchInventory(); }, [page]);

  const getStockClass = (inv) => {
    if (inv.totalStock === 0) return "stock-out";
    if (inv.totalStock <= inv.product?.reorderLevel) return "stock-low";
    return "stock-healthy";
  };

  const getStockLabel = (inv) => {
    if (inv.totalStock === 0) return "Out of Stock";
    if (inv.totalStock <= inv.product?.reorderLevel) return "Low Stock";
    return "Healthy";
  };

  const openAdjust = (inv) => {
    setAdjustModal(inv);
    setAdjustForm({ quantity: "", type: "MANUAL_ADD", reason: "" });
  };

  const handleAdjust = async (e) => {
    e.preventDefault();
    try {
      await API.put(`/inventory/${adjustModal._id}/adjust`, adjustForm);
      toast.success("Stock adjusted");
      setAdjustModal(null);
      fetchInventory();
    } catch (err) { toast.error(err.response?.data?.message || "Adjustment failed"); }
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Inventory</h2>
      </div>

      <div className="filters">
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
          Show Low Stock Only
        </label>
      </div>

      <div className="card">
        <div className="card-body table-container">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th>Warehouse</th>
                <th>Total Stock</th>
                <th>Reserved</th>
                <th>Available</th>
                <th>Status</th>
                {hasRole("admin", "warehouse") && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {inventory.map((inv) => (
                <tr key={inv._id}>
                  <td><strong>{inv.product?.sku}</strong></td>
                  <td>{inv.product?.name}</td>
                  <td>{inv.warehouse}</td>
                  <td>{inv.totalStock}</td>
                  <td>{inv.reservedStock}</td>
                  <td><strong>{inv.availableStock}</strong></td>
                  <td><span className={getStockClass(inv)}>{getStockLabel(inv)}</span></td>
                  {hasRole("admin", "warehouse") && (
                    <td>
                      <button className="btn btn-sm btn-outline" onClick={() => openAdjust(inv)}>Adjust</button>
                    </td>
                  )}
                </tr>
              ))}
              {inventory.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: "center", color: "#9ca3af", padding: 32 }}>No inventory records</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pages={pages} total={total} onPageChange={setPage} />
      </div>

      {/* Adjust Modal */}
      {adjustModal && (
        <div className="modal-overlay" onClick={() => setAdjustModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Adjust Stock — {adjustModal.product?.name}</h2>
              <button className="modal-close" onClick={() => setAdjustModal(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 16, color: "#6b7280" }}>
                Current Stock: <strong>{adjustModal.totalStock}</strong> | Reserved: <strong>{adjustModal.reservedStock}</strong> | Available: <strong>{adjustModal.availableStock}</strong>
              </p>
              <form onSubmit={handleAdjust}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Adjustment Type</label>
                    <select className="form-control" value={adjustForm.type} onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value })}>
                      <option value="MANUAL_ADD">Add Stock</option>
                      <option value="MANUAL_REMOVE">Remove Stock</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Quantity</label>
                    <input type="number" min="1" className="form-control" value={adjustForm.quantity} onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })} required />
                  </div>
                </div>
                <div className="form-group">
                  <label>Reason</label>
                  <input className="form-control" value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} placeholder="Reason for adjustment" />
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">Apply Adjustment</button>
                  <button type="button" className="btn btn-outline" onClick={() => setAdjustModal(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
