// ========================================
// 🍦 Heladería POS - Productos Module
// Product CRUD management
// ========================================

import * as db from '../db.js';
import { formatCurrency } from '../main.js';

const CATEGORIES = ['WAFFLES', 'TULIPANES', 'COPAS', 'POSTRES', 'TORTAS HELADAS', 'BEBIDAS', 'PROMOCIONES'];
const EMOJIS = ['🍦', '🍨', '🍧', '🥤', '🧋', '🧇', '🏆', '🎂', '🍰', '🧁', '🍫', '🍬', '🍭', '☕', '🥛', '🫐', '🍓', '🍌'];

let activeCategory = 'WAFFLES';
let searchQuery = '';
let statusFilter = 'all'; // all, active, inactive
let editingId = null;
let showConfigPanel = false;

export function render() {
  const products = db.getProducts();
  const filteredProducts = products.filter(p => {
    const matchesCat = p.categoria === activeCategory;
    const matchesSearch = p.nombre.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && p.activo) || 
                         (statusFilter === 'inactive' && !p.activo);
    return matchesCat && matchesSearch && matchesStatus;
  });

  const categoryCounts = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = products.filter(p => p.categoria === cat).length;
    return acc;
  }, {});

  return `
    <div class="page-header" style="display:flex; justify-content:space-between; align-items:center;">
      <div>
        <h2>⚙️ Gestión de Catálogo</h2>
        <p>Configura productos, ingredientes y límites por categoría</p>
      </div>
      <button class="btn btn-primary" id="btn-add-product">
        ➕ Nuevo Producto
      </button>
    </div>

    <div class="admin-layout">
      <!-- Nivel 1: Categorías -->
      <div class="admin-sidebar">
        ${CATEGORIES.map(cat => `
          <button class="admin-cat-btn ${activeCategory === cat ? 'active' : ''}" data-cat="${cat}">
            <span>${cat}</span>
            <span class="admin-cat-count">${categoryCounts[cat] || 0}</span>
          </button>
        `).join('')}
      </div>

      <!-- Nivel 2: Lista de Productos -->
      <div class="admin-main">
        <div class="admin-toolbar">
          <div class="search-wrapper">
            <span class="search-icon">🔍</span>
            <input type="text" class="admin-search" id="admin-search" placeholder="Buscar por nombre..." value="${searchQuery}" />
          </div>
          <select class="form-select" id="status-filter" style="width: 150px;">
            <option value="all" ${statusFilter === 'all' ? 'selected' : ''}>Todos</option>
            <option value="active" ${statusFilter === 'active' ? 'selected' : ''}>Activos</option>
            <option value="inactive" ${statusFilter === 'inactive' ? 'selected' : ''}>Inactivos</option>
          </select>
        </div>

        <div class="admin-grid">
          ${filteredProducts.length === 0 ? `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--text-muted);">
              <h3>No se encontraron productos</h3>
              <p>Cambia el filtro o añade un producto nuevo</p>
            </div>
          ` : filteredProducts.map(p => `
            <div class="admin-product-card ${!p.activo ? 'inactive' : ''}">
              <div class="card-top">
                <div class="card-emoji">${p.emoji || '🍦'}</div>
                <div class="card-info">
                  <div class="card-title">${p.nombre}</div>
                  <div class="card-price">${formatCurrency(p.precio)}</div>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" ${p.activo ? 'checked' : ''} data-toggle-id="${p.id}" />
                  <span class="toggle-slider"></span>
                </label>
              </div>
              
              <div style="font-size: 11px; color: var(--text-secondary); background: rgba(0,0,0,0.2); padding: 8px; border-radius: 6px;">
                ${p.opciones ? `
                  ⚙️ ${p.opciones.sabores?.max || 0} Sabores · 
                  ${p.opciones.toppings?.max || 0} Toppings · 
                  ${p.opciones.coberturas?.max || 0} Coberturas
                ` : 'Configuración estándar'}
              </div>

              <div class="card-actions">
                <button class="btn btn-ghost btn-sm" data-edit-id="${p.id}">✏️ Editar</button>
                <button class="btn btn-ghost btn-sm" data-delete-id="${p.id}" style="color: var(--danger);">🗑️</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Nivel 3: Panel Lateral de Configuración -->
    <div class="admin-overlay ${showConfigPanel ? 'visible' : ''}" id="admin-overlay"></div>
    <div class="config-side-panel ${showConfigPanel ? 'open' : ''}" id="config-panel">
      ${renderConfigPanelContent()}
    </div>
  `;
}

function renderConfigPanelContent() {
  if (!editingId) return '';
  const p = db.getProductById(editingId);
  if (!p) return '';

  return `
    <div class="config-panel-header">
      <div style="display:flex; align-items:center; gap: 12px;">
        <span style="font-size: 32px;">${p.emoji || '🍦'}</span>
        <div>
          <h3 style="margin:0;">Configurar</h3>
          <p style="margin:0; font-size: 13px; color: var(--text-muted);">${p.nombre}</p>
        </div>
      </div>
      <button class="modal-close" id="btn-close-config">&times;</button>
    </div>

    <div class="config-panel-body">
      <!-- Datos Básicos -->
      <div class="config-group">
        <label class="form-label">Datos Generales</label>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <input type="text" id="config-name" class="form-input" value="${p.nombre}" placeholder="Nombre" />
          <input type="number" id="config-price" class="form-input" value="${p.precio}" step="0.01" />
        </div>
      </div>

      <!-- Gestión de Sabores -->
      <div class="config-group">
        <div class="config-label-row">
          <label class="config-label">🍨 Sabores de Helado</label>
          <span class="config-badge">${db.SABORES_HELADO.length} Disponibles</span>
        </div>
        <div class="config-limits">
          <div class="limit-input-group">
            <label>Mínimo</label>
            <input type="number" id="limit-sabores-min" class="limit-field" value="${p.opciones?.sabores?.min || 0}" />
          </div>
          <div class="limit-input-group">
            <label>Máximo</label>
            <input type="number" id="limit-sabores-max" class="limit-field" value="${p.opciones?.sabores?.max || 0}" />
          </div>
        </div>
      </div>

      <!-- Gestión de Coberturas -->
      <div class="config-group">
        <div class="config-label-row">
          <label class="config-label">🍯 Coberturas Líquidas</label>
          <span class="config-badge">${db.COBERTURAS_LIQUIDAS.length} Tipos</span>
        </div>
        <div class="config-limits">
          <div class="limit-input-group">
            <label>Mínimo</label>
            <input type="number" id="limit-coberturas-min" class="limit-field" value="${p.opciones?.coberturas?.min || 0}" />
          </div>
          <div class="limit-input-group">
            <label>Máximo</label>
            <input type="number" id="limit-coberturas-max" class="limit-field" value="${p.opciones?.coberturas?.max || 0}" />
          </div>
        </div>
      </div>

      <!-- Gestión de Toppings -->
      <div class="config-group">
        <div class="config-label-row">
          <label class="config-label">🍪 Toppings Secos</label>
          <span class="config-badge">${db.TOPPINGS.length} Variedad</span>
        </div>
        <div class="config-limits">
          <div class="limit-input-group">
            <label>Mínimo</label>
            <input type="number" id="limit-toppings-min" class="limit-field" value="${p.opciones?.toppings?.min || 0}" />
          </div>
          <div class="limit-input-group">
            <label>Máximo</label>
            <input type="number" id="limit-toppings-max" class="limit-field" value="${p.opciones?.toppings?.max || 0}" />
          </div>
        </div>
      </div>

      <!-- Gestión de Extras -->
      <div class="config-group">
        <label class="config-label">➕ Extras Permitidos</label>
        <div class="config-item-list">
          ${db.EXTRAS.map(ex => {
            const isEnabled = p.opciones?.extras?.includes(ex.nombre);
            return `
              <label class="config-chip" style="display:flex; align-items:center; gap:8px; cursor:pointer; ${isEnabled ? 'background:var(--accent-pink-glow); border-color:var(--accent-pink);' : ''}">
                <input type="checkbox" class="extra-check" data-extra="${ex.nombre}" ${isEnabled ? 'checked' : ''} style="accent-color: var(--accent-pink);" />
                <span>${ex.nombre} (+$${ex.precio.toFixed(2)})</span>
              </label>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Notas y Extras -->
      <div class="config-group">
        <label class="config-label">📝 Notas e Incluye</label>
        <textarea id="config-desc" class="form-input" style="height: 60px; font-size: 13px;">${p.opciones?.incluye_desc || ''}</textarea>
        <p style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Ej: "2 sabores, fruta, crema, 1 cobertura"</p>
      </div>
    </div>

    <div class="config-footer">
      <button class="btn btn-ghost" id="btn-config-cancel">Cancelar</button>
      <button class="btn btn-primary" id="btn-config-save">Guardar Cambios</button>
    </div>
  `;
}

export function init() {
  // Category switches
  document.querySelectorAll('.admin-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.cat;
      rerender();
    });
  });

  // Search input
  const searchInput = document.getElementById('admin-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      rerender();
    });
  }

  // Status Filter
  const statusEl = document.getElementById('status-filter');
  if (statusEl) {
    statusEl.addEventListener('change', (e) => {
      statusFilter = e.target.value;
      rerender();
    });
  }

  // Add product
  const btnAdd = document.getElementById('btn-add-product');
  if (btnAdd) btnAdd.addEventListener('click', async () => {
    // Para simplificar, creamos uno vacío en la categoría actual
    const newId = await db.addProduct({
      nombre: 'Nuevo Producto',
      precio: 0,
      categoria: activeCategory,
      emoji: '🍦',
      activo: true
    });
    if (newId) {
      editingId = newId;
      showConfigPanel = true;
      rerender();
    }
  });

  // Open Config (Edit)
  document.querySelectorAll('[data-edit-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      editingId = Number(btn.dataset.editId);
      showConfigPanel = true;
      rerender();
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
        confirmText: '🗑️ Sí, eliminar',
        confirmClass: 'btn-danger',
      });

      if (confirmed) {
        db.deleteProduct(product.id);
        window.showToast('🗑️ Producto eliminado', 'info');
        rerender();
      }
    });
  });

  // Toggle active
  document.querySelectorAll('[data-toggle-id]').forEach(toggle => {
    toggle.addEventListener('change', () => {
      db.updateProduct(Number(toggle.dataset.toggleId), { activo: toggle.checked });
      window.showToast(toggle.checked ? '✅ Producto activado' : '⏸️ Producto desactivado', 'info');
      // No rerender total para no perder el scroll
    });
  });

  // Config Panel actions
  const btnCloseConfig = document.getElementById('btn-close-config');
  const btnCancelConfig = document.getElementById('btn-config-cancel');
  const overlay = document.getElementById('admin-overlay');
  
  const close = () => {
    showConfigPanel = false;
    editingId = null;
    rerender();
  };

  if (btnCloseConfig) btnCloseConfig.addEventListener('click', close);
  if (btnCancelConfig) btnCancelConfig.addEventListener('click', close);
  if (overlay) overlay.addEventListener('click', close);

  // Save Config
  const btnSaveConfig = document.getElementById('btn-config-save');
  if (btnSaveConfig) {
    btnSaveConfig.addEventListener('click', async () => {
      const nombre = document.getElementById('config-name').value.trim();
      const precio = parseFloat(document.getElementById('config-price').value);
      const incluye_desc = document.getElementById('config-desc').value.trim();
      
      const extras = Array.from(document.querySelectorAll('.extra-check:checked')).map(el => el.dataset.extra);
      
      const opciones = {
        sabores: {
          min: parseInt(document.getElementById('limit-sabores-min').value) || 0,
          max: parseInt(document.getElementById('limit-sabores-max').value) || 0
        },
        coberturas: {
          min: parseInt(document.getElementById('limit-coberturas-min').value) || 0,
          max: parseInt(document.getElementById('limit-coberturas-max').value) || 0
        },
        toppings: {
          min: parseInt(document.getElementById('limit-toppings-min').value) || 0,
          max: parseInt(document.getElementById('limit-toppings-max').value) || 0
        },
        extras,
        incluye_desc
      };

      if (!nombre) {
        window.showToast('❌ El nombre es obligatorio', 'error');
        return;
      }

      await db.updateProduct(editingId, { nombre, precio, opciones });
      window.showToast('✅ Configuración guardada', 'success');
      close();
    });
  }
}

function rerender() {
  const container = document.getElementById('page-container');
  if (container) {
    container.innerHTML = render();
    init();
  }
}

export function cleanup() {}
