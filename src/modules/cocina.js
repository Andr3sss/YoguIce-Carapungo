import { getPedidosCocinaJornada, actualizarEstadoCocina, actualizarItemCocina, getCuentaById, archivarPedidosAntiguosCocina, on, off, getAperturaHoy } from '../db.js';
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

/**
 * Parses the structured details string and returns improved HTML.
 * Handles grouping for "Promo" products by sub-product (e.g., Copa 1, Copa 2).
 */
function formatItemDetails(details) {
  if (!details) return '';

  // Split by categories
  const parts = details.split(' | ');

  // Detect if it contains bracketed sub-items like [Label 1: ...] or [Copa 1: ...]
  const hasSubItems = /\[[^\]]+:\s/.test(details);

  if (hasSubItems) {
    const subProducts = {}; 
    const extras = [];

    parts.forEach(part => {
      if (part.includes('📝')) return;
      if (part.startsWith('Extras:')) {
        extras.push(part.replace('Extras: ', '').trim());
        return;
      }
      
      const [catLabel, ...valRest] = part.split(': ');
      if (valRest.length === 0) {
        extras.push(part);
        return;
      }
      const valStr = valRest.join(': ');

      // Match all bracketed items [Sub: details]
      const matches = valStr.match(/\[([^\]]+)\]/g);
      if (matches) {
        matches.forEach(m => {
          const clean = m.slice(1, -1); // remove [ ]
          const sepIdx = clean.indexOf(': ');
          if (sepIdx !== -1) {
            const subLabel = clean.substring(0, sepIdx).trim();
            const detailsText = clean.substring(sepIdx + 2).trim();
            if (!subProducts[subLabel]) subProducts[subLabel] = [];
            subProducts[subLabel].push(`<strong>${catLabel}:</strong> ${detailsText}`);
          }
        });
      } else {
        extras.push(part);
      }
    });

    const sortedKeys = Object.keys(subProducts).sort((a, b) => 
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    if (sortedKeys.length > 0) {
      let html = '<div class="kds-promo-container">';
      sortedKeys.forEach(label => {
        html += `
          <div class="kds-promo-sub">
            <div class="sub-label">${label.toUpperCase()}</div>
            <div class="sub-details">${subProducts[label].join('<br>')}</div>
          </div>
        `;
      });
      
      if (extras.length > 0) {
        html += `<div class="kds-item-extras-list"><strong>EXTRAS:</strong> ${extras.join(', ')}</div>`;
      }
      html += '</div>';
      return html;
    }
  }

  // Fallback for regular orders: split categories into separate lines and bold labels
  return `<div class="kds-regular-details">
    ${parts.filter(p => !p.includes('📝')).map(p => {
      if (p.includes(': ')) {
        const [label, ...val] = p.split(': ');
        return `<div><strong>${label}:</strong> ${val.join(': ')}</div>`;
      }
      return `<div>${p}</div>`;
    }).join('')}
  </div>`;
}

export function render() {
  const allPedidos = getPedidosCocinaJornada();
  const apertura = getAperturaHoy();
  const threshold = apertura ? apertura.timestamp_apertura : 0;
  
  // Detectar si hay pedidos de sesiones anteriores abiertos (basado en timestamp)
  const hasOldPedidos = allPedidos.some(p => p.estado !== 'listo' && p.estado !== 'cancelado' && (p.timestamp < threshold));

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
          <h1>👨‍🍳 Cocina YOGU-ICE CARAPUNGO</h1>
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
                        ${item.detalles ? `<div class="kds-item-options">${formatItemDetails(item.detalles)}</div>` : ''}
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
  if (e.key === 'carapungo_cocina' || e.key === 'kds_ping' || e.key === 'carapungo_cuentas') {
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
