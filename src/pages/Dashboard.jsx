import { useState, useEffect } from "react";
import API from "../services/api.js";
import { FiShoppingCart, FiClock, FiAlertTriangle, FiCheckCircle, FiTrendingUp, FiPercent } from "react-icons/fi";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await API.get("/dashboard");
      setData(res.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;
  if (!data) return <div className="empty-state"><p>Failed to load dashboard</p></div>;

  const { kpis, statusBreakdown, recentOrders, orderTrend, stockAlerts } = data;

  return (
    <div>
      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon blue"><FiShoppingCart /></div>
          <div className="kpi-info">
            <h3>{kpis.totalOrders}</h3>
            <p>Total Orders</p>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon yellow"><FiClock /></div>
          <div className="kpi-info">
            <h3>{kpis.pendingOrders}</h3>
            <p>Pending Orders</p>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon red"><FiAlertTriangle /></div>
          <div className="kpi-info">
            <h3>{kpis.lowStockItems}</h3>
            <p>Low Stock Items</p>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon green"><FiCheckCircle /></div>
          <div className="kpi-info">
            <h3>{kpis.deliveredOrders}</h3>
            <p>Delivered Orders</p>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon purple"><FiPercent /></div>
          <div className="kpi-info">
            <h3>{kpis.fulfillmentRate}%</h3>
            <p>Fulfillment Rate</p>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon blue"><FiTrendingUp /></div>
          <div className="kpi-info">
            <h3>{kpis.inventoryAccuracy}%</h3>
            <p>Inventory Accuracy</p>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Order Trend Chart */}
        <div className="card">
          <div className="card-header">Order Trend (Last 7 Days)</div>
          <div className="card-body">
            {orderTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={orderTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="_id" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Orders" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state"><p>No orders in last 7 days</p></div>
            )}
          </div>
        </div>

        {/* Stock Alerts */}
        <div className="card">
          <div className="card-header">Stock Alerts</div>
          <div className="card-body" style={{ maxHeight: 320, overflowY: "auto" }}>
            {stockAlerts.length > 0 ? (
              stockAlerts.map((alert, i) => (
                <div key={i} className={`alert ${alert.currentStock === 0 ? "alert-danger" : "alert-warning"}`}>
                  <FiAlertTriangle />
                  <div>
                    <strong>{alert.product}</strong> ({alert.sku})<br />
                    Stock: {alert.currentStock} / Reorder: {alert.reorderLevel}
                  </div>
                </div>
              ))
            ) : (
              <div className="alert alert-success"><FiCheckCircle /> All stock levels healthy</div>
            )}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="card full-width">
          <div className="card-header">Recent Orders</div>
          <div className="card-body table-container">
            <table>
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order._id}>
                    <td><strong>{order.orderNumber}</strong></td>
                    <td>{order.customer?.name || "—"}</td>
                    <td>${order.totalAmount.toFixed(2)}</td>
                    <td><span className={`badge badge-${order.status.toLowerCase()}`}>{order.status}</span></td>
                    <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
                {recentOrders.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: "center", color: "#9ca3af" }}>No orders yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
