import { useState, useEffect } from "react";
import API from "../services/api.js";
import { toast } from "react-toastify";
import { FiPackage, FiTruck, FiCheckCircle } from "react-icons/fi";
import Pagination from "../components/Pagination.jsx";

export default function Fulfillment() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [shipModal, setShipModal] = useState(null);
  const [shipForm, setShipForm] = useState({ carrierName: "", trackingNumber: "" });

  const fetchOrders = async (pg = page) => {
    try {
      const res = await API.get("/fulfillment", { params: { status: statusFilter || undefined, page: pg, limit: 20 } });
      setOrders(res.data.data);
      setPages(res.data.pages);
      setTotal(res.data.total);
      setPage(res.data.page);
    } catch (err) { toast.error("Failed to load fulfillment orders"); }
    setLoading(false);
  };

  useEffect(() => { setPage(1); fetchOrders(1); }, [statusFilter]);
  useEffect(() => { fetchOrders(); }, [page]);

  const handlePack = async (id) => {
    if (!window.confirm("Pack this order?")) return;
    try {
      await API.put(`/fulfillment/${id}/pack`);
      toast.success("Order packed");
      fetchOrders();
    } catch (err) { toast.error(err.response?.data?.message || "Failed"); }
  };

  const openShip = (order) => {
    setShipModal(order);
    setShipForm({ carrierName: "", trackingNumber: "" });
  };

  const handleShip = async (e) => {
    e.preventDefault();
    try {
      await API.put(`/fulfillment/${shipModal._id}/ship`, shipForm);
      toast.success("Order shipped, stock deducted");
      setShipModal(null);
      fetchOrders();
    } catch (err) { toast.error(err.response?.data?.message || "Failed"); }
  };

  const handleDeliver = async (id) => {
    if (!window.confirm("Confirm delivery of this order?")) return;
    try {
      await API.put(`/fulfillment/${id}/deliver`);
      toast.success("Delivery confirmed");
      fetchOrders();
    } catch (err) { toast.error(err.response?.data?.message || "Failed"); }
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Fulfillment</h2>
      </div>

      <div className="filters">
        <select className="form-control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All (Confirmed/Packed/Shipped)</option>
          <option value="Confirmed">Confirmed</option>
          <option value="Packed">Packed</option>
          <option value="Shipped">Shipped</option>
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o._id}>
                  <td><strong>{o.orderNumber}</strong></td>
                  <td>{o.customer?.name}</td>
                  <td>{o.items?.length}</td>
                  <td>${o.totalAmount.toFixed(2)}</td>
                  <td><span className={`badge badge-${o.status.toLowerCase()}`}>{o.status}</span></td>
                  <td>
                    <div className="btn-group">
                      {o.status === "Confirmed" && (
                        <button className="btn btn-sm btn-warning" onClick={() => handlePack(o._id)}>
                          <FiPackage /> Pack
                        </button>
                      )}
                      {o.status === "Packed" && (
                        <button className="btn btn-sm btn-info" onClick={() => openShip(o)}>
                          <FiTruck /> Ship
                        </button>
                      )}
                      {o.status === "Shipped" && (
                        <button className="btn btn-sm btn-success" onClick={() => handleDeliver(o._id)}>
                          <FiCheckCircle /> Deliver
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: "center", color: "#9ca3af", padding: 32 }}>No orders to fulfill</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pages={pages} total={total} onPageChange={setPage} />
      </div>

      {/* Ship Modal */}
      {shipModal && (
        <div className="modal-overlay" onClick={() => setShipModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Ship Order — {shipModal.orderNumber}</h2>
              <button className="modal-close" onClick={() => setShipModal(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleShip}>
                <div className="form-group">
                  <label>Carrier Name</label>
                  <input className="form-control" value={shipForm.carrierName} onChange={(e) => setShipForm({ ...shipForm, carrierName: e.target.value })} placeholder="e.g. FedEx, UPS, DHL" />
                </div>
                <div className="form-group">
                  <label>Tracking Number</label>
                  <input className="form-control" value={shipForm.trackingNumber} onChange={(e) => setShipForm({ ...shipForm, trackingNumber: e.target.value })} placeholder="Enter tracking number" />
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary"><FiTruck /> Confirm Shipment</button>
                  <button type="button" className="btn btn-outline" onClick={() => setShipModal(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
