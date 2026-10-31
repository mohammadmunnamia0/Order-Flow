import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { toast } from "react-toastify";
import {
  FiBox, FiShield, FiTrendingUp, FiTruck, FiEye, FiArrowLeft, FiArrowRight, FiCopy, FiCheck,
} from "react-icons/fi";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "../data/seed.js";

// Presentation for each existing role — credentials come from DEMO_ACCOUNTS
const ROLE_INFO = {
  admin: {
    title: "Admin",
    icon: FiShield,
    color: "#4f46e5",
    description: "Full control: products, users, approvals and data reset.",
  },
  sales: {
    title: "Sales",
    icon: FiTrendingUp,
    color: "#0891b2",
    description: "Manage customers, create and confirm orders.",
  },
  warehouse: {
    title: "Warehouse",
    icon: FiTruck,
    color: "#d97706",
    description: "Stock adjustments, fulfillment and reconciliation.",
  },
  viewer: {
    title: "Viewer",
    icon: FiEye,
    color: "#059669",
    description: "Read-only access to dashboards, stock and orders.",
  },
};

const ROLES = DEMO_ACCOUNTS.map((acc) => ({ ...acc, ...ROLE_INFO[acc.role] }));

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for browsers without the async clipboard API
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    el.remove();
  }
}

function CredentialRow({ label, value }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="credential-row">
      <span className="credential-label">{label}</span>
      <code className="credential-value">{value}</code>
      <button type="button" className="credential-copy" onClick={handleCopy} aria-label={`Copy ${label.toLowerCase()}`}>
        {copied ? <FiCheck /> : <FiCopy />}
      </button>
    </div>
  );
}

export default function Login() {
  const { login, resetData } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const selected = ROLES.find((r) => r.role === searchParams.get("role")) || null;
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  // Always fill the form with the credentials of the selected role
  useEffect(() => {
    if (selected) setForm({ email: selected.email, password: DEMO_PASSWORD });
  }, [selected?.role]);

  const selectRole = (role) => setSearchParams({ role });
  const backToRoles = () => setSearchParams({});

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
      <div className="auth-shell">
        <header className="auth-brand">
          <div className="auth-brand-logo"><FiBox /></div>
          <h1>Order Flow</h1>
          <p>Supply chain, inventory &amp; order management</p>
        </header>

        {!selected ? (
          <section aria-labelledby="role-heading">
            <h2 id="role-heading" className="auth-step-title">Choose your role to sign in</h2>
            <div className="role-grid">
              {ROLES.map((r) => (
                <button
                  key={r.role}
                  type="button"
                  className="role-card"
                  style={{ "--role-color": r.color }}
                  onClick={() => selectRole(r.role)}
                >
                  <span className="role-card-icon"><r.icon /></span>
                  <span className="role-card-text">
                    <span className="role-card-title">{r.title}</span>
                    <span className="role-card-desc">{r.description}</span>
                  </span>
                  <FiArrowRight className="role-card-arrow" aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>
        ) : (
          <div className="auth-card login-card">
            <button type="button" className="auth-back" onClick={backToRoles}>
              <FiArrowLeft /> All roles
            </button>

            <div className="login-role" style={{ "--role-color": selected.color }}>
              <span className="role-card-icon"><selected.icon /></span>
              <div>
                <h2>Sign in as {selected.title}</h2>
                <p>{selected.description}</p>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="login-email">Email</label>
                <input
                  id="login-email"
                  type="email"
                  className="form-control"
                  autoComplete="username"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  type="password"
                  className="form-control"
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Signing in..." : `Sign in as ${selected.title}`}
              </button>
            </form>

            <div className="credentials">
              <p className="credentials-title">Demo credentials · {selected.title}</p>
              <CredentialRow label="Email" value={selected.email} />
              <CredentialRow label="Password" value={DEMO_PASSWORD} />
            </div>
          </div>
        )}

        <footer className="auth-links">
          <span>Don't have an account? <Link to="/register">Register</Link></span>
          <a href="#" onClick={handleReset}>Reset to sample data</a>
        </footer>
      </div>
    </div>
  );
}
