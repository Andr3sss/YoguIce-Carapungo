// ========================================
// ≡ƒìª Helader├¡a POS - Ventas Module
// POS screen with cuentas (tickets) system
// ========================================

import * as db from '../db.js';
import { formatCurrency, formatTime } from '../main.js';

let activeCuentaId = null;
let activeCategory = 'Favoritos';
let configuringProduct = null;
let selectedVariant = null;
let selectedSabores = new Set();
let selectedCoberturas = new Set();
let selectedToppings = new Set();
let selectedExtras = new Set();
let selectedNotas = new Set();

function getTimeSince(timestamp) {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
}

export function render() {
  const products = db.getActiveProducts();
  const cuentasAbiertas = db.getCuentasAbiertas();
  const jornadaSales = db.getSalesForJornada();
  const summary = db.calcDaySummary(jornadaSales);
  const activeCuenta = activeCuentaId ? db.getCuentaById(activeCuentaId) : null;

  // Si la cuenta activa fue cerrada/cancelada, deseleccionarla
  if (activeCuenta && activeCuenta.estado !== 'abierta') {
    activeCuentaId = null;
  }

  const today = new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });

  // Categor├¡as con Iconos
  const categoryIcons = {
    'WAFFLES': '≡ƒºç',
    'TULIPANES': '≡ƒìº',
    'COPAS': '≡ƒì¿',
    'POSTRES': '≡ƒì░',
    'TORTAS HELADAS': '≡ƒÄé',
    'BEBIDAS': '≡ƒÑñ',
    'PROMOCIONES': '≡ƒÅ╖∩╕Å',
    'Favoritos': 'Γ¡É'
  };
  
  const categoriasSet = new Set(products.map(p => p.categoria));
  const categories = ['Favoritos', ...Array.from(categoriasSet)];

  // Productos a mostrar central
  let displayProducts = [];
  if (activeCategory === 'Favoritos') {
    const favNames = ['Soft', 'Cono', 'Bubble Waffle', 'Milk Shake'];
    displayProducts = products.filter(p => favNames.includes(p.nombre));
    if (displayProducts.length === 0) displayProducts = products.slice(0, 8);
  } else {
    displayProducts = products.filter(p => p.categoria === activeCategory);
  }

  return `
    <!-- Barra Cuentas Abiertas -->
    <div class="cuentas-bar">
      <div class="cuentas-bar-header">
        <h3>≡ƒÄ½ Cuentas Abiertas</h3>
        <button class="btn btn-primary btn-sm" id="btn-nueva-cuenta">
          Γ₧ò Nueva Cuenta
        </button>
      </div>
      <div class="cuentas-list" id="cuentas-list">
        ${cuentasAbiertas.length === 0 ? `
          <div class="cuentas-empty">
            <span>No hay cuentas abiertas</span>
            <span class="cuentas-empty-hint">Crea una para empezar a vender</span>
          </div>
        ` : cuentasAbiertas.map(c => `
          <button class="cuenta-card ${activeCuentaId === c.id ? 'active' : ''}" data-cuenta-id="${c.id}">
            <div class="cuenta-card-number">#${c.numero}</div>
            <div class="cuenta-card-total">${formatCurrency(c.total)}</div>
            <div class="cuenta-card-meta">
              <span>${c.items.length} items</span>
              <span>ΓÅ▒ ${getTimeSince(c.timestamp_apertura)}</span>
            </div>
          </button>
        `).join('')}
      </div>
    </div>

    <!-- Layout POS Principal 3 Columnas -->
    <div class="pos-layout">

      <!-- Columna Izquierda: Sidebar de Categor├¡as -->
      <div class="categories-sidebar" id="categories-sidebar">
        ${categories.map(c => `
          <button class="category-btn ${activeCategory === c ? 'active' : ''}" data-category="${c}">
            <span style="font-size: 20px;">${categoryIcons[c] || '≡ƒôü'}</span>
            <span>${c}</span>
          </button>
        `).join('')}
      </div>

      <!-- Columna Central: Productos o Panel de Configuraci├│n -->
      <div class="products-section">
        ${configuringProduct ? renderQuickConfigPanel() : `
          <div class="products-grid" id="products-grid">
            ${displayProducts.map(p => `
              <button class="product-btn ${!activeCuentaId ? 'disabled' : ''}" data-id="${p.id}" id="product-btn-${p.id}" ${!activeCuentaId ? 'title="Crea o selecciona una cuenta primero"' : ''}>
                <span class="product-emoji">${p.emoji || '≡ƒìª'}</span>
                <span class="product-name">${p.nombre}</span>
                <span class="product-price">${formatCurrency(p.precio)}</span>
              </button>
            `).join('')}
          </div>
        `}
      </div>

      <!-- Columna Derecha: Detalle de la Cuenta y Resumen -->
      <div class="right-panel">
        ${activeCuenta && activeCuenta.estado === 'abierta' ? renderCuentaDetail(activeCuenta) : renderNoCuenta()}

        <!-- Day summary compact -->
        <div class="summary-panel compact" style="margin-top: auto;">
          <div class="summary-header">
            <h3>≡ƒôè Resumen del D├¡a</h3>
            <div class="summary-date">${today}</div>
          </div>
          <div class="summary-stats" id="summary-stats">
            <div class="stat-row cash">
              <span class="stat-label">≡ƒÆ╡ Efectivo</span>
              <span class="stat-value" id="total-cash">${formatCurrency(summary.efectivo)}</span>
            </div>
            <div class="stat-row card">
              <span class="stat-label">≡ƒÆ│ Tarjeta</span>
              <span class="stat-value" id="total-card">${formatCurrency(summary.tarjeta)}</span>
            </div>
            <div class="stat-row transfer">
              <span class="stat-label">≡ƒô▒ Transfer.</span>
              <span class="stat-value" id="total-transfer">${formatCurrency(summary.transferencia)}</span>
            </div>
          </div>
          <div class="summary-total">
            <div class="total-amount" id="total-amount">${formatCurrency(summary.total)}</div>
            <div class="total-label">Total del d├¡a</div>
          </div>
        </div>
        
        <!-- Mobile FAB to open the ticket -->
        <button id="mobile-cart-fab" class="mobile-ticket-fab">
          <span>≡ƒ¢Æ Mi Cuenta</span>
          <strong>${formatCurrency(activeCuenta ? activeCuenta.total : 0)}</strong>
        </button>
      </div>
    </div>
  `;
}

function renderNoCuenta() {
  return `
    <div class="cuenta-detail empty-cuenta">
      <div class="empty-state" style="padding: 32px 16px;">
        <div class="empty-icon">≡ƒÄ½</div>
        <p style="font-size: 15px; font-weight: 600; margin-bottom: 4px;">Sin cuenta activa</p>
        <p>Crea una nueva cuenta o selecciona una abierta para agregar productos</p>
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
          <h3>≡ƒÄ½ Cuenta #${cuenta.numero}</h3>
          <span class="cuenta-detail-time">Abierta a las ${formatTime(cuenta.hora_apertura)} ┬╖ ${getTimeSince(cuenta.timestamp_apertura)}</span>
        </div>
      </div>

      <div class="cuenta-items" id="cuenta-items">
        ${cuenta.items.length === 0 ? `
          <div class="empty-state" style="padding: 24px 16px;">
            <div class="empty-icon">≡ƒìª</div>
            <p>Toca un producto para agregarlo</p>
          </div>
        ` : cuenta.items.map(item => `
          <div class="cuenta-item">
            <div class="cuenta-item-info">
              <span class="cuenta-item-emoji">${item.emoji}</span>
              <div style="display: flex; flex-direction: column;">
                <span class="cuenta-item-name">${item.nombre}</span>
                ${item.detalles ? `<span style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">${item.detalles}</span>` : ''}
              </div>
            </div>
            <div class="cuenta-item-actions" style="margin-top: 6px;">
              <button class="cuenta-item-qty-btn duplicate-btn" data-add-product="${item.configId || item.producto_id}" title="Clonar Pedido" style="background: none; border: 1px dashed var(--border); color: var(--text-secondary); margin-right: 8px;">≡ƒôæ</button>
              <button class="cuenta-item-qty-btn minus" data-remove-product="${item.configId || item.producto_id}" title="Quitar uno">ΓêÆ</button>
              <span class="cuenta-item-qty">${item.cantidad}</span>
              <button class="cuenta-item-qty-btn plus" data-add-product="${item.configId || item.producto_id}" title="Agregar uno">+</button>
              <span class="cuenta-item-subtotal" style="margin-left: 12px; font-weight: bold;">${formatCurrency(item.precio * item.cantidad)}</span>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="cuenta-footer">
        <div class="cuenta-total-row">
          <span class="cuenta-total-label">${itemCount} producto${itemCount !== 1 ? 's' : ''}</span>
          <span class="cuenta-total-amount" id="cuenta-total">${formatCurrency(cuenta.total)}</span>
        </div>
        <div class="cuenta-action-btns" style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn-warning btn-lg cuenta-btn-cobrar" id="btn-enviar-cocina" style="flex: 1; min-width: 140px;" ${cuenta.items.length === 0 ? 'disabled' : ''}>
            ≡ƒæ¿ΓÇì≡ƒì│ Enviar a Cocina
          </button>
          <button class="btn btn-success btn-lg cuenta-btn-cobrar" id="btn-cobrar" style="flex: 1; min-width: 140px;" ${cuenta.items.length === 0 ? 'disabled' : ''}>
            ≡ƒÆ░ Cobrar
          </button>
          <button class="btn btn-ghost btn-sm" id="btn-cancelar-cuenta" title="Cancelar cuenta" style="width: 100%; margin-top: 4px;">
            Γ£ò Cancelar
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderQuickConfigPanel() {
  const product = configuringProduct;
  const opt = product.opciones || {};
  const hasVariants = product.variantes && product.variantes.length > 0;
  
  // L├│gica de l├¡mites (si no hay l├¡mites configurados, por defecto min:0 max:1)
  const maxSabores = opt.sabores?.max || 0;
  const maxCoberturas = opt.coberturas?.max || 0;
  const maxToppings = opt.toppings?.max || 0;
  
  const selectedSaboresCount = selectedSabores.size;
  const isSaborLimitReached = maxSabores > 0 && selectedSaboresCount >= maxSabores;

  const selectedCoberturasCount = selectedCoberturas.size;
  const isCoberturaLimitReached = maxCoberturas > 0 && selectedCoberturasCount >= maxCoberturas;

  const selectedToppingsCount = selectedToppings.size;
  const isToppingsLimitReached = maxToppings > 0 && selectedToppingsCount >= maxToppings;

  // Validar si cumpli├│ el m├¡nimo
  const minSabores = opt.sabores?.min || 0;
  const missingSabores = Math.max(0, minSabores - selectedSaboresCount);
  
  const minCoberturas = opt.coberturas?.min || 0;
  const missingCoberturas = Math.max(0, minCoberturas - selectedCoberturasCount);

  // Calcular precio total din├ímico sumando extras
  let basePrice = selectedVariant ? selectedVariant.precio : product.precio;
  let extrasPrice = Array.from(selectedExtras).reduce((sum, extraName) => {
    const extraInfo = db.EXTRAS.find(e => e.nombre === extraName);
    return sum + (extraInfo ? extraInfo.precio : 0);
  }, 0);
  let finalRunningTotal = basePrice + extrasPrice;

  // Generar estado del bot├│n Confirmar
  let validationMessage = [];
  if (missingSabores > 0) validationMessage.push(`Falta ${missingSabores} sabor${missingSabores > 1 ? 'es' : ''}`);
  if (missingCoberturas > 0) validationMessage.push(`Falta ${missingCoberturas} cobertura${missingCoberturas > 1 ? 's' : ''}`);
  
  const canConfirm = (!hasVariants || selectedVariant) && validationMessage.length === 0;
  const confirmText = canConfirm 
    ? `Γ£à Confirmar Pedido - ${formatCurrency(finalRunningTotal)}` 
    : `ΓÜá∩╕Å ${validationMessage.join(', ')}`;

  return `
    <div class="quick-config-panel">
      <div class="config-header">
        <div>
           <h2 style="font-size: 1.25rem;">${product.emoji} ${product.nombre}</h2>
           ${opt.incluye_desc ? `<span style="font-size: 0.8rem; color: var(--text-secondary);">${opt.incluye_desc}</span>` : ''}
        </div>
        <button class="btn btn-ghost" id="btn-cancel-config">Γ£ò CERRAR</button>
      </div>

      <div class="config-scroll-area" style="overflow-y: auto; padding: 0 16px 16px 16px; display: flex; flex-direction: column; gap: 20px;">
        
        ${hasVariants ? `
          <div class="config-section">
            <div class="config-section-title">1. Tama├▒o / Variante <span style="font-weight: normal; font-size: 0.8rem;">(Requerido)</span></div>
            <div class="config-options-grid">
              ${product.variantes.map((v, idx) => `
                <button class="option-btn variant-btn ${selectedVariant?.nombre === v.nombre ? 'active' : ''}" data-variant-idx="${idx}">
                  ${v.nombre}
                  <span class="option-price">${formatCurrency(v.precio)}</span>
                </button>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${maxSabores > 0 ? `
          <div class="config-section">
            <div class="config-section-title">Sabores de Helado <span style="font-weight: normal; font-size: 0.8rem;">(Escoge ${maxSabores})</span></div>
            <div class="config-options-grid">
              ${db.SABORES_HELADO.map(s => {
                const isActive = selectedSabores.has(s);
                const isDisabled = !isActive && isSaborLimitReached;
                return `
                <button class="option-btn sabor-btn ${isActive ? 'active' : ''}" data-sabor="${s}" ${isDisabled ? 'disabled style="opacity:0.4"' : ''}>
                  ${s}
                </button>`;
              }).join('')}
            </div>
          </div>
        ` : ''}

        ${maxCoberturas > 0 ? `
          <div class="config-section">
            <div class="config-section-title">Sirope / Cobertura <span style="font-weight: normal; font-size: 0.8rem;">(Escoge ${maxCoberturas})</span></div>
            <div class="config-options-grid">
              ${db.COBERTURAS_LIQUIDAS.map(c => {
                const isActive = selectedCoberturas.has(c);
                const isDisabled = !isActive && isCoberturaLimitReached;
                return `
                <button class="option-btn cobertura-btn ${isActive ? 'active' : ''}" data-cobertura="${c}" ${isDisabled ? 'disabled style="opacity:0.4"' : ''}>
                  ${c}
                </button>`;
              }).join('')}
            </div>
          </div>
        ` : ''}

        ${maxToppings > 0 ? `
          <div class="config-section">
            <div class="config-section-title">Toppings Incluidos <span style="font-weight: normal; font-size: 0.8rem;">(Escoge ${maxToppings})</span></div>
            <div class="config-options-grid">
              ${db.TOPPINGS.map(t => {
                const isActive = selectedToppings.has(t);
                const isDisabled = !isActive && isToppingsLimitReached;
                return `
                <button class="option-btn topping-btn ${isActive ? 'active' : ''}" data-topping="${t}" ${isDisabled ? 'disabled style="opacity:0.4"' : ''}>
                  ${t}
                </button>`;
              }).join('')}
            </div>
          </div>
        ` : ''}

        <!-- EXTRAS (+$$$) -->
        <div class="config-section">
           <div class="config-section-title" style="color: var(--primary);">Extras Adicionales <span style="font-weight: normal; font-size: 0.8rem;">(+ Costo Extra)</span></div>
           <div class="config-options-grid">
             ${db.EXTRAS.map(e => `
               <button class="option-btn extra-btn ${selectedExtras.has(e.nombre) ? 'active' : ''}" data-extra="${e.nombre}">
                 ${e.nombre} <br/> <span style="font-size: 0.75rem;">+${formatCurrency(e.precio)}</span>
               </button>
             `).join('')}
           </div>
        </div>

        <!-- NOTAS R├üPIDAS -->
        <div class="config-section">
           <div class="config-section-title" style="color: var(--danger);">Notas para Cocina <span style="font-weight: normal; font-size: 0.8rem;">(Sin costo)</span></div>
           <div class="config-options-grid">
             ${db.NOTAS_RAPIDAS.map(n => `
               <button class="option-btn nota-btn ${selectedNotas.has(n) ? 'active' : ''}" data-nota="${n}">
                 ${n}
               </button>
             `).join('')}
           </div>
        </div>

      </div>

      <div style="padding: 16px; border-top: 1px solid var(--border);">
        <button class="btn ${canConfirm ? 'btn-primary' : 'btn-secondary'} btn-lg" style="width: 100%; height: 60px; font-size: 1.1rem; box-shadow: 0 4px 12px rgba(var(--primary-rgb), 0.3);" id="btn-confirm-config" 
          ${!canConfirm ? 'disabled' : ''}>
          ${confirmText}
        </button>
      </div>
    </div>
  `;
}

export function init() {
  // New cuenta button
  const btnNueva = document.getElementById('btn-nueva-cuenta');
  if (btnNueva) {
    btnNueva.addEventListener('click', async () => {
      const cuenta = await db.createCuenta();
      activeCuentaId = cuenta.id;
      rerender();
      window.showToast(`≡ƒÄ½ Cuenta #${cuenta.numero} creada`, 'success');
    });
  }

  // Cuenta card selection
  const cuentasList = document.getElementById('cuentas-list');
  if (cuentasList) {
    cuentasList.addEventListener('click', (e) => {
      const card = e.target.closest('.cuenta-card');
      if (!card) return;
      activeCuentaId = card.dataset.cuentaId;
      rerender();
    });
  }

  // Categories sidebar click
  const categoriesSidebar = document.getElementById('categories-sidebar');
  if (categoriesSidebar) {
    categoriesSidebar.addEventListener('click', (e) => {
      const btn = e.target.closest('.category-btn');
      if (!btn) return;
      activeCategory = btn.dataset.category;
      configuringProduct = null;
      rerender();
    });
  }

  // Product click ΓåÆ add to active cuenta or open config
  const grid = document.getElementById('products-grid');
  if (grid) {
    grid.addEventListener('click', async (e) => {
      const btn = e.target.closest('.product-btn');
      if (!btn) return;
      if (!activeCuentaId) {
        window.showToast('ΓÜá∩╕Å Crea o selecciona una cuenta primero', 'error');
        return;
      }
      const product = db.getProductById(btn.dataset.id);
      if (!product) return;

      if ((product.variantes && product.variantes.length > 0) || (product.opciones && Object.keys(product.opciones).length > 0)) {
        configuringProduct = product;
        selectedVariant = product.variantes ? product.variantes[0] : null; 
        selectedSabores.clear();
        selectedCoberturas.clear();
        selectedToppings.clear();
        selectedExtras.clear();
        selectedNotas.clear();
        rerender();
      } else {
        await db.addItemToCuenta(activeCuentaId, product);
        rerender();
      }
    });
  }

  // Quick config panel actions
  const configPanel = document.querySelector('.quick-config-panel');
  if (configPanel) {
    configPanel.addEventListener('click', async (e) => {
      if (e.target.id === 'btn-cancel-config') {
        configuringProduct = null;
        rerender();
        return;
      }

      if (e.target.id === 'btn-confirm-config') {
        const config = {
          variante: selectedVariant,
          sabores: Array.from(selectedSabores),
          coberturas: Array.from(selectedCoberturas),
          toppings: Array.from(selectedToppings),
          extras: Array.from(selectedExtras)
            .map(en => db.EXTRAS.find(ex => ex.nombre === en))
            .filter(Boolean),
          notas: Array.from(selectedNotas)
        };
        await db.addItemToCuenta(activeCuentaId, configuringProduct, config);
        configuringProduct = null;
        rerender();
        return;
      }

      const variantBtn = e.target.closest('.variant-btn');
      if (variantBtn) {
        const idx = variantBtn.dataset.variantIdx;
        selectedVariant = configuringProduct.variantes[idx];
        rerender();
        return;
      }

      const saborBtn = e.target.closest('.sabor-btn');
      if (saborBtn && !saborBtn.hasAttribute('disabled')) {
        const s = saborBtn.dataset.sabor;
        if (selectedSabores.has(s)) selectedSabores.delete(s);
        else selectedSabores.add(s);
        rerender();
        return;
      }

      const coberturaBtn = e.target.closest('.cobertura-btn');
      if (coberturaBtn && !coberturaBtn.hasAttribute('disabled')) {
        const c = coberturaBtn.dataset.cobertura;
        if (selectedCoberturas.has(c)) selectedCoberturas.delete(c);
        else selectedCoberturas.add(c);
        rerender();
        return;
      }

      const toppingBtn = e.target.closest('.topping-btn');
      if (toppingBtn && !toppingBtn.hasAttribute('disabled')) {
        const t = toppingBtn.dataset.topping;
        if (selectedToppings.has(t)) selectedToppings.delete(t);
        else selectedToppings.add(t);
        rerender();
        return;
      }

      const extraBtn = e.target.closest('.extra-btn');
      if (extraBtn) {
        const ex = extraBtn.dataset.extra;
        if (selectedExtras.has(ex)) selectedExtras.delete(ex);
        else selectedExtras.add(ex);
        rerender();
        return;
      }

      const notaBtn = e.target.closest('.nota-btn');
      if (notaBtn) {
        const n = notaBtn.dataset.nota;
        if (selectedNotas.has(n)) selectedNotas.delete(n);
        else selectedNotas.add(n);
        rerender();
        return;
      }
    });
  }

  // Cuenta item actions (add/remove)
  const cuentaItems = document.getElementById('cuenta-items');
  if (cuentaItems) {
    cuentaItems.addEventListener('click', async (e) => {
      const addBtn = e.target.closest('[data-add-product]');
      const removeBtn = e.target.closest('[data-remove-product]');
      if (addBtn && activeCuentaId) {
        await db.incrementItemQty(activeCuentaId, addBtn.dataset.addProduct);
        rerender();
      }
      if (removeBtn && activeCuentaId) {
        await db.removeItemFromCuenta(activeCuentaId, removeBtn.dataset.removeProduct);
        rerender();
      }
    });
  }

  // Enviar a Cocina button
  const btnCocina = document.getElementById('btn-enviar-cocina');
  if (btnCocina) {
    btnCocina.addEventListener('click', async () => {
      if (!activeCuentaId) return;
      const cuenta = db.getCuentaById(activeCuentaId);
      if (!cuenta || cuenta.items.length === 0) return;
      
      const pedido = await db.enviarACocina(activeCuentaId);
      if (pedido) {
        window.showToast('≡ƒæ¿ΓÇì≡ƒì│ Pedido enviado a cocina', 'success');
      }
    });
  }

  // Cobrar button
  const btnCobrar = document.getElementById('btn-cobrar');
  if (btnCobrar) {
    btnCobrar.addEventListener('click', () => {
      if (!activeCuentaId) return;
      const cuenta = db.getCuentaById(activeCuentaId);
      if (!cuenta || cuenta.items.length === 0) return;
      openPaymentModal(cuenta);
    });
  }

  // Cancel cuenta button
  const btnCancelar = document.getElementById('btn-cancelar-cuenta');
  if (btnCancelar) {
    btnCancelar.addEventListener('click', async () => {
      if (!activeCuentaId) return;
      const cuenta = db.getCuentaById(activeCuentaId);
      if (!cuenta) return;

      const itemCount = cuenta.items.reduce((s, i) => s + i.cantidad, 0);
      const confirmed = await window.showConfirm({
        icon: '≡ƒÜ½',
        title: `┬┐Cancelar Cuenta #${cuenta.numero}?`,
        message: 'Los productos de esta cuenta no se cobrar├ín. La cuenta quedar├í registrada como cancelada en el historial.',
        details: `
          <div class="confirm-cuenta-info">
            <div class="confirm-cuenta-row">
              <span>Productos</span><strong>${itemCount}</strong>
            </div>
            <div class="confirm-cuenta-row">
              <span>Total a perder</span><strong style="color: var(--danger);">${formatCurrency(cuenta.total)}</strong>
            </div>
          </div>
        `,
        confirmText: '≡ƒÜ½ S├¡, cancelar cuenta',
        confirmClass: 'btn-danger',
      });

      if (confirmed) {
        await db.cancelarCuenta(activeCuentaId);
        activeCuentaId = null;
        rerender();
        window.showToast('≡ƒÜ½ Cuenta cancelada', 'info');
      }
    });
  }

  // --- Mobile Bottom Sheet Toggles ---
  const fab = document.getElementById('mobile-cart-fab');
  const ticketPanel = document.querySelector('.right-panel'); // Changed from .ticket-panel to .right-panel
  
  // Inject handle for swiping down if not exists
  if (ticketPanel && !ticketPanel.querySelector('.bottom-sheet-handle')) {
    const handle = document.createElement('div');
    handle.className = 'bottom-sheet-handle';
    ticketPanel.insertBefore(handle, ticketPanel.firstChild);
    
    // Close on handle click or swipe down
    handle.addEventListener('click', () => {
      ticketPanel.classList.remove('bottom-sheet-active');
    });
  }

  if (fab && ticketPanel) {
    fab.addEventListener('click', () => {
      ticketPanel.classList.add('bottom-sheet-active');
    });
    
    // Update FAB text dynamically
    const cuenta = db.getCuentaById(activeCuentaId);
    if (cuenta) {
      const itemsCount = cuenta.items.reduce((s, i) => s + i.cantidad, 0);
      fab.innerHTML = `<span>≡ƒ¢Æ Ver Cuenta (${itemsCount})</span><strong>${formatCurrency(cuenta.total)}</strong>`;
      fab.style.display = 'flex';
    } else {
      fab.style.display = 'none';
    }
  }

  // Listen for sales changes to update day summary
  db.on('sale-added', updateDaySummary);
  db.on('sales-changed', updateDaySummary);
  
  // Listen for accounts changes from Cloud
  db.on('cuentas-changed', rerender);
}

function openPaymentModal(cuenta) {
  const modal = document.getElementById('payment-modal');
  const nameEl = document.getElementById('modal-product-name');
  const priceEl = document.getElementById('modal-product-price');

  const totalItems = cuenta.items.reduce((s, i) => s + i.cantidad, 0);
  nameEl.textContent = `≡ƒÄ½ Cuenta #${cuenta.numero} ┬╖ ${totalItems} productos`;
  priceEl.textContent = formatCurrency(cuenta.total);
  modal.style.display = 'flex';
}

export async function handlePayment(method) {
  if (!activeCuentaId) return;

  const cuenta = await db.cobrarCuenta(activeCuentaId, method);
  if (!cuenta) return;

  activeCuentaId = null;

  // Close modal
  const modal = document.getElementById('payment-modal');
  modal.style.display = 'none';

  rerender();
  window.showToast(`Γ£à Cuenta #${cuenta.numero} cobrada (${method}) - ${formatCurrency(cuenta.total)}`, 'success');
}

function rerender() {
  const container = document.getElementById('page-container');
  if (container) {
    container.innerHTML = render();
    init();
  }
}

function updateDaySummary() {
  const jornadaSales = db.getSalesForJornada();
  const summary = db.calcDaySummary(jornadaSales);

  const cashEl = document.getElementById('total-cash');
  const cardEl = document.getElementById('total-card');
  const transferEl = document.getElementById('total-transfer');
  const totalEl = document.getElementById('total-amount');
  const countEl = document.getElementById('sales-count');
  const avgEl = document.getElementById('sales-avg');

  if (cashEl) cashEl.textContent = formatCurrency(summary.efectivo);
  if (cardEl) cardEl.textContent = formatCurrency(summary.tarjeta);
  if (transferEl) transferEl.textContent = formatCurrency(summary.transferencia);
  if (totalEl) {
    totalEl.textContent = formatCurrency(summary.total);
    totalEl.classList.add('sale-flash');
    setTimeout(() => totalEl.classList.remove('sale-flash'), 300);
  }
  if (countEl) countEl.textContent = summary.count;
  if (avgEl) avgEl.textContent = formatCurrency(summary.average);
}

export function cleanup() {
  db.off('sale-added', updateDaySummary);
  db.off('sales-changed', updateDaySummary);
  db.off('cuentas-changed', rerender);
}
