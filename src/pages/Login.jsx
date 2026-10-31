import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { toast } from "react-toastify";
import { FiBox } from "react-icons/fi";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "../data/seed.js";

export default function Login() {
  const { login, resetData } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success("Welcome back!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Login failed");
    }
    setLoading(false);
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (!window.confirm("Reset ALL data to the default sample data? Every change saved in this browser will be lost.")) return;
    try {
      await resetData();
      toast.success("Data reset to defaults");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reset data");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <FiBox size={40} color="#4f46e5" />
        </div>
        <h1>ORDERFLOW</h1>
        <p className="subtitle">Inventory & Order Management System</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              className="form-control"
              placeholder="Enter your email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="Enter your password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <p className="auth-footer">
          Don't have an account? <Link to="/register">Register</Link>
        </p>

        <div className="alert alert-info" style={{ marginTop: 20, display: "block", fontSize: "0.85rem" }}>
          <strong>Demo accounts</strong> (password: <code>{DEMO_PASSWORD}</code>)
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setForm({ email: acc.email, password: DEMO_PASSWORD })}
              >
                {acc.role}
              </button>
            ))}
          </div>
        </div>
        <p className="auth-footer" style={{ marginTop: 12 }}>
          <a href="#" onClick={handleReset}>Reset to sample data</a>
        </p>
      </div>
    </div>
  );
}
