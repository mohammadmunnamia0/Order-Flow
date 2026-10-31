import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import {
  FiHome, FiPackage, FiDatabase, FiShoppingCart,
  FiUsers, FiTruck, FiClipboard, FiActivity,
  FiUserCheck, FiBox
} from "react-icons/fi";

const navItems = [
  { path: "/", icon: FiHome, label: "Dashboard", roles: ["admin", "sales", "warehouse", "viewer"] },
  { path: "/products", icon: FiPackage, label: "Products", roles: ["admin", "sales", "warehouse", "viewer"] },
  { path: "/inventory", icon: FiDatabase, label: "Inventory", roles: ["admin", "sales", "warehouse", "viewer"] },
  { path: "/customers", icon: FiUsers, label: "Customers", roles: ["admin", "sales"] },
  { path: "/orders", icon: FiShoppingCart, label: "Orders", roles: ["admin", "sales", "warehouse", "viewer"] },
  { path: "/fulfillment", icon: FiTruck, label: "Fulfillment", roles: ["admin", "warehouse"] },
  { path: "/reconciliation", icon: FiClipboard, label: "Reconciliation", roles: ["admin", "warehouse"] },
  { path: "/stock-movements", icon: FiActivity, label: "Stock Movements", roles: ["admin", "warehouse", "viewer"] },
  { path: "/users", icon: FiUserCheck, label: "User Management", roles: ["admin"] },
];

export default function Sidebar({ isOpen, onClose }) {
  const { user } = useAuth();
  const location = useLocation();

  const filteredItems = navItems.filter((item) => item.roles.includes(user?.role));

  return (
    <aside className={`sidebar${isOpen ? " sidebar-open" : ""}`}>
      <div className="sidebar-brand">
        <FiBox size={24} />
        <span>ORDER</span>FLOW
      </div>
      <nav className="sidebar-nav">
        {filteredItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
            onClick={onClose}
          >
            <item.icon />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        Order Flow v1.0 &copy; 2026
      </div>
    </aside>
  );
}
