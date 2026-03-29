// ========================================
// 🍦 Heladería POS - Productos Module
// Product CRUD management
// ========================================

import * as db from '../db.js';
import { formatCurrency } from '../main.js';

// Dynamic categories from DB
const EMOJIS = ['🍦', '🍨', '🍧', '🥤', '🧋', '🧇', '🏆', '🎂', '🍰', '🧁', '🍫', '🍬', '🍭', '☕', '🥛', '🫐', '🍓', '🍌'];

let activeCategory = 'WAFFLES';
let searchQuery = '';
let statusFilter = 'active'; // all, active, inactive
let editingId = null;
let showConfigPanel = false;
let showCategoryModal = false;
let showOpcionesModal = false;
let currentOpcionesTab = 'sabor'; // 'sabor', 'cobertura', 'topping', 'extra', 'nota'

export function render() {
  const products = db.getProducts();
  const filteredProducts = products.filter(p => {
    const isSearching = searchQuery.trim().length > 0;
    const matchesCat = isSearching ? true : p.categoria === activeCategory;
    const matchesSearch = p.nombre.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && p.activo) || 
                         (statusFilter === 'inactive' && !p.activo);
    return matchesCat && matchesSearch && matchesStatus;
  });

  const categories = db.getCategories();
  const categoryCounts = categories.reduce((acc, cat) => {
    acc[cat.nombre] = products.filter(p => p.categoria === cat.nombre).length;
    return acc;
  }, {});

  return `
    <div class="page-header" style="display:flex; justify-content:space-between; align-items:center;">
      <div>
        <h2>⚙️ Gestión de Catálogo</h2>
        <p>Configura productos, ingredientes y límites por categoría</p>
      </div>
      <div style="display:flex; gap: 8px;">
        <button class="btn btn-secondary" id="btn-import-catalog" style="background: rgba(255,255,255,0.1); color: var(--text-primary); border: 1px solid rgba(255,255,255,0.2);">
          <span>📥</span> Importar
        </button>
        <button class="btn btn-secondary" id="btn-export-catalog" style="background: rgba(255,255,255,0.1); color: var(--text-primary); border: 1px solid rgba(255,255,255,0.2);">
          <span>📤</span> Exportar
        </button>
        <button class="btn btn-primary" id="btn-add-product">
          ➕ Nuevo Producto
        </button>
      </div>
    </div>

    <div class="admin-layout">
      <!-- Nivel 1: Categorías -->
      <div class="admin-sidebar">
        <div style="padding: 0 8px 12px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 12px; display:flex; flex-direction:column; gap:8px;">
          <button class="btn btn-ghost btn-sm w-100" id="btn-manage-cats" style="width:100%; justify-content: center; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">
            ⚙️ Categorías
          </button>
          <button class="btn btn-ghost btn-sm w-100" id="btn-manage-opts" style="width:100%; justify-content: center; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--accent-mint);">
            🍧 Opciones Extra
          </button>
        </div>
        ${categories.map(cat => `
          <button class="admin-cat-btn ${activeCategory === cat.nombre ? 'active' : ''}" data-cat="${cat.nombre}">
            <span>${cat.nombre}</span>
            <span class="admin-cat-count">${categoryCounts[cat.nombre] || 0}</span>
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
          ` : filteredProducts.map(p => {
            const isPromoCard = p.categoria === 'PROMOCIONES';
            const promoInfo = isPromoCard && p.opciones?.promo
              ? `🏆 Combo ×${p.opciones.promo.cantidad} · ${p.opciones.promo.label || 'Producto'} · ${p.opciones.promo.perProduct?.sabores?.max || 0} sab + ${p.opciones.promo.perProduct?.coberturas?.max || 0} cob c/u`
              : p.opciones
                ? `⚙️ ${p.opciones.sabores?.max || 0} Sabores · ${p.opciones.toppings?.max || 0} Toppings · ${p.opciones.coberturas?.max || 0} Coberturas`
                : 'Configuración estándar';
            return `
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
              
              <div style="font-size: 11px; color: ${isPromoCard ? 'var(--accent-mint)' : 'var(--text-secondary)'}; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 6px;">
                ${promoInfo}
              </div>

              <div class="card-actions">
                <button class="btn btn-ghost btn-sm" data-edit-id="${p.id}">✏️ Editar</button>
                <button class="btn btn-ghost btn-sm" data-delete-id="${p.id}" style="color: var(--danger);">🗑️</button>
              </div>
            </div>
          `;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- Capa de fondo para el panel de configuración -->
    <div class="admin-overlay ${showConfigPanel ? 'visible' : ''}" id="admin-overlay"></div>
    
    <div class="config-side-panel ${showConfigPanel ? 'open' : ''}" id="config-panel">
      ${renderConfigPanelContent()}
    </div>

    <!-- Nivel 4: Modal de Gestión de Categorías -->
    ${showCategoryModal ? renderCategoryModal() : ''}

    <!-- Nivel 5: Modal de Gestión de Opciones -->
    ${showOpcionesModal ? renderOpcionesModal() : ''}
  `;
}

function renderOpcionesModal() {
  const opciones = db.getOpcionesColeccion().filter(o => o.tipo === currentOpcionesTab);
  
  const tabs = [
    { id: 'sabor', label: '🍧 Sabores' },
    { id: 'cobertura', label: '🍯 Coberturas' },
    { id: 'topping', label: '🍬 Toppings' },
    { id: 'extra', label: '➕ Extras' },
    { id: 'nota', label: '📝 Notas' }
  ];

  return `
    <div class="modal-overlay" id="opt-modal-overlay">
      <div class="modal" style="max-width: 600px; width: 95%;">
        <div class="modal-header">
          <h2>🍧 Gestionar Opciones</h2>
          <button class="modal-close" id="btn-close-opt-modal">&times;</button>
        </div>
        
        <div style="display:flex; gap:8px; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; overflow-x: auto;">
          ${tabs.map(t => `
            <button class="btn btn-sm ${currentOpcionesTab === t.id ? 'btn-primary' : 'btn-ghost'} opt-tab-btn" data-tab="${t.id}" style="white-space: nowrap;">
              ${t.label}
            </button>
          `).join('')}
        </div>

        <div style="margin-bottom: 16px; background: rgba(0,0,0,0.3); padding: 12px 16px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08);">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
            <span style="font-size:18px;">💰</span>
            <div style="font-weight:700; font-size:13px;">Precios por opción extra</div>
          </div>
          <div style="display:flex; gap:12px; flex-wrap:wrap;">
            <div style="display:flex; align-items:center; gap:6px; background:rgba(0,0,0,0.2); padding:8px 12px; border-radius:8px; flex:1; min-width:140px;">
              <span style="font-size:12px;">🍧 Sabor</span>
              <span style="color:var(--accent-mint); font-weight:800;">$</span>
              <input type="number" id="precio-extra-sabores" class="form-input" value="${db.getPrecioExtraPorTipo('sabores').toFixed(2)}" step="0.05" min="0" style="width:65px; text-align:center; font-weight:800; font-size:14px; color:var(--accent-mint); background:rgba(0,0,0,0.3); border-radius:6px; padding:6px;" />
            </div>
            <div style="display:flex; align-items:center; gap:6px; background:rgba(0,0,0,0.2); padding:8px 12px; border-radius:8px; flex:1; min-width:140px;">
              <span style="font-size:12px;">🍯 Cobert.</span>
              <span style="color:var(--accent-mint); font-weight:800;">$</span>
              <input type="number" id="precio-extra-coberturas" class="form-input" value="${db.getPrecioExtraPorTipo('coberturas').toFixed(2)}" step="0.05" min="0" style="width:65px; text-align:center; font-weight:800; font-size:14px; color:var(--accent-mint); background:rgba(0,0,0,0.3); border-radius:6px; padding:6px;" />
            </div>
            <div style="display:flex; align-items:center; gap:6px; background:rgba(0,0,0,0.2); padding:8px 12px; border-radius:8px; flex:1; min-width:140px;">
              <span style="font-size:12px;">🍬 Topping</span>
              <span style="color:var(--accent-mint); font-weight:800;">$</span>
              <input type="number" id="precio-extra-toppings" class="form-input" value="${db.getPrecioExtraPorTipo('toppings').toFixed(2)}" step="0.05" min="0" style="width:65px; text-align:center; font-weight:800; font-size:14px; color:var(--accent-mint); background:rgba(0,0,0,0.3); border-radius:6px; padding:6px;" />
            </div>
          </div>
          <button class="btn btn-primary btn-sm" id="btn-save-precios-extra" style="margin-top:10px; width:100%;">💾 Guardar Precios</button>
        </div>

        <div style="margin-bottom: 20px; display:flex; gap: 8px;">
          <input type="text" id="new-opt-name" class="form-input" placeholder="Nombre de la nueva opción..." style="text-transform: uppercase;">
          ${currentOpcionesTab === 'extra' ? `
            <input type="number" id="new-opt-price" class="form-input" placeholder="Precio ($)" style="width: 100px;" step="0.05" min="0">
          ` : ''}
          <button class="btn btn-primary" id="btn-add-opt">Añadir</button>
        </div>

        <div style="max-height: 350px; overflow-y: auto; background: rgba(0,0,0,0.2); border-radius: 8px; padding: 8px;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="text-align: left; font-size: 11px; text-transform: uppercase; color: var(--text-muted);">
                <th style="padding: 8px;">Nombre</th>
                ${currentOpcionesTab === 'extra' ? '<th style="padding: 8px; width: 80px;">Precio</th>' : ''}
                <th style="padding: 8px; text-align: center; width: 60px;">Activo</th>
                <th style="padding: 8px; text-align: right; width: 90px;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${opciones.map(opt => `
                <tr style="border-top: 1px solid rgba(255,255,255,0.05); ${!opt.activo ? 'opacity: 0.5;' : ''}">
                  <td style="padding: 10px;">
                    <input type="text" class="form-input opt-input-name" data-id="${opt.id}" value="${opt.nombre}" style="background: transparent; border: none; padding: 4px; text-transform: uppercase;" />
                  </td>
                  ${currentOpcionesTab === 'extra' ? `
                    <td style="padding: 10px;">
                      <input type="number" class="form-input opt-input-price" data-id="${opt.id}" value="${opt.precio || 0}" step="0.05" style="background: transparent; border: none; padding: 4px; width: 70px;" />
                    </td>
                  ` : ''}
                  <td style="padding: 10px; text-align: center;">
                    <label class="toggle-switch" style="transform: scale(0.7); margin: 0;">
                      <input type="checkbox" class="opt-toggle-active" data-id="${opt.id}" ${opt.activo ? 'checked' : ''} />
                      <span class="toggle-slider"></span>
                    </label>
                  </td>
                  <td style="padding: 10px; text-align: right;">
                    <button class="btn btn-ghost btn-sm btn-save-opt" data-id="${opt.id}" title="Guardar cambios" style="padding: 4px;">💾</button>
                    <button class="btn btn-ghost btn-sm btn-delete-opt" data-id="${opt.id}" style="color: var(--danger); padding: 4px;" title="Eliminar">🗑️</button>
                  </td>
                </tr>
              `).join('')}
              ${opciones.length === 0 ? `<tr><td colspan="4" style="padding: 20px; text-align: center; color: var(--text-muted);">No hay opciones registradas</td></tr>` : ''}
            </tbody>
          </table>
        </div>

        <div class="modal-footer" style="margin-top: 20px; display: flex; justify-content: flex-end;">
          <button class="btn btn-secondary" id="btn-finish-opts">Cerrar</button>
        </div>
      </div>
    </div>
  `;
}

function renderCategoryModal() {
  const categories = db.getCategories();
  return `
    <div class="modal-overlay" id="cat-modal-overlay">
      <div class="modal" style="max-width: 600px; width: 95%;">
        <div class="modal-header">
          <h2>📁 Gestionar Categorías</h2>
          <button class="modal-close" id="btn-close-cat-modal">&times;</button>
        </div>
        
        <div style="margin-bottom: 20px; display:flex; gap: 8px;">
          <input type="text" id="new-cat-name" class="form-input" placeholder="Nombre de la nueva categoría..." style="text-transform: uppercase;">
          <button class="btn btn-primary" id="btn-add-cat">Añadir</button>
        </div>

        <div style="max-height: 350px; overflow-y: auto; background: rgba(0,0,0,0.2); border-radius: 8px; padding: 8px;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="text-align: left; font-size: 11px; text-transform: uppercase; color: var(--text-muted);">
                <th style="padding: 8px;">Nombre</th>
                <th style="padding: 8px; text-align: right; width: 90px;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${categories.map(cat => `
                <tr style="border-top: 1px solid rgba(255,255,255,0.05);">
                  <td style="padding: 10px;">
                    <input type="text" class="form-input cat-input-edit" data-id="${cat.id}" value="${cat.nombre}" style="background: transparent; border: none; padding: 4px; text-transform: uppercase;" />
                  </td>
                  <td style="padding: 10px; text-align: right;">
                    <button class="btn btn-ghost btn-sm btn-save-cat" data-id="${cat.id}" title="Guardar cambios" style="padding: 4px;">💾</button>
                    <button class="btn btn-ghost btn-sm btn-delete-cat" data-id="${cat.id}" style="color: var(--danger); padding: 4px;" title="Eliminar">🗑️</button>
                  </td>
                </tr>
              `).join('')}
              ${categories.length === 0 ? `<tr><td colspan="2" style="padding: 20px; text-align: center; color: var(--text-muted);">No hay categorías registradas</td></tr>` : ''}
            </tbody>
          </table>
        </div>
        
        <div style="margin-top: 20px; font-size: 12px; color: var(--text-muted); background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); padding: 10px; border-radius: 6px;">
          ℹ️ Al renombrar una categoría, todos sus productos se actualizarán automáticamente.
        </div>

        <div class="modal-footer" style="margin-top: 20px; display: flex; justify-content: flex-end;">
          <button class="btn btn-secondary" id="btn-finish-cats">Cerrar</button>
        </div>
      </div>
    </div>
  `;
}

function renderConfigPanelContent() {
  if (editingId === null) return '';
  
  const isNew = editingId === -1;
  const p = isNew ? {
    nombre: '',
    precio: 0,
    categoria: activeCategory,
    emoji: activeCategory === 'PROMOCIONES' ? '🏆' : '🍦',
    activo: true,
    opciones: activeCategory === 'PROMOCIONES'
      ? { promo: { cantidad: 2, label: 'Producto', perProduct: { sabores: {min:1, max:1}, coberturas: {min:1, max:1}, toppings: {min:0, max:0} } }, sabores: {min:2, max:2}, coberturas: {min:2, max:2}, toppings: {min:0, max:0}, incluye_desc: '' }
      : { sabores: {min:0, max:0}, toppings: {min:0, max:0}, coberturas: {min:0, max:0}, extras: [], incluye_desc: '' }
  } : db.getProductById(editingId);

  if (!p) return '';

  // ── Si es PROMOCIONES, delegar al panel especializado ──
  if (p.categoria === 'PROMOCIONES') {
    return renderPromoConfigPanel(p);
  }

  return `
    <div class="config-panel-header">
      <div style="display:flex; align-items:center; gap: 12px;">
        <span style="font-size: 32px;">${p.emoji || '🍦'}</span>
        <div>
          <h3 style="margin:0;">Configurar</h3>
          <p style="margin:0; font-size: 13px; color: var(--text-muted);">${p.nombre || 'Nuevo Producto'}</p>
        </div>
      </div>
      <button class="modal-close" id="btn-close-config">&times;</button>
    </div>

    <div class="config-panel-body">
      <!-- Datos Básicos -->
      <div class="config-group" style="position:relative; overflow:visible;">
        <label class="config-label">📝 Datos Generales</label>
        
        <div style="display:flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; width: 100%; align-items: flex-end; position: relative; z-index: 5;">
          <div style="width: 80px;">
            <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 6px;">Emoji</label>
            <input type="text" id="config-emoji" class="form-input" value="${p.emoji || '🍦'}" style="text-align: center; font-size: 24px; padding: 8px; border-radius: 12px; background: rgba(0,0,0,0.2); margin:0;" />
          </div>
          
          <div style="flex: 1; min-width: 150px;">
            <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 6px;">Nombre del Producto</label>
            <input type="text" id="config-name" class="form-input" value="${p.nombre}" placeholder="Ej: Waffle Tradicional" style="font-size: 14px; padding: 12px; margin:0;" />
          </div>
          
          <div style="width: 100px;">
            <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 6px;">Precio ($)</label>
            <input type="number" id="config-price" class="form-input" value="${p.precio}" step="0.01" min="0" style="font-size: 15px; font-weight: bold; color: var(--accent-mint); text-align: center; padding: 12px; margin:0;" />
          </div>
        </div>

        <div style="position:absolute; top:-20px; right:-10px; font-size:90px; opacity:0.04; pointer-events:none; z-index: 1;">${p.emoji || '🍦'}</div>
      </div>

      <!-- Gestión de Sabores -->
      <div class="config-group">
        <div class="config-label-row">
          <label class="config-label">🍨 Límite de Sabores</label>
          <span class="config-badge">${db.SABORES_HELADO.length} Sabores activos</span>
        </div>
        <p style="font-size: 11px; color: var(--text-muted); margin-top: -4px;">Configura cuántos sabores puede elegir el cliente.</p>
        <div class="config-limits">
          <div class="limit-input-group">
            <label>Mínimo obligatorio</label>
            <input type="number" id="limit-sabores-min" class="limit-field" value="${p.opciones?.sabores?.min || 0}" min="0" />
          </div>
          <div class="limit-input-group">
            <label>Máximo permitido</label>
            <input type="number" id="limit-sabores-max" class="limit-field" value="${p.opciones?.sabores?.max || 0}" min="0" />
          </div>
        </div>
      </div>

      <!-- Gestión de Coberturas -->
      <div class="config-group">
        <div class="config-label-row">
          <label class="config-label">🍯 Límite de Coberturas</label>
          <span class="config-badge">${db.COBERTURAS_LIQUIDAS.length} Coberturas activas</span>
        </div>
        <p style="font-size: 11px; color: var(--text-muted); margin-top: -4px;">Configura cuántas coberturas líquidas incluye.</p>
        <div class="config-limits">
          <div class="limit-input-group">
            <label>Mínimo obligatorio</label>
            <input type="number" id="limit-coberturas-min" class="limit-field" value="${p.opciones?.coberturas?.min || 0}" min="0" />
          </div>
          <div class="limit-input-group">
            <label>Máximo permitido</label>
            <input type="number" id="limit-coberturas-max" class="limit-field" value="${p.opciones?.coberturas?.max || 0}" min="0" />
          </div>
        </div>
      </div>

      <!-- Gestión de Toppings -->
      <div class="config-group">
        <div class="config-label-row">
          <label class="config-label">🍬 Límite de Toppings</label>
          <span class="config-badge">${db.TOPPINGS.length} Toppings activos</span>
        </div>
        <p style="font-size: 11px; color: var(--text-muted); margin-top: -4px;">Configura la variedad de toppings secos a incluir.</p>
        <div class="config-limits">
          <div class="limit-input-group">
            <label>Mínimo obligatorio</label>
            <input type="number" id="limit-toppings-min" class="limit-field" value="${p.opciones?.toppings?.min || 0}" min="0" />
          </div>
          <div class="limit-input-group">
            <label>Máximo permitido</label>
            <input type="number" id="limit-toppings-max" class="limit-field" value="${p.opciones?.toppings?.max || 0}" min="0" />
          </div>
        </div>
      </div>

      <!-- Gestión de Extras -->
      <div class="config-group">
        <label class="config-label">➕ Extras Automáticos</label>
        <p style="font-size: 11px; color: var(--text-muted); margin-top: -4px;">Elige qué extras de pago se sugieren para este producto.</p>
        <div class="config-item-list">
          ${db.EXTRAS.map(ex => {
            const isEnabled = p.opciones?.extras?.includes(ex.nombre);
            return `
              <label class="config-chip" style="display:flex; align-items:center; gap:8px; cursor:pointer; transition: 0.2s ease; ${isEnabled ? 'background:var(--accent-pink-glow); border-color:var(--accent-pink); color: #fff;' : 'background: rgba(0,0,0,0.2);'}">
                <input type="checkbox" class="extra-check" data-extra="${ex.nombre}" ${isEnabled ? 'checked' : ''} style="accent-color: var(--accent-pink); transform: scale(1.2);" />
                <span>${ex.nombre} <b style="color:var(--accent-mint);">+$${ex.precio.toFixed(2)}</b></span>
              </label>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Notas y Detalles -->
      <div class="config-group">
        <label class="config-label">📝 Descripción del Producto</label>
        <p style="font-size: 11px; color: var(--text-muted); margin-top: -4px;">¿Qué ingredientes incluye por defecto? (Se mostrará en cocina).</p>
        <textarea id="config-desc" class="form-input" style="height: 60px; font-size: 13px; resize: none; border-radius: 8px;">${p.opciones?.incluye_desc || ''}</textarea>
      </div>
    </div>

    <div class="config-footer">
      <button class="btn btn-ghost" id="btn-config-cancel">Cancelar</button>
      <button class="btn btn-primary" id="btn-config-save">Guardar Cambios</button>
    </div>
  `;
}

// ============================================================
// 🏆 Panel especializado para PROMOCIONES (combos)
// ============================================================
function renderPromoConfigPanel(p) {
  const promo  = p.opciones?.promo || {};
  const pp     = promo.perProduct || {};
  const cant   = promo.cantidad || 2;
  const lbl    = promo.label   || 'Producto';

  const sabMin = pp.sabores?.min   ?? 1;
  const sabMax = pp.sabores?.max   ?? 1;
  const cobMin = pp.coberturas?.min ?? 1;
  const cobMax = pp.coberturas?.max ?? 1;
  const topMin = pp.toppings?.min  ?? 0;
  const topMax = pp.toppings?.max  ?? 0;

  return `
    <div class="config-panel-header">
      <div style="display:flex; align-items:center; gap: 12px;">
        <span style="font-size: 32px;">${p.emoji || '🏆'}</span>
        <div>
          <h3 style="margin:0;">🏆 Configurar Promo</h3>
          <p style="margin:0; font-size: 13px; color: var(--accent-mint);">${p.nombre || 'Nueva Promoción'}</p>
        </div>
      </div>
      <button class="modal-close" id="btn-close-config">&times;</button>
    </div>

    <div class="config-panel-body">

      <!-- ── Sección A: Datos Generales ── -->
      <div class="config-group" style="position:relative; overflow:visible;">
        <label class="config-label">📝 Datos de la Promoción</label>
        <div style="display:flex; flex-wrap:wrap; gap:12px; margin-top:12px; align-items:flex-end; position:relative; z-index:5;">

          <div style="width:80px;">
            <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:6px;">Emoji</label>
            <input type="text" id="config-emoji" class="form-input" value="${p.emoji || '🏆'}"
              style="text-align:center; font-size:24px; padding:8px; border-radius:12px; background:rgba(0,0,0,0.2); margin:0;" />
          </div>

          <div style="flex:1; min-width:150px;">
            <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:6px;">Nombre de la Promoción</label>
            <input type="text" id="config-name" class="form-input" value="${p.nombre}"
              placeholder="Ej: Promo 2 Copas Queso"
              style="font-size:14px; padding:12px; margin:0;" />
          </div>

          <div style="width:110px;">
            <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:6px;">Precio ($)</label>
            <input type="number" id="config-price" class="form-input" value="${p.precio}"
              step="0.01" min="0"
              style="font-size:15px; font-weight:bold; color:var(--accent-mint); text-align:center; padding:12px; margin:0;" />
          </div>
        </div>
        <div style="position:absolute; top:-20px; right:-10px; font-size:90px; opacity:0.04; pointer-events:none; z-index:1;">${p.emoji || '🏆'}</div>
      </div>

      <!-- ── Sección B: Configuración del Combo ── -->
      <div class="config-group" style="border: 1px solid rgba(var(--accent-mint-rgb, 78,205,196), 0.25); border-radius:12px; background: rgba(78,205,196,0.04);">
        <div class="config-label-row">
          <label class="config-label" style="color:var(--accent-mint);">🏆 Estructura del Combo</label>
          <span class="config-badge" style="background:rgba(78,205,196,0.15); color:var(--accent-mint);">PROMOCIÓN</span>
        </div>
        <p style="font-size:11px; color:var(--text-muted); margin-top:-4px;">Define cuántos sub-productos incluye este combo y cómo se llaman.</p>

        <div style="display:flex; gap:12px; margin-top:14px; flex-wrap:wrap;">

          <div style="flex:1; min-width:120px;">
            <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:8px;">Cantidad de productos en el combo</label>
            <div style="display:flex; align-items:center; gap:8px;">
              <button type="button" id="btn-promo-cant-minus" style="width:36px; height:36px; border-radius:50%; border:1px solid rgba(255,255,255,0.15); background:rgba(0,0,0,0.3); color:#fff; font-size:18px; cursor:pointer; display:flex; align-items:center; justify-content:center;">−</button>
              <input type="number" id="promo-cantidad" class="limit-field" value="${cant}" min="2" max="10"
                style="width:64px; text-align:center; font-size:22px; font-weight:800; color:var(--accent-mint); background:rgba(0,0,0,0.3); border-radius:8px;" />
              <button type="button" id="btn-promo-cant-plus" style="width:36px; height:36px; border-radius:50%; border:1px solid rgba(255,255,255,0.15); background:rgba(0,0,0,0.3); color:#fff; font-size:18px; cursor:pointer; display:flex; align-items:center; justify-content:center;">+</button>
            </div>
          </div>

          <div style="flex:2; min-width:160px;">
            <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:8px;">Nombre genérico del sub-producto</label>
            <input type="text" id="promo-label" class="form-input" value="${lbl}"
              placeholder="Ej: Copa, Waffle, Tulipán..."
              style="font-size:14px; padding:10px; margin:0; text-transform:capitalize;" />
            <span style="font-size:10px; color:var(--text-muted); display:block; margin-top:4px;">Se mostrará como: Producto 1 · Producto 2 · ...</span>
          </div>

        </div>
      </div>

      <!-- ── Sección C: Opciones por cada sub-producto ── -->
      <div class="config-group">
        <div class="config-label-row">
          <label class="config-label">⚙️ Opciones por cada sub-producto</label>
          <span class="config-badge" id="promo-sublabel-badge">Por cada ${lbl}</span>
        </div>
        <p style="font-size:11px; color:var(--text-muted); margin-top:-4px;">
          Define cuántos sabores, coberturas y toppings puede pedir el cliente <b>por cada sub-producto</b> del combo.
        </p>

        <div style="display:flex; flex-direction:column; gap:10px; margin-top:14px;">

          <!-- Sabores -->
          <div style="background:rgba(0,0,0,0.2); border-radius:10px; padding:12px 14px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
              <span style="font-size:16px;">🍨</span>
              <span style="font-size:13px; font-weight:600;">Sabores de helado</span>
            </div>
            <div class="config-limits" style="margin-top:0;">
              <div class="limit-input-group">
                <label>Mínimo obligatorio</label>
                <input type="number" id="promo-sab-min" class="limit-field" value="${sabMin}" min="0" />
              </div>
              <div class="limit-input-group">
                <label>Máximo permitido</label>
                <input type="number" id="promo-sab-max" class="limit-field" value="${sabMax}" min="0" />
              </div>
            </div>
          </div>

          <!-- Coberturas -->
          <div style="background:rgba(0,0,0,0.2); border-radius:10px; padding:12px 14px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
              <span style="font-size:16px;">🍯</span>
              <span style="font-size:13px; font-weight:600;">Coberturas líquidas</span>
            </div>
            <div class="config-limits" style="margin-top:0;">
              <div class="limit-input-group">
                <label>Mínimo obligatorio</label>
                <input type="number" id="promo-cob-min" class="limit-field" value="${cobMin}" min="0" />
              </div>
              <div class="limit-input-group">
                <label>Máximo permitido</label>
                <input type="number" id="promo-cob-max" class="limit-field" value="${cobMax}" min="0" />
              </div>
            </div>
          </div>

          <!-- Toppings -->
          <div style="background:rgba(0,0,0,0.2); border-radius:10px; padding:12px 14px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
              <span style="font-size:16px;">🍬</span>
              <span style="font-size:13px; font-weight:600;">Toppings</span>
            </div>
            <div class="config-limits" style="margin-top:0;">
              <div class="limit-input-group">
                <label>Mínimo obligatorio</label>
                <input type="number" id="promo-top-min" class="limit-field" value="${topMin}" min="0" />
              </div>
              <div class="limit-input-group">
                <label>Máximo permitido</label>
                <input type="number" id="promo-top-max" class="limit-field" value="${topMax}" min="0" />
              </div>
            </div>
          </div>

        </div>

        <!-- Totales calculados automáticamente -->
        <div id="promo-totals-preview" style="margin-top:14px; background:rgba(78,205,196,0.08); border:1px solid rgba(78,205,196,0.2); border-radius:8px; padding:10px 14px; font-size:11px; color:var(--text-muted);">
          📊 <b style="color:var(--accent-mint);">Total del combo:</b>
          ${cant} × (${sabMax} sab + ${cobMax} cob + ${topMax} top)
          = <b style="color:#fff;">${cant * sabMax} sabores · ${cant * cobMax} coberturas · ${cant * topMax} toppings</b>
        </div>
      </div>

      <!-- ── Sección D: Descripción para cocina ── -->
      <div class="config-group">
        <label class="config-label">📝 Descripción para Cocina</label>
        <p style="font-size:11px; color:var(--text-muted); margin-top:-4px;">¿Qué incluye este combo? (Se mostrará en cocina y en el ticket).</p>
        <textarea id="config-desc" class="form-input" style="height:60px; font-size:13px; resize:none; border-radius:8px;">${p.opciones?.incluye_desc || ''}</textarea>
      </div>

    </div>

    <div class="config-footer">
      <button class="btn btn-ghost" id="btn-config-cancel">Cancelar</button>
      <button class="btn btn-primary" id="btn-config-save">💾 Guardar Promo</button>
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

  // Manage Categories button
  const btnManageCats = document.getElementById('btn-manage-cats');
  if (btnManageCats) {
    btnManageCats.addEventListener('click', () => {
      showCategoryModal = true;
      rerender();
    });
  }

  // Category Modal Events
  if (showCategoryModal) {
    const closeCatModal = () => {
      showCategoryModal = false;
      rerender();
    };

    document.getElementById('btn-close-cat-modal')?.addEventListener('click', closeCatModal);
    document.getElementById('btn-finish-cats')?.addEventListener('click', closeCatModal);
    document.getElementById('cat-modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'cat-modal-overlay') closeCatModal();
    });

    // Add Category
    document.getElementById('btn-add-cat')?.addEventListener('click', async () => {
      const input = document.getElementById('new-cat-name');
      const name = input.value.trim();
      if (!name) return;
      await db.addCategory(name);
      input.value = '';
      rerender();
    });

    // Save/Update Category
    document.querySelectorAll('.btn-save-cat').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.id);
        const input = document.querySelector(`.cat-input-edit[data-id="${id}"]`);
        const newName = input.value.trim();
        if (newName) {
          await db.updateCategory(id, newName);
          window.showToast('✅ Categoría actualizada', 'success');
          rerender();
        }
      });
    });

    // Delete Category
    document.querySelectorAll('.btn-delete-cat').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.id);
        try {
          await db.deleteCategory(id);
          window.showToast('🗑️ Categoría eliminada', 'info');
          rerender();
        } catch (e) {
          window.showToast(`❌ ${e.message}`, 'error');
        }
      });
    });
  }

  // Manage Opciones button
  const btnManageOpts = document.getElementById('btn-manage-opts');
  if (btnManageOpts) {
    btnManageOpts.addEventListener('click', () => {
      showOpcionesModal = true;
      rerender();
    });
  }

  // Opciones Modal Events
  if (showOpcionesModal) {
    const closeOptModal = () => {
      showOpcionesModal = false;
      rerender();
    };

    document.getElementById('btn-close-opt-modal')?.addEventListener('click', closeOptModal);
    document.getElementById('btn-finish-opts')?.addEventListener('click', closeOptModal);
    document.getElementById('opt-modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'opt-modal-overlay') closeOptModal();
    });

    document.querySelectorAll('.opt-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentOpcionesTab = btn.dataset.tab;
        rerender();
      });
    });

    // Save extra option prices (per type)
    document.getElementById('btn-save-precios-extra')?.addEventListener('click', () => {
      const sabores = parseFloat(document.getElementById('precio-extra-sabores')?.value) || 1.00;
      const coberturas = parseFloat(document.getElementById('precio-extra-coberturas')?.value) || 0.20;
      const toppings = parseFloat(document.getElementById('precio-extra-toppings')?.value) || 0.20;
      db.setPreciosExtra({ sabores, coberturas, toppings });
      window.showToast(`✅ Precios actualizados: Sabor $${sabores.toFixed(2)}, Cobert. $${coberturas.toFixed(2)}, Topping $${toppings.toFixed(2)}`, 'success');
    });

    document.getElementById('btn-add-opt')?.addEventListener('click', () => {
      const nameInput = document.getElementById('new-opt-name');
      const nombre = nameInput.value.trim();
      const precioInput = document.getElementById('new-opt-price');
      const precio = precioInput ? parseFloat(precioInput.value) || 0 : 0;
      
      if (!nombre) return;
      db.addOpcion({ nombre, tipo: currentOpcionesTab, activo: true, precio });
      nameInput.value = '';
      if(precioInput) precioInput.value = '';
      rerender();
    });

    document.querySelectorAll('.btn-save-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        const nameInput = document.querySelector(`.opt-input-name[data-id="${id}"]`);
        const priceInput = document.querySelector(`.opt-input-price[data-id="${id}"]`);
        
        const updates = { nombre: nameInput.value.trim() };
        if (priceInput) updates.precio = parseFloat(priceInput.value) || 0;
        
        db.updateOpcion(id, updates);
        window.showToast('✅ Opción actualizada', 'success');
        rerender();
      });
    });

    document.querySelectorAll('.opt-toggle-active').forEach(toggle => {
      toggle.addEventListener('change', () => {
        const id = Number(toggle.dataset.id);
        db.updateOpcion(id, { activo: toggle.checked });
        window.showToast(toggle.checked ? '✅ Activado' : '⏸️ Desactivado', 'info');
        rerender();
      });
    });

    document.querySelectorAll('.btn-delete-opt').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.id);
        const confirmed = await window.showConfirm({
          icon: '🗑️',
          title: `¿Eliminar opción?`,
          message: 'Esta acción la eliminará de forma permanente.',
          confirmText: '🗑️ Eliminar',
          confirmClass: 'btn-danger',
        });
        if (confirmed) {
          db.deleteOpcion(id);
          window.showToast('🗑️ Opción eliminada', 'info');
          rerender();
        }
      });
    });
  }

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
  if (btnAdd) btnAdd.addEventListener('click', () => {
    editingId = -1; // Special ID for new product
    showConfigPanel = true;
    rerender();
  });

  // Export/Import buttons
  const btnExport = document.getElementById('btn-export-catalog');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      const data = {
        productos: db.getProducts(),
        opciones: db.getOpcionesColeccion()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'catalogo_yoguice.json';
      a.click();
      URL.revokeObjectURL(url);
      window.showToast('Catálogo exportado exitosamente.', 'success');
    });
  }

  const btnImport = document.getElementById('btn-import-catalog');
  if (btnImport) {
    btnImport.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const data = JSON.parse(event.target.result);
            if (data.productos && data.opciones) {
              const confirm = await window.showConfirm({
                title: 'Importar Catálogo',
                message: `¿Estás seguro de importar ${data.productos.length} productos y ${data.opciones.length} opciones? Se añadirán a tu base de datos y podrían sobrescribir los actuales.`,
                confirmText: 'Importar'
              });
              
              if (confirm) {
                window.showToast('Importando... espera un momento', 'info');
                // The correct functions in db.js for external pushing might be updateProduct, or pushing directly to Firebase logic.
                // Wait! To ensure everything stays in sync with Firebase, since they are new items, we can just call the core add/update functions. But we want to preserve IDs so references don't break.
                // It's much easier to just use `updateProduct(p.id, p)` which creates it if it uses setDoc, or just rely on a new db helper. Let's just create a new helper in `db.js` if needed, or simple direct writes.
                // Actually `db.addProduct` ignores custom ID. I will write a small loop here that does a manual localStorage set + dispatch local event. Wait, this must go to Firebase!
                // Best way: create a `db.importCatalog(data)` function in db.js to handle the raw Firebase writes cleanly.
                await db.importCatalog(data);
                window.showToast('¡Catálogo importado exitosamente!', 'success');
                setTimeout(() => window.location.reload(), 1500);
              }
            } else {
              window.showToast('El archivo JSON no tiene el formato correcto.', 'error');
            }
          } catch (err) {
            window.showToast('Error al leer el archivo.', 'error');
            console.error(err);
          }
        };
        reader.readAsText(file);
      };
      input.click();
    });
  }

  // Open Config (Edit)
  document.querySelectorAll('[data-edit-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      editingId = Number(btn.dataset.editId);
      showConfigPanel = true;
      rerender();
    });
  });

  // Delete product (Permanent delete)
  document.querySelectorAll('[data-delete-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const product = db.getProductById(Number(btn.dataset.deleteId));
      if (!product) return;

      const confirmed = await window.showConfirm({
        icon: '🗑️',
        title: `¿Eliminar "${product.nombre}"?`,
        message: 'Esta acción borrará el producto de forma permanente. Si solo quieres ocultarlo, usa el interruptor.',
        confirmText: '🗑️ Eliminar',
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
      const nombre = document.getElementById('config-name')?.value.trim();
      const emoji  = document.getElementById('config-emoji')?.value.trim() || '🍦';
      const precio = parseFloat(document.getElementById('config-price')?.value) || 0;
      const incluye_desc = document.getElementById('config-desc')?.value.trim() || '';

      if (!nombre) {
        window.showToast('❌ El nombre es obligatorio', 'error');
        return;
      }

      // ── Detectar si es PROMOCIÓN ──
      const isPromoSave = activeCategory === 'PROMOCIONES' ||
        (editingId !== -1 && db.getProductById(editingId)?.categoria === 'PROMOCIONES');

      let opciones;

      if (isPromoSave) {
        // Leer campos del panel de promo
        const cantidad  = Math.max(2, parseInt(document.getElementById('promo-cantidad')?.value) || 2);
        const label     = document.getElementById('promo-label')?.value.trim() || 'Producto';
        const sabMin    = parseInt(document.getElementById('promo-sab-min')?.value)  || 0;
        const sabMax    = parseInt(document.getElementById('promo-sab-max')?.value)  || 0;
        const cobMin    = parseInt(document.getElementById('promo-cob-min')?.value)  || 0;
        const cobMax    = parseInt(document.getElementById('promo-cob-max')?.value)  || 0;
        const topMin    = parseInt(document.getElementById('promo-top-min')?.value)  || 0;
        const topMax    = parseInt(document.getElementById('promo-top-max')?.value)  || 0;

        const perProduct = {
          sabores:    { min: sabMin,  max: sabMax  },
          coberturas: { min: cobMin,  max: cobMax  },
          toppings:   { min: topMin,  max: topMax  },
        };

        // Los totales se calculan automáticamente para compatibilidad con ventas.js
        opciones = {
          promo: { cantidad, label, perProduct },
          sabores:    { min: cantidad * sabMin, max: cantidad * sabMax },
          coberturas: { min: cantidad * cobMin, max: cantidad * cobMax },
          toppings:   { min: cantidad * topMin, max: cantidad * topMax },
          incluye_desc,
        };
      } else {
        // Panel estándar
        const extras = Array.from(document.querySelectorAll('.extra-check:checked')).map(el => el.dataset.extra);
        opciones = {
          sabores:    { min: parseInt(document.getElementById('limit-sabores-min')?.value)    || 0, max: parseInt(document.getElementById('limit-sabores-max')?.value)    || 0 },
          coberturas: { min: parseInt(document.getElementById('limit-coberturas-min')?.value) || 0, max: parseInt(document.getElementById('limit-coberturas-max')?.value) || 0 },
          toppings:   { min: parseInt(document.getElementById('limit-toppings-min')?.value)   || 0, max: parseInt(document.getElementById('limit-toppings-max')?.value)   || 0 },
          extras,
          incluye_desc,
        };
      }

      if (editingId === -1) {
        await db.addProduct({ nombre, precio, emoji, categoria: activeCategory, activo: true, opciones });
        window.showToast('✨ Producto creado exitosamente', 'success');
      } else {
        await db.updateProduct(editingId, { nombre, precio, emoji, opciones });
        window.showToast('✅ Configuración guardada', 'success');
      }
      close();
    });
  }

  // ── Controles interactivos del panel de promo ──
  // Botones +/− para la cantidad de sub-productos
  document.getElementById('btn-promo-cant-plus')?.addEventListener('click', () => {
    const inp = document.getElementById('promo-cantidad');
    if (inp) { inp.value = Math.min(10, (parseInt(inp.value) || 2) + 1); updatePromoTotalsPreview(); }
  });
  document.getElementById('btn-promo-cant-minus')?.addEventListener('click', () => {
    const inp = document.getElementById('promo-cantidad');
    if (inp) { inp.value = Math.max(2, (parseInt(inp.value) || 2) - 1); updatePromoTotalsPreview(); }
  });
  // Actualizar preview cuando cambian los campos numéricos o el label
  ['promo-cantidad','promo-sab-max','promo-cob-max','promo-top-max'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updatePromoTotalsPreview);
  });
  document.getElementById('promo-label')?.addEventListener('input', () => {
    const badge = document.getElementById('promo-sublabel-badge');
    const lbl = document.getElementById('promo-label')?.value.trim() || 'Producto';
    if (badge) badge.textContent = `Por cada ${lbl}`;
    updatePromoTotalsPreview();
  });
}

function updatePromoTotalsPreview() {
  const preview = document.getElementById('promo-totals-preview');
  if (!preview) return;
  const cant   = parseInt(document.getElementById('promo-cantidad')?.value) || 2;
  const sabMax = parseInt(document.getElementById('promo-sab-max')?.value)  || 0;
  const cobMax = parseInt(document.getElementById('promo-cob-max')?.value)  || 0;
  const topMax = parseInt(document.getElementById('promo-top-max')?.value)  || 0;
  preview.innerHTML = `📊 <b style="color:var(--accent-mint);">Total del combo:</b>
    ${cant} × (${sabMax} sab + ${cobMax} cob + ${topMax} top)
    = <b style="color:#fff;">${cant * sabMax} sabores · ${cant * cobMax} coberturas · ${cant * topMax} toppings</b>`;
}

function rerender() {
  const container = document.getElementById('page-container');
  if (container) {
    // Preserve focus and cursor position
    const activeEl = document.activeElement;
    const isSearchInput = activeEl && activeEl.id === 'admin-search';
    const selectionStart = isSearchInput ? activeEl.selectionStart : null;
    const selectionEnd = isSearchInput ? activeEl.selectionEnd : null;

    container.innerHTML = render();
    init();

    // Restore focus and cursor
    if (isSearchInput) {
      const newSearchInput = document.getElementById('admin-search');
      if (newSearchInput) {
        newSearchInput.focus();
        newSearchInput.setSelectionRange(selectionStart, selectionEnd);
      }
    }
  }
}

export function cleanup() {}
