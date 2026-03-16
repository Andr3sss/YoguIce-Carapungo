import { getPedidosCocina, actualizarEstadoCocina, on, off } from '../db.js';
import { formatTime } from '../main.js';

let intervalId = null;

function getTimeSince(timestamp) {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return `${diff}s`;
  const mins = Math.floor(diff / 60);
  return `${mins} min`;
}

function getTimerClass(timestamp, estado) {
  if (estado === 'listo') return '';
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  // Alerta después de 5 minutos (300 defaults)
  if (diff > 300) return 'alerta';
  return '';
}

export function render() {
  const pedidos = getPedidosCocina().filter(p => p.estado !== 'listo');
  
  // Ordenar: primero los más antiguos
  pedidos.sort((a, b) => a.timestamp - b.timestamp);

  const stats = {
    pendientes: pedidos.filter(p => p.estado === 'pendiente').length,
    preparando: pedidos.filter(p => p.estado === 'en_preparacion').length,
    total: pedidos.length
  };

  return `
    <div class="kds-layout">
      <header class="kds-header">
        <h1>👨‍🍳 Pantalla de Cocina</h1>
        <div class="kds-stats">
          <div class="kds-stat" style="color: var(--accent-pink);">
            <span>⏱ Pendientes:</span>
            <strong>${stats.pendientes}</strong>
          </div>
          <div class="kds-stat" style="color: var(--warning);">
            <span>🔥 En Preparación:</span>
            <strong>${stats.preparando}</strong>
          </div>
          <div class="kds-stat">
            <span>📋 Total:</span>
            <strong>${stats.total}</strong>
          </div>
        </div>
      </header>

      ${pedidos.length === 0 ? `
        <div class="empty-state" style="margin: auto;">
          <div class="empty-icon" style="font-size: 64px;">✨</div>
          <h2 style="font-size: 24px; margin-top: 16px;">¡Cocina al día!</h2>
          <p style="color: var(--text-secondary); font-size: 18px;">No hay pedidos pendientes por el momento.</p>
        </div>
      ` : `
        <div class="kds-grid" id="kds-grid">
          ${pedidos.map(p => `
            <div class="kds-card estado-${p.estado}">
              <div class="kds-card-header">
                <div class="kds-cuenta-id">Mesa / # ${p.mesaNumero}</div>
                <div class="kds-timer timer-auto ${getTimerClass(p.timestamp, p.estado)}" data-timestamp="${p.timestamp}">
                  ${getTimeSince(p.timestamp)}
                </div>
              </div>
              
              <div class="kds-items">
                ${p.items.map(item => `
                  <div class="kds-item">
                    <div class="kds-item-qty">${item.cantidad}</div>
                    <div class="kds-item-details">
                      <div class="kds-item-name">${item.nombre}</div>
                      ${item.detalles ? `<div class="kds-item-options">${item.detalles}</div>` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>

              <div class="kds-card-actions">
                ${p.estado === 'pendiente' ? `
                  <button class="kds-btn kds-btn-start btn-action-cocina" data-id="${p.id}" data-action="en_preparacion">
                    🔥 Iniciar Preparación
                  </button>
                ` : `
                  <button class="kds-btn kds-btn-finish btn-action-cocina" data-id="${p.id}" data-action="listo">
                    ✅ Marcar como Listo
                  </button>
                `}
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
}

function handleCocinaUpdate() {
  const container = document.getElementById('page-container');
  if (container) {
    container.innerHTML = render();
    // We must re-bind the container-specific events after overwriting innerHTML.
    // However, the global `storage` event and `intervalId` are already bound.
  }
}

// Timer para actualizar las horas (cada segundo)
function updateTimers() {
  const timers = document.querySelectorAll('.timer-auto');
  timers.forEach(t => {
    const timestamp = parseInt(t.dataset.timestamp);
    if (!timestamp) return;
    
    t.textContent = getTimeSince(timestamp);
    
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    // Si pasa 5 mins y no tiene la clase, ponsela
    if (diff > 300 && !t.classList.contains('alerta')) {
      t.classList.add('alerta');
    }
  });
}

// Delegación de eventos global para el contenedor KDS
async function handleKdsClicks(e) {
  const btn = e.target.closest('.btn-action-cocina');
  if (!btn) return;
  
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  
  await actualizarEstadoCocina(id, action);
  handleCocinaUpdate();
}

function handleStorage(e) {
  if (e.key === 'heladeria_cocina' || e.key === 'kds_ping') {
    handleCocinaUpdate();
  }
}

export function init() {
  const container = document.getElementById('page-container');
  
  if (container) {
    // Usar delegación a nivel de page-container que persiste
    // a pesar de que se cambie el innerHTML, asegurando no añadir múltiples listeners.
    container.removeEventListener('click', handleKdsClicks);
    container.addEventListener('click', handleKdsClicks);
  }

  // Real-time synchronization within the same app
  on('cocina-added', handleCocinaUpdate);
  on('cocina-updated', handleCocinaUpdate);

  // Cross-tab synchronization via localStorage
  window.removeEventListener('storage', handleStorage);
  window.addEventListener('storage', handleStorage);

  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(updateTimers, 1000);
}

export function cleanup() {
  const container = document.getElementById('page-container');
  if (container) {
    container.removeEventListener('click', handleKdsClicks);
  }
  
  off('cocina-added', handleCocinaUpdate);
  off('cocina-updated', handleCocinaUpdate);
  window.removeEventListener('storage', handleStorage);
  
  if (intervalId) clearInterval(intervalId);
}
