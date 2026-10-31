import { useState, useEffect } from "react";
import API from "../services/api.js";
import { toast } from "react-toastify";
import { FiPlus, FiEdit2, FiTrash2, FiSearch } from "react-icons/fi";
import Pagination from "../components/Pagination.jsx";

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", city: "" });

  const fetchCustomers = async (pg = page) => {
    try {
      const res = await API.get("/customers", { params: { search: search || undefined, page: pg, limit: 20 } });
      setCustomers(res.data.data);
      setPages(res.data.pages);
      setTotal(res.data.total);
      setPage(res.data.page);
    } catch (err) { toast.error("Failed to load customers"); }
    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); fetchCustomers(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { fetchCustomers(); }, [page]);

  const resetForm = () => { setForm({ name: "", email: "", phone: "", address: "", city: "" }); setEditing(null); };

  const openCreate = () => { resetForm(); setShowModal(true); };

  const openEdit = (c) => {
    setEditing(c._id);
    setForm({ name: c.name, email: c.email, phone: c.phone, address: c.address, city: c.city });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await API.put(`/customers/${editing}`, form);
        toast.success("Customer updated");
      } else {
        await API.post("/customers", form);
        toast.success("Customer created");
      }
      setShowModal(false); resetForm(); fetchCustomers();
    } catch (err) { toast.error(err.response?.data?.message || "Failed"); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this customer?")) return;
    try {
      await API.delete(`/customers/${id}`);
      toast.success("Customer deleted");
      fetchCustomers();
    } catch (err) { toast.error(err.response?.data?.message || "Failed to delete"); }
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Customers</h2>
        <button className="btn btn-primary" onClick={openCreate}><FiPlus /> Add Customer</button>
      </div>

      <div className="filters">
        <div className="search-input">
          <FiSearch />
          <input className="form-control" placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card">
        <div className="card-body table-container">
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Phone</th><th>City</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c._id}>
                  <td><strong>{c.name}</strong></td>
                  <td>{c.email}</td>
                  <td>{c.phone}</td>
                  <td>{c.city}</td>
                  <td>
                    <div className="btn-group">
                      <button className="btn btn-sm btn-outline" onClick={() => openEdit(c)}><FiEdit2 /></button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(c._id)}><FiTrash2 /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "#9ca3af", padding: 32 }}>No customers found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pages={pages} total={total} onPageChange={setPage} />
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? "Edit Customer" : "Add Customer"}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Name *</label>
                  <input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" className="form-control" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input className="form-control" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Address</label>
                    <input className="form-control" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>City</label>
                    <input className="form-control" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                  </div>
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">{editing ? "Update" : "Create"}</button>
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
