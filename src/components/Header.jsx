import { useAuth } from "../context/AuthContext.jsx";
import { useLocation } from "react-router-dom";
import { FiMenu, FiRotateCcw, FiLogOut } from "react-icons/fi";
import { toast } from "react-toastify";

const pageTitles = {
  "/": "Dashboard",
  "/products": "Products",
  "/inventory": "Inventory",
  "/customers": "Customers",
  "/orders": "Orders",
  "/fulfillment": "Fulfillment",
  "/reconciliation": "Stock Reconciliation",
  "/stock-movements": "Stock Movements",
  "/users": "User Management",
};

export default function Header({ onToggleSidebar }) {
  const { user, logout, resetData, hasRole } = useAuth();
  const location = useLocation();

  const handleReset = async () => {
    if (!window.confirm("Reset ALL data to the default sample data? Every change saved in this browser will be lost and you will be signed out.")) return;
    try {
      await resetData();
      toast.success("Data reset to defaults");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reset data");
    }
  };

  const getTitle = () => {
    if (location.pathname.startsWith("/orders/")) return "Order Details";
    return pageTitles[location.pathname] || "ORDERFLOW";
  };

  return (
    <header className="header">
      <div className="header-left">
        <button className="sidebar-toggle" onClick={onToggleSidebar}>
          <FiMenu size={20} />
        </button>
        <h1 className="header-title">{getTitle()}</h1>
      </div>
      <div className="header-right">
        <div className="header-user">
          <span className="user-name">{user?.name}</span>
          <span className="role-badge">{user?.role}</span>
        </div>
        {hasRole("admin") && (
          <button className="btn-logout" onClick={handleReset} title="Reset data to defaults" aria-label="Reset data to defaults">
            <FiRotateCcw style={{ verticalAlign: "-2px" }} />
            <span className="btn-label" style={{ marginLeft: 4 }}>Reset Data</span>
          </button>
        )}
        <button className="btn-logout" onClick={logout} title="Logout" aria-label="Logout">
          <FiLogOut style={{ verticalAlign: "-2px" }} />
          <span className="btn-label" style={{ marginLeft: 4 }}>Logout</span>
        </button>
      </div>
    </header>
  );
}
