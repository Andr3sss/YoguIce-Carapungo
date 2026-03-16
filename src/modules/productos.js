// ========================================
// 🍦 Heladería POS - Productos Module
// Product CRUD management
// ========================================

import * as db from '../db.js';
import { formatCurrency } from '../main.js';

const CATEGORIES = ['Helados', 'Especiales', 'Bebidas', 'Postres', 'Otros'];
const EMOJIS = ['🍦', '🍨', '🍧', '🥤', '🧋', '🧇', '🏆', '🎂', '🍰', '🧁', '🍫', '🍬', '🍭', '☕', '🥛', '🫐', '🍓', '🍌'];

let editingId = null;

export function render() {
  const products = db.getProducts();

  return `
    <div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-start;">
      <div>
        <h2>🍨 Control de Productos</h2>
        <p>Administra el catálogo de productos de tu heladería</p>
      </div>
      <button class="btn btn-primary" id="btn-add-product">
        ➕ Nuevo Producto
      </button>
    </div>

    <div class="stats-grid" style="margin-bottom: 24px;">
      <div class="stat-card pink">
        <div class="stat-number">${products.length}</div>
        <div class="stat-desc">Total Productos</div>
      </div>
      <div class="stat-card mint">
        <div class="stat-number">${products.filter(p => p.activo).length}</div>
        <div class="stat-desc">Activos</div>
      </div>
      <div class="stat-card peach">
        <div class="stat-number">${products.filter(p => !p.activo).length}</div>
        <div class="stat-desc">Inactivos</div>
      </div>
      <div class="stat-card lavender">
        <div class="stat-number">${new Set(products.map(p => p.categoria)).size}</div>
        <div class="stat-desc">Categorías</div>
      </div>
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Nombre</th>
            <th>Precio</th>
            <th>Categoría</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${products.map(p => `
            <tr>
              <td style="font-size: 24px; text-align: center;">${p.emoji || '🍦'}</td>
              <td style="font-weight: 600; color: var(--text-primary);">${p.nombre}</td>
              <td style="font-weight: 700; color: var(--accent-mint);">${formatCurrency(p.precio)}</td>
              <td><span class="badge active" style="background: rgba(196,181,253,0.15); color: var(--accent-lavender);">${p.categoria}</span></td>
              <td>
                <label class="toggle-switch">
                  <input type="checkbox" ${p.activo ? 'checked' : ''} data-toggle-id="${p.id}" />
                  <span class="toggle-slider"></span>
                </label>
              </td>
              <td>
                <div style="display:flex;gap:8px;">
                  <button class="btn btn-ghost btn-sm" data-edit-id="${p.id}">✏️ Editar</button>
                  <button class="btn btn-ghost btn-sm" data-delete-id="${p.id}" style="color: var(--danger);">🗑️</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Product Form Modal -->
    <div id="product-form-modal" class="product-form-modal" style="display:none;">
      <div class="product-form">
        <div class="modal-header">
          <h2 id="form-title">Nuevo Producto</h2>
          <button class="modal-close" id="form-close">&times;</button>
        </div>

        <div class="form-group">
          <label class="form-label">Emoji</label>
          <div style="display:flex; flex-wrap:wrap; gap:8px;" id="emoji-picker">
            ${EMOJIS.map(e => `
              <button type="button" class="emoji-option" data-emoji="${e}" style="font-size:24px; background:var(--bg-tertiary); border:2px solid transparent; border-radius:8px; padding:8px; cursor:pointer; transition:all 0.15s;">${e}</button>
            `).join('')}
          </div>
          <input type="hidden" id="product-emoji" value="🍦" />
        </div>

        <div class="form-group">
          <label class="form-label">Nombre del Producto</label>
          <input type="text" id="product-name" class="form-input" placeholder="Ej: Helado Triple" />
        </div>

        <div class="form-group">
          <label class="form-label">Precio ($)</label>
          <input type="number" id="product-price" class="form-input" placeholder="0.00" step="0.01" min="0" />
        </div>

        <div class="form-group">
          <label class="form-label">Categoría</label>
          <select id="product-category" class="form-select">
            ${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>

        <div style="display:flex; gap:12px; margin-top:24px;">
          <button class="btn btn-primary" style="flex:1;" id="btn-save-product">
            💾 Guardar
          </button>
          <button class="btn btn-ghost" id="btn-cancel-product">Cancelar</button>
        </div>
      </div>
    </div>
  `;
}

export function init() {
  // Add product
  const btnAdd = document.getElementById('btn-add-product');
  if (btnAdd) btnAdd.addEventListener('click', () => openForm());

  // Edit product
  document.querySelectorAll('[data-edit-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const product = db.getProductById(btn.dataset.editId);
      if (product) openForm(product);
    });
  });

  // Delete product
  document.querySelectorAll('[data-delete-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const product = db.getProductById(Number(btn.dataset.deleteId));
      if (!product) return;

      const confirmed = await window.showConfirm({
        icon: '🗑️',
        title: `¿Eliminar "${product.nombre}"?`,
        message: 'Este producto será eliminado permanentemente del catálogo.',
        details: `
          <div class="confirm-cuenta-info">
            <div class="confirm-cuenta-row">
              <span>Producto</span><strong>${product.emoji || '🍦'} ${product.nombre}</strong>
            </div>
            <div class="confirm-cuenta-row">
              <span>Precio</span><strong>${formatCurrency(product.precio)}</strong>
            </div>
            <div class="confirm-cuenta-row">
              <span>Categoría</span><strong>${product.categoria}</strong>
            </div>
          </div>
        `,
        confirmText: '🗑️ Sí, eliminar',
        confirmClass: 'btn-danger',
      });

      if (confirmed) {
        db.deleteProduct(Number(btn.dataset.deleteId));
        window.showToast('🗑️ Producto eliminado', 'info');
        if (window.navigateTo) window.navigateTo('productos');
      }
    });
  });

  // Toggle active
  document.querySelectorAll('[data-toggle-id]').forEach(toggle => {
    toggle.addEventListener('change', () => {
      db.updateProduct(Number(toggle.dataset.toggleId), { activo: toggle.checked });
      window.showToast(toggle.checked ? '✅ Producto activado' : '⏸️ Producto desactivado', 'info');
    });
  });

  // Form actions
  const formModal = document.getElementById('product-form-modal');
  const formClose = document.getElementById('form-close');
  const btnCancel = document.getElementById('btn-cancel-product');
  const btnSave = document.getElementById('btn-save-product');

  if (formClose) formClose.addEventListener('click', closeForm);
  if (btnCancel) btnCancel.addEventListener('click', closeForm);
  if (btnSave) btnSave.addEventListener('click', saveProduct);
  if (formModal) formModal.addEventListener('click', (e) => { if (e.target === formModal) closeForm(); });

  // Emoji picker
  document.querySelectorAll('.emoji-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.emoji-option').forEach(b => b.style.borderColor = 'transparent');
      btn.style.borderColor = 'var(--accent-pink)';
      document.getElementById('product-emoji').value = btn.dataset.emoji;
    });
  });
}

function openForm(product = null) {
  editingId = product ? product.id : null;
  document.getElementById('form-title').textContent = product ? 'Editar Producto' : 'Nuevo Producto';
  document.getElementById('product-name').value = product ? product.nombre : '';
  document.getElementById('product-price').value = product ? product.precio : '';
  document.getElementById('product-category').value = product ? product.categoria : CATEGORIES[0];
  document.getElementById('product-emoji').value = product ? (product.emoji || '🍦') : '🍦';

  // Highlight selected emoji
  document.querySelectorAll('.emoji-option').forEach(btn => {
    const selected = product ? (product.emoji || '🍦') : '🍦';
    btn.style.borderColor = btn.dataset.emoji === selected ? 'var(--accent-pink)' : 'transparent';
  });

  document.getElementById('product-form-modal').style.display = 'flex';
}

function closeForm() {
  document.getElementById('product-form-modal').style.display = 'none';
  editingId = null;
}

function saveProduct() {
  const nombre = document.getElementById('product-name').value.trim();
  const precio = parseFloat(document.getElementById('product-price').value);
  const categoria = document.getElementById('product-category').value;
  const emoji = document.getElementById('product-emoji').value;

  if (!nombre) {
    window.showToast('❌ El nombre es obligatorio', 'error');
    return;
  }
  if (isNaN(precio) || precio <= 0) {
    window.showToast('❌ Ingresa un precio válido', 'error');
    return;
  }

  if (editingId) {
    db.updateProduct(editingId, { nombre, precio, categoria, emoji });
    window.showToast('✅ Producto actualizado', 'success');
  } else {
    db.addProduct({ nombre, precio, categoria, emoji, activo: true });
    window.showToast('✅ Producto agregado', 'success');
  }

  closeForm();
  if (window.navigateTo) window.navigateTo('productos');
}

export function cleanup() {}
