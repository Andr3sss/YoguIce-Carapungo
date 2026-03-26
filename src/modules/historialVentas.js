import { getCuentasCerradasJornada, on, off } from '../db.js';
import { formatCurrency } from '../main.js';

export function render() {
  const accounts = getCuentasCerradasJornada().sort((a, b) => b.timestamp_cierre - a.timestamp_cierre);

  return `
    <div class="kds-layout">
      <header class="kds-header">
        <div style="display:flex; align-items:center; gap:20px;">
          <h1>🧾 Historial de Ventas (Hoy)</h1>
        </div>
        <div class="kds-header-actions">
           <div class="kds-stat" style="color: var(--accent-mint); font-size: 18px;">
             <span>Total Vendido Hoy:</span>
             <strong style="font-size: 24px;">${formatCurrency(accounts.reduce((sum, c) => sum + c.total, 0))}</strong>
           </div>
        </div>
      </header>

      ${accounts.length === 0 ? `
        <div class="empty-state" style="margin: auto;">
          <div class="empty-icon" style="font-size: 64px;">🧾</div>
          <h2 style="font-size: 24px; margin-top: 16px;">Sin ventas aún</h2>
          <p style="color: var(--text-secondary); font-size: 18px;">Las ventas cerradas aparecerán aquí.</p>
        </div>
      ` : `
        <div class="kds-grid" style="padding-bottom: 20px;">
          ${accounts.map(c => {
             // Let's use custom 320px widths as requested by user to look like the old KDS styles
             let paymentColor = 'var(--text-muted)';
             if (c.metodo_pago === 'efectivo') paymentColor = 'var(--cash-color)';
             if (c.metodo_pago === 'tarjeta') paymentColor = 'var(--card-color)';
             if (c.metodo_pago === 'transferencia') paymentColor = 'var(--transfer-color)';
             
             return `
            <div class="kds-card" style="width: 320px; min-width: 320px; max-width: 320px; height: auto;">
              <div class="kds-card-header" style="padding: 15px;">
                <div class="kds-header-info">
                  <div class="kds-mesa-tag" style="font-size: 22px; letter-spacing: 0;">MESA ${c.mesa || 'S/M'}</div>
                  <div class="kds-meta-row" style="margin-top: 6px;">
                    <span class="kds-pedido-id" style="font-size: 14px;">Pedido: #${c.numero}</span>
                    <span class="kds-payment-badge" style="background: rgba(255,255,255,0.05); color: ${paymentColor}; border: 1px solid ${paymentColor}; font-size: 11px;">
                      ${c.metodo_pago.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div class="kds-timer" style="background: rgba(255, 255, 255, 0.1); color: #fff; font-size: 14px;">
                  ⏱ ${c.hora_cierre.substring(0, 5)}
                </div>
              </div>
              
              <div class="kds-items" style="max-height: 250px; overflow-y: auto; padding: 15px;">
                ${c.items.map(item => `
                  <div class="kds-item" style="margin-bottom: 8px;">
                    <div class="kds-item-qty" style="font-size: 18px;">${item.cantidad}</div>
                    <div class="kds-item-details">
                      <div class="kds-item-name" style="font-size: 16px; font-weight: 700;">${item.nombre}</div>
                      ${item.detalles ? `<div class="kds-item-options" style="font-size: 13px; font-weight: 500; font-style: normal; margin-top: 2px;">${item.detalles}</div>` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>

              <div class="kds-card-actions" style="background: rgba(255, 107, 157, 0.1); border-top: 1px solid rgba(255, 107, 157, 0.2); display: flex; justify-content: space-between; align-items: center; padding: 15px;">
                <span style="font-size: 14px; font-weight: 700; color: var(--accent-pink);">TOTAL COBRADO:</span>
                <span style="font-size: 24px; font-weight: 900; color: #fff;">${formatCurrency(c.total)}</span>
              </div>
            </div>
            `
          }).join('')}
        </div>
      `}
    </div>
  `;
}

export function init() {
  on('cuentas-changed', rerender);
  on('cuenta-cerrada', rerender);
}

function rerender() {
  const container = document.getElementById('page-container');
  // Only rerender if we are currently on the historialVentas page
  // We can check this by seeing if our distinct header exists
  if (container && container.querySelector('h1')?.textContent.includes('Historial de Ventas')) {
    container.innerHTML = render();
  }
}

export function cleanup() {
  off('cuentas-changed', rerender);
  off('cuenta-cerrada', rerender);
}
