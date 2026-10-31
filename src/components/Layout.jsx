import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import Header from "./Header.jsx";

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="app-layout">
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      {sidebarOpen && <div className="sidebar-overlay active" onClick={closeSidebar} />}
      <div className="main-content">
        <Header onToggleSidebar={toggleSidebar} />
        <div className="page-container">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
