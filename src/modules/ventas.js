// ========================================
// 🍦 Heladería POS - Ventas Module (Optimized)
// ========================================

import * as db from '../db.js';
import { formatCurrency, formatTime } from '../main.js';

// --- State ---
let activeCuentaId = null;
let wizardStep = 'categories';
let wizardCategory = null;
let configuringProduct = null;
let showMesaSelector = false;
let selectedVariant = null;
let selectedSabores = new Set();
let selectedCoberturas = new Set();
let selectedToppings = new Set();
let selectedExtras = new Set();
let selectedNotas = new Set();

let currentModifier = 'normal';
let lastAddedConfigId = null;

let isListenersAttached = false;
let pendingRenders = new Set();
let renderTimeoutId = null;

// --- Helpers ---
const isMobile = () => window.innerWidth < 1024;

function getTimeSince(timestamp) {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
}

// --- Wizard State Machine ---
function resetWizard() {
  wizardStep = 'categories';
  wizardCategory = null;
  configuringProduct = null;
  selectedVariant = null;
  selectedSabores.clear();
  selectedCoberturas.clear();
  selectedToppings.clear();
  selectedExtras.clear();
  selectedNotas.clear();
}

function advanceWizardStep() {
  const p = configuringProduct;
  if (!p || !p.opciones) {
    addCurrentWizardProduct();
    return;
  }

  if (wizardStep === 'products') {
    if (p.opciones.sabores?.max > 0) wizardStep = 'sabores';
    else if (p.opciones.coberturas?.max > 0) wizardStep = 'coberturas';
    else if (p.opciones.toppings?.max > 0) wizardStep = 'toppings';
    else wizardStep = 'extras_notas';
  } else if (wizardStep === 'sabores') {
    if (p.opciones.coberturas?.max > 0) wizardStep = 'coberturas';
    else if (p.opciones.toppings?.max > 0) wizardStep = 'toppings';
    else wizardStep = 'extras_notas';
  } else if (wizardStep === 'coberturas') {
    if (p.opciones.toppings?.max > 0) wizardStep = 'toppings';
    else wizardStep = 'extras_notas';
  } else if (wizardStep === 'toppings') {
    wizardStep = 'extras_notas';
  } else if (wizardStep === 'extras_notas') {
    addCurrentWizardProduct();
  }

  currentModifier = 'normal';
  rerender('wizard');
}

function goWizardBack() {
  const p = configuringProduct;
  if (wizardStep === 'products') {
    wizardStep = 'categories';
    wizardCategory = null;
  } else if (wizardStep === 'sabores') {
    wizardStep = 'products';
    configuringProduct = null;
  } else if (wizardStep === 'coberturas') {
    if (p.opciones.sabores?.max > 0) wizardStep = 'sabores';
    else { wizardStep = 'products'; configuringProduct = null; }
  } else if (wizardStep === 'toppings') {
    if (p.opciones.coberturas?.max > 0) wizardStep = 'coberturas';
    else if (p.opciones.sabores?.max > 0) wizardStep = 'sabores';
    else { wizardStep = 'products'; configuringProduct = null; }
  } else if (wizardStep === 'extras_notas') {
    if (p.opciones.toppings?.max > 0) wizardStep = 'toppings';
    else if (p.opciones.coberturas?.max > 0) wizardStep = 'coberturas';
    else if (p.opciones.sabores?.max > 0) wizardStep = 'sabores';
    else { wizardStep = 'products'; configuringProduct = null; }
  }

  currentModifier = 'normal';
  rerender('wizard');
}

function addCurrentWizardProduct() {
  const p = configuringProduct;
  const config = {
    variante: selectedVariant,
    sabores: [...selectedSabores],
    coberturas: [...selectedCoberturas],
    toppings: [...selectedToppings],
    extras: [...selectedExtras].map(en => db.EXTRAS.find(ex => ex.nombre === en)).filter(Boolean),
    notas: [...selectedNotas]
  };
  lastAddedConfigId = p.id;
  db.addItemToCuenta(activeCuentaId, p, config).then(() => {
    wizardStep = 'success';
    rerender('wizard');
    rerender('panel');
    setTimeout(() => { lastAddedConfigId = null; rerender('panel'); }, 700);
  });
}

// --- Renderers ---

function renderCuentasBar() {
  const cuentasAbiertas = db.getCuentasAbiertas();
  const apertura = db.getAperturaHoy();
  const isAperturaActiva = apertura && apertura.estado === 'abierto';

  return `
    <div class="cuentas-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 16px; gap: 12px;">
      <div style="display:flex; align-items:center; gap:12px; flex: 1;">
        <button class="mobile-menu-btn" data-action="toggle-sidebar" style="padding:8px; border:none; border-radius:8px; background:rgba(255,255,255,0.05); color:#fff; cursor:pointer; transition:background 0.2s;" title="Menú">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
        <h3 style="margin:0; font-size:20px; font-weight:800; white-space:nowrap; letter-spacing:-0.5px;">🎟️ Cuentas</h3>
      </div>
      <button class="btn btn-primary btn-sm" data-action="nueva-cuenta" ${!isAperturaActiva ? 'style="opacity:0.5; cursor:not-allowed;" title="Primero abre el día"' : ''} style="display:flex; align-items:center; gap:6px; padding:10px 16px; border-radius:24px; font-weight:700; flex-shrink:0; box-shadow:0 4px 12px rgba(255,107,157,0.3);">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        Nueva Cuenta
      </button>
    </div>
    <div class="cuentas-list" id="cuentas-list">
      ${cuentasAbiertas.length === 0 ? `
        <div class="cuentas-empty">
          <span>No hay cuentas abiertas</span>
          <span class="cuentas-empty-hint">Crea una para empezar a vender</span>
        </div>
      ` : cuentasAbiertas.map(c => `
        <button class="cuenta-card ${activeCuentaId === c.id ? 'active' : ''}" data-action="select-cuenta" data-id="${c.id}">
          <div class="cuenta-card-number">#${c.numero}${c.mesa ? ` <span class="mesa-badge">MESA ${c.mesa}</span>` : ''}</div>
          <div class="cuenta-card-total">${formatCurrency(c.total)}</div>
          <div class="cuenta-card-meta">
            <span>${c.items.length} items</span>
            <span>⏱ ${getTimeSince(c.timestamp_apertura)}</span>
          </div>
        </button>
      `).join('')}
    </div>
  `;
}

const categoryIcons = {
  'WAFFLES': '🧇', 'TULIPANES': '🍧', 'COPAS': '🍨', 'POSTRES': '🍰',
  'TORTAS HELADAS': '🎂', 'BEBIDAS': '🥤', 'PROMOCIONES': '🏷️', 'HELADOS': '🍦', 'BANANA SPLIT': '🍌'
};

const categoryColors = {
  'WAFFLES': 'cat-waffles', 'TULIPANES': 'cat-tulipanes', 'COPAS': 'cat-copas',
  'POSTRES': 'cat-postres', 'TORTAS HELADAS': 'cat-tortas', 'BEBIDAS': 'cat-bebidas',
  'PROMOCIONES': 'cat-promociones'
};

function getOptionColorClass(tipo, nombre) {
  if (tipo !== 'sabor') return '';
  const n = nombre.toLowerCase();
  if (n.includes('choco')) return 'sabor-chocolate';
  if (n.includes('vaini')) return 'sabor-vainilla';
  if (n.includes('fresa')) return 'sabor-fresa';
  if (n.includes('mora')) return 'sabor-mora';
  if (n.includes('marac')) return 'sabor-maracuya';
  if (n.includes('chicle')) return 'sabor-chicle';
  return 'sabor-default';
}

function renderWizard() {
  if (wizardStep === 'categories') return renderWizardCategories();
  if (wizardStep === 'products') return renderWizardProducts();
  if (wizardStep === 'sabores' || wizardStep === 'coberturas' || wizardStep === 'toppings') return renderWizardOptions(wizardStep);
  if (wizardStep === 'extras_notas') return renderWizardExtrasNotas();
  if (wizardStep === 'success') return renderWizardSuccess();
  if (wizardStep === 'review') return renderWizardReview();
  return '';
}

function renderWizardHeader(title, subtitle, stepIdx, totalSteps) {
  const dots = Array.from({ length: totalSteps }).map((_, i) =>
    `<div class="wizard-step-dot ${i === stepIdx ? 'active' : (i < stepIdx ? 'completed' : '')}"></div>`
  ).join('');

  return `
    <div class="wizard-header">
      ${wizardStep !== 'categories' && wizardStep !== 'success' ? `<button class="wizard-back-btn" data-action="wizard-back">←</button>` : `<div style="width:40px"></div>`}
      <div class="wizard-title">
        <h2>${title}</h2>
        ${subtitle ? `<p>${subtitle}</p>` : ''}
      </div>
      <div class="wizard-progress">${dots}</div>
    </div>
  `;
}

function renderWizardCategories() {
  const products = db.getActiveProducts();
  const categories = Array.from(new Set(products.map(p => p.categoria)));

  return `
    <div class="wizard-main">
      ${renderWizardHeader('¿Qué desea el cliente?', 'Selecciona una categoría', 0, 5)}
      <div class="wizard-body">
        <div class="wizard-cat-grid">
          ${categories.map(c => `
            <button class="wizard-btn ${categoryColors[c] || 'cat-default'}" data-action="wizard-sel-cat" data-val="${c}">
              <span class="wizard-btn-emoji">${categoryIcons[c] || '📁'}</span>
              <span>${c}</span>
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderWizardProducts() {
  const products = db.getActiveProducts();
  let displayProducts = products.filter(p => p.categoria === wizardCategory);

  return `
    <div class="wizard-main">
      ${renderWizardHeader(`${categoryIcons[wizardCategory] || '📁'} ${wizardCategory}`, 'Selecciona el producto', 1, 5)}
      <div class="wizard-body">
        <div class="wizard-prod-grid">
          ${displayProducts.map(p => `
            <button class="wizard-btn cat-default" style="padding:16px 8px;" data-action="wizard-sel-prod" data-id="${p.id}" ${!activeCuentaId ? 'disabled style="opacity:0.5"' : ''} title="${!activeCuentaId ? 'Abre una cuenta primero' : ''}">
              <span class="wizard-btn-emoji" style="font-size:32px;">${p.emoji || '🍦'}</span>
              <span>${p.nombre}</span>
              <span style="color:var(--accent-mint); font-weight:800; font-size:14px; margin-top:4px;">${formatCurrency(p.precio)}</span>
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderWizardOptions(tipo) {
  const p = configuringProduct;
  const optConfig = p.opciones?.[tipo] || { min: 0, max: 0 };
  const list = tipo === 'sabores' ? db.SABORES_HELADO : (tipo === 'coberturas' ? db.COBERTURAS_LIQUIDAS : db.TOPPINGS);
  const selectedSet = tipo === 'sabores' ? selectedSabores : (tipo === 'coberturas' ? selectedCoberturas : selectedToppings);
  const title = tipo.charAt(0).toUpperCase() + tipo.slice(1);
  const stepIdx = tipo === 'sabores' ? 2 : (tipo === 'coberturas' ? 3 : 4);

  const reachedMax = selectedSet.size >= optConfig.max;
  const reachedMin = selectedSet.size >= optConfig.min;

  return `
    <div class="wizard-main">
      ${renderWizardHeader(`Elige ${title}`, `<span style="color:var(--accent-mint); font-weight:700;">Para: ${p.nombre}</span> &bull; Seleccionado: ${selectedSet.size} de ${optConfig.max} (Min: ${optConfig.min})`, stepIdx, 5)}
      <div class="wizard-body">
        
        <div class="modifier-modes" style="display:flex; overflow-x:auto; padding-bottom:12px; gap:8px; border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 16px; min-width: 0;">
          <button class="mod-btn ${currentModifier === 'normal' ? 'active' : ''}" data-action="set-mod" data-val="normal">⚡ Normal</button>
          <button class="mod-btn ${currentModifier === 'sin' ? 'active' : ''}" data-action="set-mod" data-val="sin">🚫 Sin</button>
          <button class="mod-btn ${currentModifier === 'extra' ? 'active' : ''}" data-action="set-mod" data-val="extra">➕ Extra</button>
          <button class="mod-btn ${currentModifier === 'aparte' ? 'active' : ''}" data-action="set-mod" data-val="aparte">📦 Aparte</button>
          <button class="mod-btn ${currentModifier === 'poco' ? 'active' : ''}" data-action="set-mod" data-val="poco">🤏 Poco</button>
        </div>

        <div class="wizard-opt-grid">
          ${list.map(item => {
    const hasIt = selectedSet.has(item) || selectedSet.has('Sin ' + item) || selectedSet.has(item + ' (Extra)') || selectedSet.has(item + ' (Aparte)') || selectedSet.has('Poco ' + item);
    return `
              <button class="wizard-opt-btn ${hasIt ? 'opt-selected' : ''} ${getOptionColorClass(tipo.substring(0, tipo.length - 1), item)}" data-action="wizard-toggle-opt" data-tipo="${tipo}" data-val="${item}">
                ${item}
              </button>
            `;
  }).join('')}
          ${reachedMax ? `
            <button class="wizard-opt-btn opt-extra" data-action="wizard-add-extra-opt" data-tipo="${tipo}">
              ➕ ${title.substring(0, title.length - 1)} Extra (+$0.20)
            </button>
          ` : ''}
        </div>
      </div>
      <div class="wizard-footer">
        <div class="wizard-summary-bar">
          ${[...selectedSet].map(s => `<span class="wizard-sum-item">${s}</span>`).join('')}
        </div>
        <button class="btn btn-primary" ${!reachedMin ? 'disabled' : ''} data-action="wizard-next">Siguiente ➔</button>
      </div>
    </div>
  `;
}

function renderWizardExtrasNotas() {
  const p = configuringProduct;
  return `
    <div class="wizard-main">
      ${renderWizardHeader(`Extras y Notas`, `<span style="color:var(--accent-mint); font-weight:700;">Para: ${p.nombre}</span> &bull; (Opcional)`, 5, 5)}
      <div class="wizard-body">
        <h4 style="margin-bottom:12px;">Extras (+$$)</h4>
        <div class="wizard-opt-grid" style="margin-bottom:24px;">
          ${db.EXTRAS.map(e => `
            <button class="wizard-opt-btn ${selectedExtras.has(e.nombre) ? 'opt-selected' : ''}" data-action="wizard-toggle-extra" data-val="${e.nombre}">
              ${e.nombre} <span style="font-size:10px; opacity:0.7;">+${formatCurrency(e.precio)}</span>
            </button>
          `).join('')}
        </div>

        <h4 style="margin-bottom:12px; color:var(--danger)">Notas para Cocina</h4>
        <div class="wizard-opt-grid">
          ${db.NOTAS_RAPIDAS.map(n => `
            <button class="wizard-opt-btn ${selectedNotas.has(n) ? 'opt-selected' : ''}" data-action="wizard-toggle-nota" data-val="${n}">
              ${n}
            </button>
          `).join('')}
        </div>
      </div>
      <div class="wizard-footer">
        <div class="wizard-summary-bar"></div>
        <button class="btn btn-primary btn-lg" data-action="wizard-finish-product">✓ Terminar Producto</button>
      </div>
    </div>
  `;
}

function renderWizardSuccess() {
  const p = configuringProduct;
  return `
    <div class="wizard-main">
      <div class="wizard-success">
        <div class="ws-icon">✅</div>
        <div class="ws-title">${p ? p.nombre : 'Producto'} agregado</div>
        <div class="ws-desc">El producto se agregó a la cuenta actual</div>
        
        <div class="ws-actions">
          <button class="ws-btn ws-btn-add" data-action="wizard-go-home">
            <span class="ws-icon-small">➕</span>
            Agregar otro
          </button>
          <button class="ws-btn ws-btn-save" data-action="${isMobile() ? 'toggle-mobile-ticket' : 'wizard-review'}">
            <span class="ws-icon-small">📋</span>
            Ver Pedido
          </button>
          <button class="ws-btn ws-btn-kitchen" data-action="enviar-cocina">
            <span class="ws-icon-small">👨‍🍳</span>
            Enviar a Cocina
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderWizardReview() {
  const cuenta = activeCuentaId ? db.getCuentaById(activeCuentaId) : null;
  if (!cuenta) return '';

  return `
    <div class="wizard-main">
      ${renderWizardHeader('Resumen del Pedido', 'Revisa con el cliente antes de enviar', 5, 5)}
      <div class="wizard-body" style="background:var(--surface-1);">
        <div class="review-list">
          ${cuenta.items.map(item => `
            <div style="display:flex; justify-content:space-between; padding:16px; border-bottom:1px solid rgba(255,255,255,0.05); align-items:center;">
              <div style="display:flex; gap:16px; align-items:center;">
                <span style="font-size:32px;">${item.emoji}</span>
                <div>
                  <div style="font-size:18px; font-weight:700;">${item.cantidad}x ${item.nombre}</div>
                  ${item.detalles ? `<div style="font-size:13px; color:var(--text-muted); margin-top:4px;">${item.detalles}</div>` : ''}
                </div>
              </div>
              <div style="font-size:18px; font-weight:700; color:var(--accent-mint)">
                ${formatCurrency(item.precio * item.cantidad)}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="wizard-footer">
        <div class="wizard-summary-bar">
          <span class="cuenta-total-amount" style="font-size:20px; font-weight:800;">TOTAL: ${formatCurrency(cuenta.total)}</span>
        </div>
        <div style="display:flex; gap:12px;">
          <button class="btn btn-secondary btn-lg" data-action="wizard-go-home">➕ Seguir Agregando</button>
          <button class="btn btn-warning btn-lg" data-action="enviar-cocina">👨‍🍳 Enviar a Cocina</button>
        </div>
      </div>
    </div>
  `;
}

// renderWizardReview is used for Desktop; for mobile, we use the Bottom Sheet directly.

function renderRightPanel() {
  const activeCuenta = activeCuentaId ? db.getCuentaById(activeCuentaId) : null;
  const jornadaSales = db.getSalesForJornada();
  const summary = db.calcDaySummary(jornadaSales);
  const today = new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
  const hasCuenta = activeCuenta && activeCuenta.estado === 'abierta';

  return `
    <div class="bottom-sheet-handle" data-action="toggle-mobile-ticket"></div>
    ${hasCuenta ? renderCuentaDetail(activeCuenta) : renderNoCuenta()}

    <div class="summary-panel compact ${hasCuenta ? 'collapsed' : ''}" style="margin-top: auto;">
      <div class="summary-header">
        <h3>📊 ${hasCuenta ? `💰 ${formatCurrency(summary.total)} hoy` : 'Resumen del Día'}</h3>
        <div class="summary-date">${today}</div>
      </div>
      <div class="summary-stats">
        <div class="stat-row cash"><span>💵 Efectivo</span><span>${formatCurrency(summary.efectivo)}</span></div>
        <div class="stat-row card"><span>💳 Tarjeta</span><span>${formatCurrency(summary.tarjeta)}</span></div>
        <div class="stat-row transfer"><span>📱 Transfer.</span><span>${formatCurrency(summary.transferencia)}</span></div>
      </div>
      <div class="summary-total">
        <div class="total-amount">${formatCurrency(summary.total)}</div>
        <div class="total-label">Total del día</div>
      </div>
    </div>
  `;
}

function renderMobileFab() {
  const activeCuenta = activeCuentaId ? db.getCuentaById(activeCuentaId) : null;
  return `
    <button id="mobile-cart-fab" class="mobile-ticket-fab" data-action="toggle-mobile-ticket">
      <span>🛒 Ver Cargo</span>
      <strong>${formatCurrency(activeCuenta ? activeCuenta.total : 0)}</strong>
    </button>
  `;
}

function renderNoCuenta() {
  return `
    <div class="cuenta-detail empty-cuenta">
      <div class="empty-state" style="padding: 32px 16px;">
        <div class="empty-icon">🎫</div>
        <p style="font-size: 15px; font-weight: 600; margin-bottom: 4px;">Sin cuenta activa</p>
        <p>Crea una nueva cuenta o selecciona una abierta</p>
      </div>
    </div>
  `;
}

function renderCuentaDetail(cuenta) {
  const itemCount = cuenta.items.reduce((s, i) => s + i.cantidad, 0);
  return `
    <div class="cuenta-detail">
      <div class="cuenta-detail-header">
        <div>
          <h3>🎫 Cuenta #${cuenta.numero}${cuenta.mesa ? ` - MESA ${cuenta.mesa}` : ''}</h3>
          <span class="cuenta-detail-time">Abierta ${formatTime(cuenta.hora_apertura)}</span>
        </div>
        <button class="cuenta-cancel-btn" data-action="cancelar-cuenta" title="Cancelar cuenta">✕</button>
      </div>

      <div class="cuenta-items" id="cuenta-items">
        ${cuenta.items.length === 0 ? `
          <div class="empty-state" style="padding: 24px 16px;">
            <div class="empty-icon">🍦</div>
            <p>Toca un producto para agregarlo</p>
          </div>
        ` : cuenta.items.map(item => {
    const isJustAdded = lastAddedConfigId && (item.configId === lastAddedConfigId || item.producto_id === lastAddedConfigId);
    return `
          <div class="cuenta-item ${isJustAdded ? 'just-added' : ''}">
            <div class="cuenta-item-info">
              <span class="cuenta-item-emoji">${item.emoji}</span>
              <div style="display: flex; flex-direction: column; flex: 1; min-width: 0;">
                <span class="cuenta-item-name">${item.nombre}</span>
                ${item.detalles ? `<span style="font-size: 11px; color: var(--text-muted); line-height: 1.2; margin-top:2px;">${item.detalles}</span>` : ''}
              </div>
            </div>
            <div class="cuenta-item-actions">
              <button class="cuenta-item-qty-btn duplicate-btn" data-action="add-item" data-id="${item.configId || item.producto_id}" title="Clonar" style="background: none; border: 1px dashed rgba(255,255,255,0.2); color: var(--text-secondary);">📑</button>
              <button class="cuenta-item-qty-btn minus" data-action="remove-item" data-id="${item.configId || item.producto_id}" title="Quitar">−</button>
              <span class="cuenta-item-qty">${item.cantidad}</span>
              <button class="cuenta-item-qty-btn plus" data-action="add-item" data-id="${item.configId || item.producto_id}" title="Agregar">+</button>
              <button class="cuenta-item-qty-btn delete-btn" data-action="delete-item-full" data-id="${item.configId || item.producto_id}" title="Eliminar" style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: var(--danger); margin-left:8px;">🗑️</button>
              <span class="cuenta-item-subtotal" style="margin-left:auto; font-weight: bold;">${formatCurrency(item.precio * item.cantidad)}</span>
            </div>
          </div>
        `}).join('')}
      </div>

      <div class="cuenta-footer">
        <div class="cuenta-total-row">
          <span class="cuenta-total-label">${itemCount} producto${itemCount !== 1 ? 's' : ''}</span>
          <span class="cuenta-total-amount">${formatCurrency(cuenta.total)}</span>
        </div>
        <div class="cuenta-action-btns" style="display: flex; gap: 8px;">
          <button class="btn ${isMobile() ? 'btn-warning' : 'btn-secondary'} btn-lg cuenta-btn-cobrar" data-action="${isMobile() ? 'enviar-cocina' : 'wizard-review'}" style="flex: 1;" ${cuenta.items.length === 0 ? 'disabled' : ''}>
            ${isMobile() ? '👨‍🍳 Cocina' : '📋 Revisar'}
          </button>
          <button class="btn btn-success btn-lg cuenta-btn-cobrar" data-action="cobrar-cuenta" style="flex: 1;" ${cuenta.items.length === 0 ? 'disabled' : ''}>💰 Cobrar</button>
        </div>
      </div>
    </div>
  `;
}

function renderMesaSelector() {
  const mesasOcupadas = db.getMesasOcupadasReciente();
  const mesas = [1, 2, 3, 4, 5, 6, 7];
  return `
    <div class="mesa-popover-backdrop" data-action="close-mesa-modal"></div>
    <div class="mesa-popover">
      <h4>🍽️ Seleccionar Mesa</h4>
      <div class="mesa-popover-grid">
        ${mesas.map(m => {
    const occ = mesasOcupadas.includes(m) || mesasOcupadas.includes(m.toString());
    return `<button class="mesa-select-btn ${occ ? 'occupied' : ''}" data-action="select-mesa" data-val="${m}">${m}${occ ? '<div style="font-size:8px">OCUPADA</div>' : ''}</button>`;
  }).join('')}
        <button class="mesa-select-btn" data-action="select-mesa" data-val="LLEVAR" style="color:var(--accent-mint)">🥡 LLEVAR</button>
      </div>
    </div>
  `;
}

// --- Logic ---

export function render() {
  return `
    <div class="cuentas-bar" id="section-cuentas-bar" style="position:relative;">${renderCuentasBar()}${showMesaSelector ? renderMesaSelector() : ''}</div>
    <div class="wizard-layout">
      <div id="section-wizard">${renderWizard()}</div>
      <div class="right-panel" id="section-right-panel">${renderRightPanel()}</div>
      <div id="section-mobile-fab">${renderMobileFab()}</div>
    </div>
  `;
}

function rerender(section = null) {
  console.log(`🎬 Rerender requested for: ${section || 'full'}`);
  if (section) {
    pendingRenders.add(section);
  } else {
    pendingRenders.clear();
    pendingRenders.add('__full__');
  }

  if (renderTimeoutId) return; // Already scheduled

  renderTimeoutId = setTimeout(() => {
    const sections = {
      'cuentas': ['section-cuentas-bar', () => renderCuentasBar() + (showMesaSelector ? renderMesaSelector() : '')],
      'wizard': ['section-wizard', renderWizard],
      'panel': ['section-right-panel', renderRightPanel]
    };

    if (pendingRenders.has('__full__')) {
      // Full rerender - preserve bottom sheet state
      const wasSheetOpen = document.querySelector('.right-panel')?.classList.contains('bottom-sheet-active');
      const container = document.getElementById('page-container');
      if (container) container.innerHTML = render();
      if (wasSheetOpen) {
        document.querySelector('.right-panel')?.classList.add('bottom-sheet-active');
      }
    } else {
      // Render each pending section independently
      for (const sec of pendingRenders) {
        if (sections[sec]) {
          const [id, func] = sections[sec];
          const el = document.getElementById(id);
          if (el) {
            const wasOpen = el.classList.contains('bottom-sheet-active');
            el.innerHTML = func();
            if (wasOpen) el.classList.add('bottom-sheet-active');
          }
        }
      }
      // Update FAB if panel was rendered
      if (pendingRenders.has('panel')) {
        const fabWrapper = document.getElementById('section-mobile-fab');
        if (fabWrapper) fabWrapper.innerHTML = renderMobileFab();
      }
    }

    pendingRenders.clear();
    renderTimeoutId = null;
  }, 0);
}

function handlePosActions(e) {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;

  switch (action) {
    case 'nueva-cuenta':
      const apertura = db.getAperturaHoy();
      if (!apertura || apertura.estado !== 'abierto') {
        window.showToast('⚠️ Abre el día primero', 'error');
        return;
      }
      showMesaSelector = true;
      resetWizard(); // Ensure clean start
      rerender('cuentas');
      break;

    case 'close-mesa-modal':
      showMesaSelector = false;
      rerender('cuentas');
      break;

    case 'select-mesa':
      const mesa = target.dataset.val;
      confirmMesa(mesa);
      break;

    case 'select-cuenta':
      activeCuentaId = target.dataset.id;
      resetWizard(); // Reset wizard when switching accounts
      rerender();
      break;

    case 'wizard-sel-cat':
      wizardCategory = target.dataset.val;
      wizardStep = 'products';
      rerender('wizard');
      break;

    case 'wizard-sel-prod':
      if (!activeCuentaId) return window.showToast('⚠️ Selecciona cuenta', 'error');
      const pId = target.dataset.id;
      const p = db.getProductById(pId);

      configuringProduct = p;
      selectedVariant = p.variantes?.[0] || null;
      selectedSabores.clear(); selectedCoberturas.clear(); selectedToppings.clear(); selectedExtras.clear(); selectedNotas.clear();

      if (!p.opciones && !p.variantes?.length) {
        addCurrentWizardProduct();
      } else {
        advanceWizardStep();
      }
      break;

    case 'wizard-back':
      goWizardBack();
      break;

    case 'wizard-next':
      advanceWizardStep();
      break;

    case 'wizard-finish-product':
      addCurrentWizardProduct();
      break;

    case 'wizard-toggle-opt':
      const tipoOpt = target.dataset.tipo; // sabores, coberturas, toppings
      const baseOptVal = target.dataset.val;

      let finalVal = baseOptVal;
      if (currentModifier === 'sin') finalVal = `Sin ${baseOptVal}`;
      if (currentModifier === 'extra') finalVal = `${baseOptVal} (Extra)`;
      if (currentModifier === 'aparte') finalVal = `${baseOptVal} (Aparte)`;
      if (currentModifier === 'poco') finalVal = tipoOpt === 'coberturas' ? `Poca ${baseOptVal}` : `Poco ${baseOptVal}`;

      let theSet = tipoOpt === 'sabores' ? selectedSabores : (tipoOpt === 'coberturas' ? selectedCoberturas : selectedToppings);

      // Toggle logic
      let found = false;
      for (let item of theSet) {
        if (item.includes(baseOptVal)) {
          theSet.delete(item);
          found = true;
        }
      }
      if (!found) theSet.add(finalVal);

      rerender('wizard');

      // Auto-advance
      if (!found && currentModifier === 'normal') {
        const optMax = configuringProduct.opciones[tipoOpt]?.max;
        if (theSet.size === optMax) {
          setTimeout(() => advanceWizardStep(), 250);
        }
      }
      break;

    case 'wizard-add-extra-opt':
      currentModifier = 'extra';
      rerender('wizard');
      window.showToast('Selecciona la opción extra extra', 'info');
      break;

    case 'wizard-toggle-extra':
      const ex = target.dataset.val;
      if (selectedExtras.has(ex)) selectedExtras.delete(ex); else selectedExtras.add(ex);
      rerender('wizard');
      break;

    case 'wizard-toggle-nota':
      const n = target.dataset.val;
      if (selectedNotas.has(n)) selectedNotas.delete(n); else selectedNotas.add(n);
      rerender('wizard');
      break;

    case 'wizard-go-home':
      resetWizard();
      rerender('wizard');
      break;

    case 'wizard-review':
      wizardStep = 'review';
      rerender('wizard');
      break;

    case 'set-mod':
      currentModifier = target.dataset.val;
      rerender('wizard');
      break;

    case 'add-item':
      db.incrementItemQty(activeCuentaId, target.dataset.id).then(() => rerender('panel'));
      break;

    case 'remove-item':
      db.removeItemFromCuenta(activeCuentaId, target.dataset.id).then(() => rerender('panel'));
      break;

    case 'delete-item-full':
      db.deleteItemFromCuenta(activeCuentaId, target.dataset.id).then(() => rerender('panel'));
      break;

    case 'enviar-cocina':
      db.enviarACocina(activeCuentaId).then(() => {
        window.showToast('👨‍🍳 Enviado', 'success');
        if (wizardStep === 'success') {
          resetWizard();
          rerender('wizard');
        }
      });
      break;

    case 'cobrar-cuenta':
      openPaymentModal(db.getCuentaById(activeCuentaId));
      break;

    case 'cancelar-cuenta':
      cancelarCuentaActual();
      break;

    case 'toggle-sidebar':
      const sidebar = document.getElementById('sidebar');
      if (sidebar) {
        sidebar.classList.toggle('mobile-active');
        let overlay = document.getElementById('mobile-overlay');
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.id = 'mobile-overlay';
          overlay.className = 'mobile-overlay';
          document.body.appendChild(overlay);
        }
        overlay.onclick = () => {
          sidebar.classList.remove('mobile-active');
          document.querySelector('.right-panel')?.classList.remove('bottom-sheet-active');
          overlay.classList.remove('active');
        };
        overlay.classList.toggle('active', sidebar.classList.contains('mobile-active') || document.querySelector('.right-panel')?.classList.contains('bottom-sheet-active'));
      }
      break;

    case 'toggle-mobile-ticket':
      const rp = document.querySelector('.right-panel');
      if (rp) {
        rp.classList.toggle('bottom-sheet-active');
        let overlay = document.getElementById('mobile-overlay');
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.id = 'mobile-overlay';
          overlay.className = 'mobile-overlay';
          document.body.appendChild(overlay);
        }
        overlay.onclick = () => {
          document.getElementById('sidebar')?.classList.remove('mobile-active');
          rp.classList.remove('bottom-sheet-active');
          overlay.classList.remove('active');
        };
        const isActive = rp.classList.contains('bottom-sheet-active') || document.getElementById('sidebar')?.classList.contains('mobile-active');
        overlay.classList.toggle('active', isActive);
      }
      break;
  }
}

async function confirmMesa(mesa) {
  const occ = db.getMesasOcupadasReciente();
  if (occ.includes(mesa) || occ.includes(Number(mesa))) {
    const ok = await window.showConfirm({
      title: 'Mesa Ocupada',
      message: `La mesa ${mesa} tuvo actividad hace poco. ¿Usarla de nuevo?`,
      confirmText: 'Sí, usar'
    });
    if (!ok) return;
  }
  const c = await db.createCuenta(mesa);
  activeCuentaId = c.id;
  showMesaSelector = false;
  rerender();
  window.showToast(`🎫 Cuenta #${c.numero} - Mesa ${mesa}`, 'success');
}

async function cancelarCuentaActual() {
  const c = db.getCuentaById(activeCuentaId);
  const ok = await window.showConfirm({
    title: `¿Cancelar Cuenta #${c.numero}?`,
    confirmText: 'Sí, cancelar',
    confirmClass: 'btn-danger'
  });
  if (ok) {
    await db.cancelarCuenta(activeCuentaId);
    activeCuentaId = null;

    // Reset wizard and close bottom sheet
    resetWizard();
    document.querySelector('.right-panel')?.classList.remove('bottom-sheet-active');
    document.getElementById('mobile-overlay')?.classList.remove('active');

    rerender();
    window.showToast('🗑️ Cuenta cancelada', 'info');
  }
}

function openPaymentModal(cuenta) {
  const modal = document.getElementById('payment-modal');
  document.getElementById('modal-product-name').textContent = `🎫 Cuenta #${cuenta.numero}`;
  document.getElementById('modal-product-price').textContent = formatCurrency(cuenta.total);
  modal.style.display = 'flex';
}

export async function handlePayment(method) {
  if (!activeCuentaId) return;
  const c = await db.cobrarCuenta(activeCuentaId, method);
  if (c) {
    activeCuentaId = null;
    document.getElementById('payment-modal').style.display = 'none';

    // Explicitly close bottom sheet and reset wizard
    document.querySelector('.right-panel')?.classList.remove('bottom-sheet-active');
    document.getElementById('mobile-overlay')?.classList.remove('active');
    resetWizard();

    rerender();
    window.showToast(`✅ Cobrado: ${formatCurrency(c.total)}`, 'success');
  }
}

// --- Listeners ---
const onSaleAdded = () => rerender('panel');
const onCuentasChanged = () => rerender();
const onProductsChanged = () => rerender('products');

// --- Lifecycle ---

export function init() {
  if (!isListenersAttached) {
    const container = document.getElementById('page-container');
    container.addEventListener('click', handlePosActions);

    // DB Listeners
    db.on('sale-added', onSaleAdded);
    db.on('cuentas-changed', onCuentasChanged);
    db.on('products-changed', onProductsChanged);

    isListenersAttached = true;
  }
}

export function cleanup() {
  const container = document.getElementById('page-container');
  if (container) {
    container.removeEventListener('click', handlePosActions);
  }

  db.off('sale-added', onSaleAdded);
  db.off('cuentas-changed', onCuentasChanged);
  db.off('products-changed', onProductsChanged);

  isListenersAttached = false;
}
