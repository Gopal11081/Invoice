'use client';

import { useState, useEffect } from 'react';
import { UNITS, formatNumber } from '@/lib/utils';
import { toast } from '@/lib/toast';
import ConfirmationModal from '@/components/ConfirmationModal';
import { logClientError } from '@/lib/logError';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Auto-correction for page overflow on deletions
  useEffect(() => {
    const maxPage = Math.ceil(products.length / itemsPerPage) || 1;
    if (currentPage > maxPage) {
      setCurrentPage(maxPage);
    }
  }, [products, currentPage]);

  // Form states
  const [prodDescription, setProdDescription] = useState('');
  const [prodHsn, setProdHsn] = useState('');
  const [prodUnit, setProdUnit] = useState('Nos');
  const [prodRate, setProdRate] = useState('');
  const [prodGst, setProdGst] = useState('18');
  const [prodQtyPerUnit, setProdQtyPerUnit] = useState('1');

  // Drag and drop states
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [dragOverPosition, setDragOverPosition] = useState(null); // 'above' or 'below'

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      if (!res.ok) throw new Error('Failed to load products');
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      toast.error('Failed to load products');
      logClientError('app/(dashboard)/products/page.js', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const openAddForm = () => {
    setEditingProduct(null);
    setProdDescription('');
    setProdHsn('');
    setProdUnit('Nos');
    setProdRate('');
    setProdGst('18');
    setProdQtyPerUnit('1');
    setFormOpen(true);
  };

  const openEditForm = (p) => {
    setEditingProduct(p);
    setProdDescription(p.description || '');
    setProdHsn(p.hsn_sac || '');
    setProdUnit(p.unit || 'Nos');
    setProdRate(p.rate || '');
    setProdGst(p.gst_rate ?? '18');
    setProdQtyPerUnit(p.qty_per_unit || '1');
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingProduct(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();

    const description = prodDescription.trim();
    const hsn_sac = prodHsn.trim();
    const unit = prodUnit;
    const rate = parseFloat(prodRate);
    const gst_rate = parseFloat(prodGst) || 18;
    const qty_per_unit = parseInt(prodQtyPerUnit, 10) || 1;

    if (!description) { toast.error('Product description is required'); return; }

    if (hsn_sac && !/^\d{2,8}$/.test(hsn_sac)) {
      toast.error('HSN/SAC code must be numeric and between 2 to 8 digits.');
      return;
    }

    if (isNaN(rate) || rate < 0) {
      toast.error('Product rate must be a non-negative number.');
      return;
    }

    const payload = { description, hsn_sac, unit, rate, gst_rate, qty_per_unit };

    try {
      let res;
      if (editingProduct) {
        res = await fetch(`/api/products/${editingProduct.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save product');
      }

      toast.success(editingProduct ? 'Product updated!' : 'Product added!');
      closeForm();
      fetchProducts();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const [confirmConfig, setConfirmConfig] = useState(null);

  const handleDeleteClick = (product) => {
    setConfirmConfig({
      title: 'Remove Product',
      message: `Are you sure you want to remove "${product.description}" from the catalog? This action cannot be undone.`,
      confirmText: 'Remove',
      type: 'danger',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isLoading: true }));
        try {
          const res = await fetch(`/api/products/${product.id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Failed to delete product');
          toast.success('Product removed');
          fetchProducts();
        } catch (err) {
          toast.error(err.message);
        } finally {
          setConfirmConfig(null);
        }
      }
    });
  };

  // Drag and Drop Handlers
  const handleDragStart = (e, paginatedIdx) => {
    const globalIdx = (currentPage - 1) * itemsPerPage + paginatedIdx;
    setDraggedIndex(globalIdx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, paginatedIdx) => {
    e.preventDefault();
    const globalIdx = (currentPage - 1) * itemsPerPage + paginatedIdx;
    if (draggedIndex === null || draggedIndex === globalIdx) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const after = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;

    setDragOverIndex(globalIdx);
    setDragOverPosition(after ? 'below' : 'above');
  };

  const handleDrop = async (e, paginatedIdx) => {
    e.preventDefault();
    const globalIdx = (currentPage - 1) * itemsPerPage + paginatedIdx;
    if (draggedIndex === null || draggedIndex === globalIdx) return;

    const after = dragOverPosition === 'below';
    let newProducts = [...products];
    const [moved] = newProducts.splice(draggedIndex, 1);

    let targetPos = globalIdx;
    if (after) {
      targetPos += 1;
    }
    if (draggedIndex < targetPos) {
      targetPos -= 1;
    }
    newProducts.splice(targetPos, 0, moved);
    setProducts(newProducts);

    // Reset drag indices
    setDraggedIndex(null);
    setDragOverIndex(null);
    setDragOverPosition(null);

    // Save ordering to database
    const order = newProducts.map((p, idx) => ({ id: p.id, sort_order: idx + 1 }));
    try {
      const res = await fetch('/api/products/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order })
      });
      if (!res.ok) throw new Error('Failed to save order');
      toast.success('Product order updated successfully!');
    } catch (err) {
      toast.error(err.message);
      fetchProducts(); // revert order on failure
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    setDragOverPosition(null);
  };

  return (
    <section className="page active" id="pageProducts">
      <div className="page-header">
        <h1 className="page-title">📦 Product Catalog</h1>
        <div className="page-actions">
          {!formOpen && (
            <button className="btn btn-accent" onClick={openAddForm}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Product
            </button>
          )}
        </div>
      </div>

      <div className="page-body">
        {formOpen && (
          <form className="product-form" style={{ display: 'block' }} onSubmit={handleSave}>
            <h3 className="settings-section-title">
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </h3>
            <div className="form-grid cols-2">
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="prodDescription">Description *</label>
                <input
                  type="text"
                  id="prodDescription"
                  placeholder="Product or service name"
                  value={prodDescription}
                  onChange={(e) => setProdDescription(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="prodHsn">HSN / SAC Code</label>
                <input
                  type="text"
                  id="prodHsn"
                  placeholder="998314"
                  className="mono"
                  value={prodHsn}
                  onChange={(e) => setProdHsn(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="prodUnit">Unit</label>
                <select
                  id="prodUnit"
                  value={prodUnit}
                  onChange={(e) => setProdUnit(e.target.value)}
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="prodRate">Rate (₹)</label>
                <input
                  type="number"
                  id="prodRate"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  value={prodRate}
                  onChange={(e) => setProdRate(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="prodGst">GST Rate (%)</label>
                <input
                  type="number"
                  id="prodGst"
                  placeholder="e.g. 18"
                  min="0"
                  max="100"
                  step="0.01"
                  value={prodGst}
                  onChange={(e) => setProdGst(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="prodQtyPerUnit">Quantity per Unit</label>
                <input
                  type="number"
                  id="prodQtyPerUnit"
                  placeholder="e.g. 10"
                  min="1"
                  step="1"
                  value={prodQtyPerUnit}
                  onChange={(e) => setProdQtyPerUnit(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="product-form-actions">
              <button type="submit" className="btn btn-primary">Save Product</button>
              <button type="button" className="btn btn-ghost" onClick={closeForm}>Cancel</button>
            </div>
          </form>
        )}

        <div className={`products-list ${draggedIndex !== null ? 'dragging-active' : ''}`}>
          {loading ? (
            <p className="page-empty-state">Loading products...</p>
          ) : products.length === 0 ? (
            <p className="page-empty-state">No products yet. Add your first product!</p>
          ) : (
            (() => {
              const paginatedProducts = products.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
              return paginatedProducts.map((p, paginatedIdx) => {
                const globalIdx = (currentPage - 1) * itemsPerPage + paginatedIdx;
                const displayLabel = p.description + (p.qty_per_unit && p.qty_per_unit > 1 ? ` (${p.qty_per_unit})` : '');
                
                let classNames = 'product-item';
                if (draggedIndex === globalIdx) classNames += ' dragging';
                if (dragOverIndex === globalIdx) {
                  if (dragOverPosition === 'above') classNames += ' drag-over-above';
                  if (dragOverPosition === 'below') classNames += ' drag-over-below';
                }

                return (
                  <div
                    className={classNames}
                    key={p.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, paginatedIdx)}
                    onDragOver={(e) => handleDragOver(e, paginatedIdx)}
                    onDrop={(e) => handleDrop(e, paginatedIdx)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="product-drag-handle" title="Drag to reorder">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="9" cy="5" r="1" />
                        <circle cx="9" cy="12" r="1" />
                        <circle cx="9" cy="19" r="1" />
                        <circle cx="15" cy="5" r="1" />
                        <circle cx="15" cy="12" r="1" />
                        <circle cx="15" cy="19" r="1" />
                      </svg>
                    </div>
                    <div className="product-item-info">
                      <div className="product-item-name">{displayLabel}</div>
                      <div className="product-item-meta">
                        <span>HSN: {p.hsn_sac || '—'}</span>
                        <span>Unit: {p.unit}</span>
                        <span>GST: {p.gst_rate}%</span>
                      </div>
                    </div>
                    <div className="product-item-price">₹{formatNumber(p.rate)}</div>
                    <div className="product-item-actions">
                      <button className="btn btn-ghost" onClick={() => openEditForm(p)} title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button className="btn btn-danger" onClick={() => handleDeleteClick(p)} title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3,6 5,6 21,6" />
                          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              });
            })()
          )}
        </div>

        {/* PAGINATION CONTROLS */}
        {!loading && products.length > itemsPerPage && (
          (() => {
            const totalPages = Math.ceil(products.length / itemsPerPage);
            const startItem = (currentPage - 1) * itemsPerPage + 1;
            const endItem = Math.min(currentPage * itemsPerPage, products.length);
            
            return (
              <div className="pagination-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', padding: '0.85rem 1.25rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Showing <strong>{startItem}</strong>-<strong>{endItem}</strong> of <strong>{products.length}</strong> products
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    style={{ opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                  >
                    ◀ Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                    const isActive = page === currentPage;
                    return (
                      <button
                        key={page}
                        className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setCurrentPage(page)}
                        style={{ minWidth: '32px', justifyContent: 'center' }}
                      >
                        {page}
                      </button>
                    );
                  })}
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    style={{ opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                  >
                    Next ▶
                  </button>
                </div>
              </div>
            );
          })()
        )}
      </div>
      <ConfirmationModal
        isOpen={!!confirmConfig}
        title={confirmConfig?.title}
        message={confirmConfig?.message}
        confirmText={confirmConfig?.confirmText}
        type={confirmConfig?.type}
        isLoading={confirmConfig?.isLoading}
        onConfirm={confirmConfig?.onConfirm}
        onCancel={() => setConfirmConfig(null)}
      />
    </section>
  );
}
