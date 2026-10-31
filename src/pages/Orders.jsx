import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { toast } from "react-toastify";
import { FiPlus, FiSearch, FiEye, FiCheck, FiX, FiDownload } from "react-icons/fi";
import Pagination from "../components/Pagination.jsx";

export default function Orders() {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ customer: "", warehouse: "Main Warehouse", notes: "" });
  const [orderItems, setOrderItems] = useState([{ product: "", quantity: 1 }]);

  const fetchOrders = async (pg = page) => {
    try {
      const res = await API.get("/orders", { params: { status: statusFilter || undefined, search: search || undefined, page: pg, limit: 20 } });
      setOrders(res.data.data);
      setPages(res.data.pages);
      setTotal(res.data.total);
      setPage(res.data.page);
    } catch (err) { toast.error("Failed to load orders"); }
    setLoading(false);
  };

  useEffect(() => { setPage(1); fetchOrders(1); }, [statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); fetchOrders(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { fetchOrders(); }, [page]);

  const openCreate = async () => {
    try {
      const [custRes, prodRes] = await Promise.all([
        API.get("/customers", { params: { limit: 100 } }),
        API.get("/products", { params: { limit: 100 } }),
      ]);
      setCustomers(custRes.data.data);
      setProducts(prodRes.data.data);
      setForm({ customer: "", warehouse: "Main Warehouse", notes: "" });
      setOrderItems([{ product: "", quantity: 1 }]);
      setShowModal(true);
    } catch (err) { toast.error("Failed to load data"); }
  };

  const addItem = () => setOrderItems([...orderItems, { product: "", quantity: 1 }]);

  const removeItem = (i) => {
    if (orderItems.length === 1) return;
    setOrderItems(orderItems.filter((_, idx) => idx !== i));
  };

  const updateItem = (i, field, value) => {
    const items = [...orderItems];
    items[i][field] = value;
    setOrderItems(items);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const items = orderItems.map((item) => {
        const prod = products.find((p) => p._id === item.product);
        return {
          product: prod._id,
          productName: prod.name,
          sku: prod.sku,
          quantity: Number(item.quantity),
          unitPrice: prod.unitPrice,
        };
      });
      await API.post("/orders", { ...form, items });
      toast.success("Order created as Draft");
      setShowModal(false);
      fetchOrders();
    } catch (err) { toast.error(err.response?.data?.message || "Failed to create order"); }
  };

  const handleConfirm = async (id) => {
    try {
      await API.put(`/orders/${id}/confirm`);
      toast.success("Order confirmed, stock reserved");
      fetchOrders();
    } catch (err) { toast.error(err.response?.data?.message || "Failed to confirm"); }
  };

  const handleCancel = async (id) => {
    if (!window.confirm("Cancel this order?")) return;
    try {
      await API.put(`/orders/${id}/cancel`);
      toast.success("Order cancelled");
      fetchOrders();
    } catch (err) { toast.error(err.response?.data?.message || "Failed to cancel"); }
  };

  const handleExport = async () => {
    try {
      const res = await API.get("/orders/export/csv", { params: { status: statusFilter || undefined } });
      const url = URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `orders-${Date.now()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) { toast.error(err.response?.data?.message || "Failed to export orders"); }
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Orders</h2>
        <div className="btn-group">
          {hasRole("admin") && (
            <button className="btn btn-outline" onClick={handleExport}><FiDownload /> Export CSV</button>
          )}
          {hasRole("admin", "sales") && (
            <button className="btn btn-primary" onClick={openCreate}><FiPlus /> Create Order</button>
          )}
        </div>
      </div>

      <div className="filters">
        <div className="search-input">
          <FiSearch />
          <input className="form-control" placeholder="Search by Order ID..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="form-control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="Draft">Draft</option>
          <option value="Confirmed">Confirmed</option>
          <option value="Packed">Packed</option>
          <option value="Shipped">Shipped</option>
          <option value="Delivered">Delivered</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      <div className="card">
        <div className="card-body table-container">
          <table>
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o._id}>
                  <td><strong>{o.orderNumber}</strong></td>
                  <td>{o.customer?.name || "—"}</td>
                  <td>{o.items?.length || 0}</td>
                  <td>${o.totalAmount.toFixed(2)}</td>
                  <td><span className={`badge badge-${o.status.toLowerCase()}`}>{o.status}</span></td>
                  <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="btn-group">
                      <button className="btn btn-sm btn-info" onClick={() => navigate(`/orders/${o._id}`)}><FiEye /></button>
                      {o.status === "Draft" && hasRole("admin", "sales") && (
                        <button className="btn btn-sm btn-success" onClick={() => handleConfirm(o._id)}><FiCheck /></button>
                      )}
                      {["Draft", "Confirmed"].includes(o.status) && hasRole("admin", "sales") && (
                        <button className="btn btn-sm btn-danger" onClick={() => handleCancel(o._id)}><FiX /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: "center", color: "#9ca3af", padding: 32 }}>No orders found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pages={pages} total={total} onPageChange={setPage} />
      </div>

      {/* Create Order Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Order</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Customer *</label>
                    <select className="form-control" value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} required>
                      <option value="">Select Customer</option>
                      {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Warehouse</label>
                    <input className="form-control" value={form.warehouse} onChange={(e) => setForm({ ...form, warehouse: e.target.value })} />
                  </div>
                </div>

                <h4 style={{ marginBottom: 12 }}>Order Items</h4>
                {orderItems.map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-end" }}>
                    <div style={{ flex: 2 }}>
                      <label style={{ fontSize: "0.8rem" }}>Product</label>
                      <select className="form-control" value={item.product} onChange={(e) => updateItem(i, "product", e.target.value)} required>
                        <option value="">Select</option>
                        {products.map((p) => <option key={p._id} value={p._id}>{p.name} ({p.sku}) — ${p.unitPrice}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: "0.8rem" }}>Qty</label>
                      <input type="number" min="1" className="form-control" value={item.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} required />
                    </div>
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => removeItem(i)} disabled={orderItems.length === 1}>✕</button>
                  </div>
                ))}
                <button type="button" className="btn btn-sm btn-outline" onClick={addItem} style={{ marginBottom: 16 }}><FiPlus /> Add Item</button>

                {/* Order Total Preview */}
                <div style={{ padding: "12px 16px", background: "#f9fafb", borderRadius: 8, marginBottom: 16, fontWeight: 600 }}>
                  Order Total: ${
                    orderItems.reduce((sum, item) => {
                      const prod = products.find((p) => p._id === item.product);
                      return sum + (prod ? prod.unitPrice * Number(item.quantity || 0) : 0);
                    }, 0).toFixed(2)
                  }
                </div>

                <div className="form-group">
                  <label>Notes</label>
                  <textarea className="form-control" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">Create Draft Order</button>
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
