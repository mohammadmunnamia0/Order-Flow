import { useState, useEffect } from "react";
import API from "../services/api.js";
import { toast } from "react-toastify";
import { FiEdit2, FiTrash2, FiSearch } from "react-icons/fi";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", role: "", isActive: true });

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      const res = await API.get("/users");
      setUsers(res.data.data || res.data);
    } catch (err) { toast.error("Failed to load users"); }
    setLoading(false);
  };

  const openEdit = (u) => {
    setEditModal(u._id);
    setForm({ name: u.name, email: u.email, role: u.role, isActive: u.isActive });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await API.put(`/users/${editModal}`, form);
      toast.success("User updated");
      setEditModal(null);
      fetchUsers();
    } catch (err) { toast.error(err.response?.data?.message || "Failed"); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this user?")) return;
    try {
      await API.delete(`/users/${id}`);
      toast.success("User deleted");
      fetchUsers();
    } catch (err) { toast.error(err.response?.data?.message || "Failed to delete"); }
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">User Management</h2>
      </div>

      <div className="card">
        <div className="card-body table-container">
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id}>
                  <td><strong>{u.name}</strong></td>
                  <td>{u.email}</td>
                  <td><span className="badge" style={{ background: "#818cf820", color: "#4f46e5" }}>{u.role}</span></td>
                  <td><span className={`badge ${u.isActive ? "badge-approved" : "badge-cancelled"}`}>{u.isActive ? "Active" : "Inactive"}</span></td>
                  <td>
                    <div className="btn-group">
                      <button className="btn btn-sm btn-outline" onClick={() => openEdit(u)}><FiEdit2 /></button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(u._id)}><FiTrash2 /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit User</h2>
              <button className="modal-close" onClick={() => setEditModal(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Name</label>
                  <input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" className="form-control" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Role</label>
                    <select className="form-control" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                      <option value="admin">Admin</option>
                      <option value="sales">Sales</option>
                      <option value="warehouse">Warehouse</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select className="form-control" value={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.value === "true" })}>
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">Update User</button>
                  <button type="button" className="btn btn-outline" onClick={() => setEditModal(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
