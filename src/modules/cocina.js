import { getPedidosCocina, actualizarEstadoCocina, actualizarItemCocina, getCuentaById, archivarPedidosAntiguosCocina, on, off } from '../db.js';
import { formatTime, formatCurrency } from '../main.js';

let intervalId = null;
let showHistory = false;

function getTimeSince(timestamp) {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return `${diff}s`;
  const mins = Math.floor(diff / 60);
  return `${mins} min`;
}

function getTimerClass(timestamp, estado) {
  if (estado === 'listo') return '';
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff > 300) return 'alerta';
  return '';
}

export function render() {
  const allPedidos = getPedidosCocina();
  const today = new Date().toISOString().split('T')[0];
  
  // Detectar si hay pedidos de días anteriores abiertos
  const hasOldPedidos = allPedidos.some(p => p.estado !== 'listo' && p.estado !== 'cancelado' && (!p.fecha || p.fecha < today));

  const pedidos = showHistory 
    ? allPedidos.filter(p => p.estado === 'listo').sort((a, b) => b.timestamp - a.timestamp)
    : allPedidos.filter(p => p.estado !== 'listo').sort((a, b) => a.timestamp - b.timestamp);
  
  const stats = {
    pendientes: allPedidos.filter(p => p.estado === 'pendiente').length,
    preparando: allPedidos.filter(p => p.estado === 'en_preparacion').length,
    total: allPedidos.filter(p => p.estado !== 'listo' && p.estado !== 'cancelado').length
  };

  return `
    <div class="kds-layout">
      <header class="kds-header">
        <div style="display:flex; align-items:center; gap:20px;">
          <button class="kds-back-btn" onclick="navigateTo('ventas')">
            <span>⬅️</span> Volver a Ventas
          </button>
          <h1>👨‍🍳 Cocina YOGU-ICE</h1>
        </div>

        <div class="kds-header-actions">
          <div class="history-toggle-container ${showHistory ? 'active' : ''}" id="kds-history-toggle">
            <span class="history-toggle-label">${showHistory ? 'Viendo Historial' : 'Ver Historial'}</span>
            <div class="history-toggle-switch"></div>
          </div>

          <div class="kds-stats">
            <div class="kds-stat" style="color: var(--accent-pink);">
              <span>⏱ Pendientes:</span>
              <strong>${stats.pendientes}</strong>
            </div>
            <div class="kds-stat" style="color: var(--warning);">
              <span>🔥 Preparando:</span>
              <strong>${stats.preparando}</strong>
            </div>
          </div>
        </div>
      </header>

      ${!showHistory && hasOldPedidos ? `
        <div class="kds-alert-banner">
          <div class="kds-alert-content">
            <span class="kds-alert-icon">⚠️</span>
            <div class="kds-alert-text">
              <strong>Atención:</strong> Tienes pedidos pendientes de días anteriores. 
              <small>Esto puede causar confusión con las nuevas órdenes de hoy.</small>
            </div>
          </div>
          <button class="kds-alert-btn" data-action="clear-old-orders">
            🧹 Limpiar Cocina
          </button>
        </div>
      ` : ''}

      ${pedidos.length === 0 ? `
        <div class="empty-state" style="margin: auto;">
          <div class="empty-icon" style="font-size: 64px;">${showHistory ? '📂' : '✨'}</div>
          <h2 style="font-size: 24px; margin-top: 16px;">${showHistory ? 'Historial vacío' : '¡Cocina al día!'}</h2>
          <p style="color: var(--text-secondary); font-size: 18px;">${showHistory ? 'No hay pedidos finalizados hoy.' : 'No hay pedidos pendientes por el momento.'}</p>
        </div>
      ` : `
        <div class="kds-grid" id="kds-grid">
          ${pedidos.map(p => {
            const cuenta = getCuentaById(p.cuentaId);
            const isPaid = cuenta && cuenta.estado === 'cerrada';
            const isCancelled = p.estado === 'cancelado';
            const mesaLabel = cuenta ? (cuenta.mesa || 'S/M') : (p.mesa || 'S/M');
            
            return `
              <div class="kds-card estado-${p.estado}">
                <div class="kds-card-header">
                  <div class="kds-header-info">
                    <div class="kds-mesa-tag">MESA ${mesaLabel}</div>
                    <div class="kds-meta-row">
                      <span class="kds-pedido-id">Pedido: #${p.mesaNumero}</span>
                      <span class="kds-payment-badge ${isCancelled ? 'cancelled' : isPaid ? 'paid' : 'unpaid'}">
                        ${isCancelled ? '🚫 CANCELADO' : isPaid ? '💰 PAGADO' : '⏳ PENDIENTE'}
                      </span>
                    </div>
                  </div>
                  <div class="kds-timer timer-auto ${getTimerClass(p.timestamp, p.estado)}" data-timestamp="${p.timestamp}">
                    ${getTimeSince(p.timestamp)}
                  </div>
                </div>
                
                <div class="kds-items">
                  ${p.items.map((item, idx) => `
                    <div class="kds-item ${item.preparado ? 'preparado' : ''} ${isCancelled ? 'cancelled-line' : ''}">
                      <div class="kds-item-check ${item.preparado ? 'checked' : ''}" 
                           data-id="${p.id}" data-idx="${idx}" data-action="${isCancelled ? 'none' : 'toggle-item-prep'}">
                        ${item.preparado ? '✓' : ''}
                      </div>
                      <div class="kds-item-qty">${item.cantidad}</div>
                      <div class="kds-item-details">
                        <div class="kds-item-name">${item.nombre}</div>
                        ${item.detalles ? `<div class="kds-item-options">${item.detalles}</div>` : ''}
                        ${item.notaCocina ? `<div class="kds-item-nota">📝 ${item.notaCocina}</div>` : ''}
                      </div>
                    </div>
                  `).join('')}
                </div>

                <div class="kds-card-actions">
                  ${p.estado === 'pendiente' ? `
                    <button class="kds-btn kds-btn-start btn-action-cocina" data-id="${p.id}" data-action="en_preparacion">
                      🔥 Iniciar Preparación
                    </button>
                  ` : p.estado === 'en_preparacion' ? `
                    <button class="kds-btn kds-btn-finish btn-action-cocina" data-id="${p.id}" data-action="listo">
                      ✅ Marcar como Listo
                    </button>
                  ` : p.estado === 'cancelado' ? `
                    <button class="kds-btn kds-btn-cancel-clear btn-action-cocina" data-id="${p.id}" data-action="listo" style="background: var(--danger); color: #fff;">
                      🗑️ Quitar Tarjeta
                    </button>
                  ` : `
                    <div style="text-align:center; padding:10px; color:var(--text-muted); font-size:12px; font-weight:700;">
                      FINALIZADO
                    </div>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>
  `;
}

async function handleKdsClicks(e) {
  // 1. Regular actions (en_preparacion, listo)
  const actionBtn = e.target.closest('.btn-action-cocina');
  if (actionBtn) {
    const id = actionBtn.dataset.id;
    const action = actionBtn.dataset.action;
    await actualizarEstadoCocina(id, action);
    handleCocinaUpdate();
    return;
  }

  // 2. Item checkmarks
  const checkBtn = e.target.closest('[data-action="toggle-item-prep"]');
  if (checkBtn) {
    const id = checkBtn.dataset.id;
    const idx = parseInt(checkBtn.dataset.idx);
    const isChecked = checkBtn.classList.contains('checked');
    await actualizarItemCocina(id, idx, !isChecked);
    handleCocinaUpdate();
    return;
  }

  // 3. History Toggle
  const historyToggle = e.target.closest('#kds-history-toggle');
  if (historyToggle) {
    showHistory = !showHistory;
    handleCocinaUpdate();
    return;
  }

  // 4. Clear old orders
  const clearOldBtn = e.target.closest('[data-action="clear-old-orders"]');
  if (clearOldBtn) {
    const confirmed = await window.showConfirm({
      icon: '🧹',
      title: 'Limpiar Cocina',
      message: '¿Estás seguro de que deseas archivar todos los pedidos de días anteriores?',
      confirmText: '🧹 Limpiar Ahora',
      confirmClass: 'btn-primary'
    });
    
    if (confirmed) {
      await archivarPedidosAntiguosCocina();
      handleCocinaUpdate();
    }
    return;
  }
}

function handleCocinaUpdate() {
  const container = document.getElementById('page-container');
  if (container) {
    container.innerHTML = render();
  }
}

function updateTimers() {
  const timers = document.querySelectorAll('.timer-auto');
  timers.forEach(t => {
    const timestamp = parseInt(t.dataset.timestamp);
    if (!timestamp) return;
    t.textContent = getTimeSince(timestamp);
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff > 300 && !t.classList.contains('alerta')) t.classList.add('alerta');
  });
}

function handleStorage(e) {
  if (e.key === 'heladeria_cocina' || e.key === 'kds_ping' || e.key === 'heladeria_cuentas') {
    handleCocinaUpdate();
  }
}

export function init() {
  const container = document.getElementById('page-container');
  if (container) {
    container.removeEventListener('click', handleKdsClicks);
    container.addEventListener('click', handleKdsClicks);
  }

  on('cocina-added', handleCocinaUpdate);
  on('cocina-updated', handleCocinaUpdate);
  on('cuentas-changed', handleCocinaUpdate);

  window.removeEventListener('storage', handleStorage);
  window.addEventListener('storage', handleStorage);

  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(updateTimers, 5000); // 5s is enough for timers
}

export function cleanup() {
  const container = document.getElementById('page-container');
  if (container) container.removeEventListener('click', handleKdsClicks);
  
  off('cocina-added', handleCocinaUpdate);
  off('cocina-updated', handleCocinaUpdate);
  off('cuentas-changed', handleCocinaUpdate);
  window.removeEventListener('storage', handleStorage);
  
  if (intervalId) clearInterval(intervalId);
}
