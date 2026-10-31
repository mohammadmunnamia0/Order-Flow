import { useState, useEffect } from "react";
import API from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { toast } from "react-toastify";
import { FiPlus, FiEdit2, FiArchive, FiSearch } from "react-icons/fi";
import Pagination from "../components/Pagination.jsx";

export default function Products() {
  const { hasRole } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "", sku: "", category: "", unitPrice: "", reorderLevel: "", description: "", initialStock: "", warehouse: "Main Warehouse",
  });

  const fetchProducts = async (pg = page) => {
    try {
      const res = await API.get("/products", { params: { search: search || undefined, page: pg, limit: 20 } });
      setProducts(res.data.data);
      setPages(res.data.pages);
      setTotal(res.data.total);
      setPage(res.data.page);
    } catch (err) { toast.error("Failed to load products"); }
    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); fetchProducts(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { fetchProducts(); }, [page]);

  const resetForm = () => {
    setForm({ name: "", sku: "", category: "", unitPrice: "", reorderLevel: "", description: "", initialStock: "", warehouse: "Main Warehouse" });
    setEditing(null);
  };

  const openCreate = () => { resetForm(); setShowModal(true); };

  const openEdit = (p) => {
    setEditing(p._id);
    setForm({ name: p.name, sku: p.sku, category: p.category, unitPrice: p.unitPrice, reorderLevel: p.reorderLevel, description: p.description || "", initialStock: "", warehouse: "Main Warehouse" });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await API.put(`/products/${editing}`, form);
        toast.success("Product updated");
      } else {
        await API.post("/products", form);
        toast.success("Product created");
      }
      setShowModal(false);
      resetForm();
      fetchProducts();
    } catch (err) { toast.error(err.response?.data?.message || "Failed to save product"); }
  };

  const handleArchive = async (id) => {
    if (!window.confirm("Archive this product?")) return;
    try {
      await API.put(`/products/${id}/archive`);
      toast.success("Product archived");
      fetchProducts();
    } catch (err) { toast.error(err.response?.data?.message || "Failed to archive"); }
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Products</h2>
        {hasRole("admin") && (
          <button className="btn btn-primary" onClick={openCreate}><FiPlus /> Add Product</button>
        )}
      </div>

      <div className="filters">
        <div className="search-input">
          <FiSearch />
          <input type="text" className="form-control" placeholder="Search by name or SKU..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card">
        <div className="card-body table-container">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th>Category</th>
                <th>Unit Price</th>
                <th>Reorder Level</th>
                {hasRole("admin") && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p._id}>
                  <td><strong>{p.sku}</strong></td>
                  <td>{p.name}</td>
                  <td>{p.category}</td>
                  <td>${p.unitPrice.toFixed(2)}</td>
                  <td>{p.reorderLevel}</td>
                  {hasRole("admin") && (
                    <td>
                      <div className="btn-group">
                        <button className="btn btn-sm btn-outline" onClick={() => openEdit(p)}><FiEdit2 /></button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleArchive(p._id)}><FiArchive /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {products.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: "center", color: "#9ca3af", padding: 32 }}>No products found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pages={pages} total={total} onPageChange={setPage} />
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? "Edit Product" : "Add Product"}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Product Name *</label>
                    <input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>SKU *</label>
                    <input className="form-control" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required disabled={!!editing} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Category *</label>
                    <input className="form-control" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Unit Price *</label>
                    <input type="number" step="0.01" className="form-control" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Reorder Level *</label>
                    <input type="number" className="form-control" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} required />
                  </div>
                  {!editing && (
                    <div className="form-group">
                      <label>Initial Stock</label>
                      <input type="number" className="form-control" value={form.initialStock} onChange={(e) => setForm({ ...form, initialStock: e.target.value })} />
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea className="form-control" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">{editing ? "Update" : "Create"} Product</button>
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
