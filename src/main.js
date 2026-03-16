// ========================================
// 🍦 Heladería POS - Main Entry Point
// ========================================

import { initDB, on, isDiaAbierto, getAperturaHoy } from './db.js';

// Import modules
import * as ventas from './modules/ventas.js';
import * as cuadre from './modules/cuadre.js';
import * as historial from './modules/historial.js';
import * as reportes from './modules/reportes.js';
import * as productos from './modules/productos.js';
import * as estadisticas from './modules/estadisticas.js';
import * as cocina from './modules/cocina.js';
import * as gastos from './modules/gastos.js';

// ========================================
// Helpers (exported for modules)
// ========================================

export function formatCurrency(amount) {
  return '$' + Number(amount).toFixed(2);
}

export function formatTime(timeStr) {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  return parts[0] + ':' + parts[1];
}

// ========================================
// Toast notification
// ========================================

window.showToast = function (message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';
  toast.style.animation = 'toastIn 0.3s ease forwards';

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 300);
  }, 2000);
};

// ========================================
// Custom Confirm Modal (replaces confirm())
// ========================================

let confirmResolve = null;

function setupConfirmModal() {
  const modal = document.getElementById('confirm-modal');
  const cancelBtn = document.getElementById('confirm-cancel-btn');
  const okBtn = document.getElementById('confirm-ok-btn');

  cancelBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    if (confirmResolve) confirmResolve(false);
    confirmResolve = null;
  });

  okBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    if (confirmResolve) confirmResolve(true);
    confirmResolve = null;
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
      if (confirmResolve) confirmResolve(false);
      confirmResolve = null;
    }
  });
}

/**
 * Shows a styled confirmation modal. Returns a Promise<boolean>.
 * @param {object} opts - { icon, title, message, details, confirmText, confirmClass }
 */
window.showConfirm = function (opts = {}) {
  const modal = document.getElementById('confirm-modal');
  document.getElementById('confirm-icon').textContent = opts.icon || '⚠️';
  document.getElementById('confirm-title').textContent = opts.title || '¿Estás seguro?';
  document.getElementById('confirm-message').innerHTML = opts.message || 'Esta acción no se puede deshacer.';

  const detailsEl = document.getElementById('confirm-details');
  detailsEl.innerHTML = opts.details || '';
  detailsEl.style.display = opts.details ? 'block' : 'none';

  const okBtn = document.getElementById('confirm-ok-btn');
  okBtn.textContent = opts.confirmText || 'Confirmar';
  okBtn.className = `btn btn-lg ${opts.confirmClass || 'btn-danger'}`;

  modal.style.display = 'flex';

  return new Promise((resolve) => {
    confirmResolve = resolve;
  });
};

// ========================================
// Modules registry
// ========================================

const modules = {
  ventas,
  cuadre,
  historial,
  reportes,
  productos,
  estadisticas,
  cocina,
  gastos,
};

let currentPage = 'ventas';
let currentModule = null;

// ========================================
// Navigation
// ========================================

function afterRender(container, module) {
  // Re-trigger animation
  container.style.animation = 'none';
  container.offsetHeight; // force reflow
  container.style.animation = 'fadeIn 0.2s ease';

  // Init module
  if (module && module.init) module.init();
}

function navigateTo(page) {
  // Cleanup current module
  if (currentModule && currentModule.cleanup) {
    currentModule.cleanup();
  }

  currentPage = page;
  currentModule = modules[page];

  // Render page
  const container = document.getElementById('page-container');
  if (container && currentModule) {
    const renderResult = currentModule.render();
    
    // Support both sync and async render
    if (renderResult instanceof Promise) {
      renderResult.then(html => {
        container.innerHTML = html;
        afterRender(container, currentModule);
      });
    } else {
      container.innerHTML = renderResult;
      afterRender(container, currentModule);
    }
  }

  // Handle KDS full screen layout (hide sidebar)
  if (page === 'cocina') {
    document.body.classList.add('kds-mode');
  } else {
    document.body.classList.remove('kds-mode');
  }

  // Update nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });
}

// Expose globally for modules
window.navigateTo = navigateTo;

// ========================================
// Clock
// ========================================

function updateClock() {
  const clockEl = document.getElementById('sidebar-clock');
  if (clockEl) {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}

// ========================================
// Apertura status in sidebar
// ========================================

function updateAperturaStatus() {
  const el = document.getElementById('apertura-status');
  if (!el) return;

  const abierto = isDiaAbierto();
  const apertura = getAperturaHoy();

  if (abierto && apertura) {
    el.innerHTML = `<span class="apertura-dot open"></span><span class="apertura-text">Día abierto · ${formatTime(apertura.hora_apertura)}</span>`;
    el.className = 'apertura-status open';
  } else if (apertura && apertura.estado === 'cerrado') {
    el.innerHTML = `<span class="apertura-dot closed"></span><span class="apertura-text">Día cerrado</span>`;
    el.className = 'apertura-status closed';
  } else {
    el.innerHTML = `<span class="apertura-dot pending"></span><span class="apertura-text">Sin apertura</span>`;
    el.className = 'apertura-status pending';
  }
}

// ========================================
// Payment modal handlers
// ========================================

function setupPaymentModal() {
  const modal = document.getElementById('payment-modal');
  const closeBtn = document.getElementById('modal-close');

  // Close button
  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });

  // Payment method buttons
  document.querySelectorAll('.payment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const method = btn.dataset.method;
      if (currentModule && currentModule.handlePayment) {
        currentModule.handlePayment(method);
      }
    });
  });
}

// ========================================
// Init
// ========================================

function init() {
  // Initialize database
  initDB();

  // Setup navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      navigateTo(btn.dataset.page);
    });
  });

  // Setup modals
  setupPaymentModal();
  setupConfirmModal();

  // Start clock
  updateClock();
  setInterval(updateClock, 1000);

  // Apertura status
  updateAperturaStatus();
  on('apertura-changed', updateAperturaStatus);

  // Navigate to default page
  navigateTo('ventas');
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
