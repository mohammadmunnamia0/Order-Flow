import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../services/api.js";
import { toast } from "react-toastify";
import { FiArrowLeft } from "react-icons/fi";

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchOrder(); }, [id]);

  const fetchOrder = async () => {
    try {
      const res = await API.get(`/orders/${id}`);
      setOrder(res.data);
    } catch (err) {
      toast.error("Failed to load order");
      navigate("/orders");
    }
    setLoading(false);
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;
  if (!order) return null;

  const statusSteps = ["Draft", "Confirmed", "Packed", "Shipped", "Delivered"];
  const currentIdx = statusSteps.indexOf(order.status);
  const isCancelled = order.status === "Cancelled";

  return (
    <div>
      <button className="btn btn-outline" onClick={() => navigate("/orders")} style={{ marginBottom: 16 }}>
        <FiArrowLeft /> Back to Orders
      </button>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Order {order.orderNumber}</span>
          <span className={`badge badge-${order.status.toLowerCase()}`}>{order.status}</span>
        </div>
        <div className="card-body">
          {/* Status Timeline */}
          {!isCancelled && (
            <div style={{ display: "flex", gap: 0, marginBottom: 24, overflow: "auto" }}>
              {statusSteps.map((step, i) => (
                <div key={step} style={{
                  flex: 1, textAlign: "center", position: "relative",
                  padding: "12px 8px",
                  background: i <= currentIdx ? "#4f46e5" : "#f3f4f6",
                  color: i <= currentIdx ? "white" : "#6b7280",
                  fontWeight: i === currentIdx ? 700 : 400,
                  fontSize: "0.85rem",
                  borderRadius: i === 0 ? "8px 0 0 8px" : i === statusSteps.length - 1 ? "0 8px 8px 0" : 0,
                }}>
                  {step}
                </div>
              ))}
            </div>
          )}
          {isCancelled && (
            <div className="alert alert-danger" style={{ marginBottom: 16 }}>This order has been cancelled.</div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <h4 style={{ marginBottom: 12 }}>Customer</h4>
              <p><strong>{order.customer?.name}</strong></p>
              <p>{order.customer?.email}</p>
              <p>{order.customer?.phone}</p>
              <p>{order.customer?.address}, {order.customer?.city}</p>
            </div>
            <div>
              <h4 style={{ marginBottom: 12 }}>Order Info</h4>
              <p><strong>Warehouse:</strong> {order.warehouse}</p>
              <p><strong>Created By:</strong> {order.createdBy?.name}</p>
              <p><strong>Created:</strong> {new Date(order.createdAt).toLocaleString()}</p>
              {order.confirmedAt && <p><strong>Confirmed:</strong> {new Date(order.confirmedAt).toLocaleString()}</p>}
              {order.shippedAt && <p><strong>Shipped:</strong> {new Date(order.shippedAt).toLocaleString()}</p>}
              {order.deliveredAt && <p><strong>Delivered:</strong> {new Date(order.deliveredAt).toLocaleString()}</p>}
              {order.trackingNumber && <p><strong>Tracking:</strong> {order.carrierName} — {order.trackingNumber}</p>}
              {order.notes && <p><strong>Notes:</strong> {order.notes}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">Order Items</div>
        <div className="card-body table-container">
          <table>
            <thead>
              <tr><th>SKU</th><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>
            </thead>
            <tbody>
              {order.items.map((item, i) => (
                <tr key={i}>
                  <td><strong>{item.sku}</strong></td>
                  <td>{item.productName}</td>
                  <td>{item.quantity}</td>
                  <td>${item.unitPrice.toFixed(2)}</td>
                  <td><strong>${item.total.toFixed(2)}</strong></td>
                </tr>
              ))}
              <tr style={{ background: "#f9fafb" }}>
                <td colSpan={4} style={{ textAlign: "right", fontWeight: 700 }}>Total Amount</td>
                <td><strong style={{ fontSize: "1.1rem" }}>${order.totalAmount.toFixed(2)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
