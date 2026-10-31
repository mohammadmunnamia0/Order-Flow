import { useState, useEffect } from "react";
import API from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { toast } from "react-toastify";
import { FiPlus, FiCheck, FiX } from "react-icons/fi";

export default function Reconciliation() {
  const { hasRole } = useAuth();
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [inventory, setInventory] = useState([]);
  const [form, setForm] = useState({ warehouse: "Main Warehouse", notes: "" });
  const [items, setItems] = useState([]);

  useEffect(() => { fetchRecs(); }, []);

  const fetchRecs = async () => {
    try {
      const res = await API.get("/reconciliation");
      setRecs(res.data.data || res.data);
    } catch (err) { toast.error("Failed to load reconciliations"); }
    setLoading(false);
  };

  const openCreate = async () => {
    try {
      const res = await API.get("/inventory", { params: { limit: 100 } });
      const invData = res.data.data || res.data;
      setInventory(invData);
      setItems(
        invData.map((inv) => ({
          product: inv.product._id,
          productName: inv.product.name,
          sku: inv.product.sku,
          systemStock: inv.totalStock,
          physicalStock: inv.totalStock,
        }))
      );
      setForm({ warehouse: "Main Warehouse", notes: "" });
      setShowModal(true);
    } catch (err) { toast.error("Failed to load inventory"); }
  };

  const updatePhysical = (i, value) => {
    const newItems = [...items];
    newItems[i].physicalStock = Number(value);
    setItems(newItems);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitItems = items.map((it) => ({
        product: it.product,
        physicalStock: it.physicalStock,
      }));
      await API.post("/reconciliation", { ...form, items: submitItems });
      toast.success("Reconciliation submitted for approval");
      setShowModal(false);
      fetchRecs();
    } catch (err) { toast.error(err.response?.data?.message || "Failed"); }
  };

  const handleApprove = async (id) => {
    if (!window.confirm("Approve this reconciliation? Stock levels will be adjusted.")) return;
    try {
      await API.put(`/reconciliation/${id}/approve`);
      toast.success("Reconciliation approved, stock adjusted");
      fetchRecs();
    } catch (err) { toast.error(err.response?.data?.message || "Failed"); }
  };

  const handleReject = async (id) => {
    try {
      await API.put(`/reconciliation/${id}/reject`);
      toast.success("Reconciliation rejected");
      fetchRecs();
    } catch (err) { toast.error(err.response?.data?.message || "Failed"); }
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Stock Reconciliation</h2>
        {hasRole("admin", "warehouse") && (
          <button className="btn btn-primary" onClick={openCreate}><FiPlus /> New Reconciliation</button>
        )}
      </div>

      {recs.map((rec) => (
        <div key={rec._id} className="card" style={{ marginBottom: 16 }}>
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>
              {rec.warehouse} — {new Date(rec.createdAt).toLocaleDateString()} — by {rec.conductedBy?.name}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className={`badge badge-${rec.status.toLowerCase()}`}>{rec.status}</span>
              {rec.status === "Pending" && hasRole("admin") && (
                <>
                  <button className="btn btn-sm btn-success" onClick={() => handleApprove(rec._id)}><FiCheck /> Approve</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleReject(rec._id)}><FiX /> Reject</button>
                </>
              )}
            </div>
          </div>
          <div className="card-body table-container">
            <table>
              <thead>
                <tr><th>SKU</th><th>Product</th><th>System Stock</th><th>Physical Stock</th><th>Variance</th></tr>
              </thead>
              <tbody>
                {rec.items.map((item, i) => (
                  <tr key={i}>
                    <td>{item.product?.sku}</td>
                    <td>{item.product?.name}</td>
                    <td>{item.systemStock}</td>
                    <td>{item.physicalStock}</td>
                    <td style={{ color: item.variance > 0 ? "#10b981" : item.variance < 0 ? "#ef4444" : "#6b7280", fontWeight: 600 }}>
                      {item.variance > 0 ? "+" : ""}{item.variance}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rec.notes && <p style={{ marginTop: 8, color: "#6b7280", fontSize: "0.85rem" }}>Notes: {rec.notes}</p>}
          </div>
        </div>
      ))}

      {recs.length === 0 && <div className="empty-state"><p>No reconciliation records</p></div>}

      {/* Create Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 750 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Stock Reconciliation</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Warehouse</label>
                  <input className="form-control" value={form.warehouse} onChange={(e) => setForm({ ...form, warehouse: e.target.value })} />
                </div>

                <h4 style={{ margin: "16px 0 8px" }}>Enter Physical Count</h4>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr><th>SKU</th><th>Product</th><th>System Stock</th><th>Physical Count</th><th>Variance</th></tr>
                    </thead>
                    <tbody>
                      {items.map((item, i) => (
                        <tr key={i}>
                          <td>{item.sku}</td>
                          <td>{item.productName}</td>
                          <td>{item.systemStock}</td>
                          <td>
                            <input type="number" min="0" className="form-control" style={{ width: 100 }} value={item.physicalStock} onChange={(e) => updatePhysical(i, e.target.value)} />
                          </td>
                          <td style={{ color: item.physicalStock - item.systemStock > 0 ? "#10b981" : item.physicalStock - item.systemStock < 0 ? "#ef4444" : "#6b7280", fontWeight: 600 }}>
                            {item.physicalStock - item.systemStock > 0 ? "+" : ""}{item.physicalStock - item.systemStock}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="form-group" style={{ marginTop: 16 }}>
                  <label>Notes</label>
                  <textarea className="form-control" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">Submit for Approval</button>
                  <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
