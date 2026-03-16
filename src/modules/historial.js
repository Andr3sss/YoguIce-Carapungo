// ========================================
// 🍦 Heladería POS - Historial Module
// History of daily cash closings
// ========================================

import * as db from '../db.js';
import { formatCurrency } from '../main.js';

export function render() {
  const cierres = db.getCierres().slice().reverse();

  return `
    <div class="page-header">
      <h2>📋 Historial de Cierres</h2>
      <p>Registro de todos los cierres de caja realizados</p>
    </div>

    ${cierres.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <p>No hay cierres de caja registrados</p>
        <p style="font-size: 12px; margin-top: 8px;">Realiza tu primer cierre en la sección "Cuadre de Caja"</p>
      </div>
    ` : `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Total Ventas</th>
              <th>Efectivo</th>
              <th>Tarjeta</th>
              <th>Transferencia</th>
              <th>Efectivo Contado</th>
              <th>Diferencia</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${cierres.map(c => {
              const diff = c.diferencia;
              const statusClass = Math.abs(diff) < 0.01 ? 'active' : diff < 0 ? 'inactive' : 'active';
              const statusLabel = Math.abs(diff) < 0.01 ? 'Cuadrada' : diff < 0 ? 'Faltante' : 'Sobrante';
              return `
                <tr>
                  <td style="font-weight: 600; color: var(--text-primary);">
                    ${new Date(c.fecha + 'T12:00:00').toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </td>
                  <td style="font-weight: 700; color: var(--accent-pink);">${formatCurrency(c.total_dia)}</td>
                  <td style="color: var(--cash-color);">${formatCurrency(c.total_efectivo_sistema)}</td>
                  <td style="color: var(--card-color);">${formatCurrency(c.total_tarjeta)}</td>
                  <td style="color: var(--transfer-color);">${formatCurrency(c.total_transferencia)}</td>
                  <td>${formatCurrency(c.efectivo_real)}</td>
                  <td style="font-weight: 700; color: ${Math.abs(diff) < 0.01 ? 'var(--success)' : diff < 0 ? 'var(--danger)' : 'var(--warning)'};">
                    ${Math.abs(diff) < 0.01 ? '$0.00' : (diff > 0 ? '+' : '-') + formatCurrency(Math.abs(diff))}
                  </td>
                  <td><span class="badge ${statusClass}">${statusLabel}</span></td>
                  <td>
                    <button class="btn btn-ghost btn-sm" data-detail-date="${c.fecha}">Ver detalle</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Summary stats -->
      <div class="stats-grid" style="margin-top: 24px;">
        <div class="stat-card pink">
          <div class="stat-number">${cierres.length}</div>
          <div class="stat-desc">Cierres Realizados</div>
        </div>
        <div class="stat-card mint">
          <div class="stat-number">${formatCurrency(cierres.reduce((s, c) => s + c.total_dia, 0))}</div>
          <div class="stat-desc">Total Histórico</div>
        </div>
        <div class="stat-card lavender">
          <div class="stat-number">${formatCurrency(cierres.length > 0 ? cierres.reduce((s, c) => s + c.total_dia, 0) / cierres.length : 0)}</div>
          <div class="stat-desc">Promedio por Día</div>
        </div>
        <div class="stat-card ${cierres.filter(c => Math.abs(c.diferencia) < 0.01).length === cierres.length ? 'mint' : 'peach'}">
          <div class="stat-number">${cierres.filter(c => Math.abs(c.diferencia) < 0.01).length}/${cierres.length}</div>
          <div class="stat-desc">Cajas Cuadradas</div>
        </div>
      </div>
    `}

    <!-- Detail modal -->
    <div id="detail-modal" class="modal-overlay" style="display:none;">
      <div class="modal" style="max-width: 560px;">
        <div class="modal-header">
          <h2>📋 Detalle del Día</h2>
          <button class="modal-close" id="detail-close">&times;</button>
        </div>
        <div id="detail-content"></div>
      </div>
    </div>
  `;
}

export function init() {
  // Detail buttons
  document.querySelectorAll('[data-detail-date]').forEach(btn => {
    btn.addEventListener('click', () => showDetail(btn.dataset.detailDate));
  });

  // Close detail modal
  const closeBtn = document.getElementById('detail-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      document.getElementById('detail-modal').style.display = 'none';
    });
  }

  const detailModal = document.getElementById('detail-modal');
  if (detailModal) {
    detailModal.addEventListener('click', (e) => {
      if (e.target === detailModal) detailModal.style.display = 'none';
    });
  }
}

function showDetail(dateStr) {
  const sales = db.getSalesByDate(dateStr);
  const cierre = db.getCierreByDate(dateStr);
  const summary = db.calcDaySummary(sales);
  const dateLabel = new Date(dateStr + 'T12:00:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const contentEl = document.getElementById('detail-content');
  contentEl.innerHTML = `
    <p style="color: var(--text-secondary); margin-bottom: 16px;">${dateLabel}</p>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px;">
      <div class="stat-row cash" style="padding: 12px; flex-direction: column; align-items: center;">
        <span style="font-size: 12px; color: var(--text-muted);">Efectivo</span>
        <span style="font-size: 18px; font-weight: 700; color: var(--cash-color);">${formatCurrency(summary.efectivo)}</span>
      </div>
      <div class="stat-row card" style="padding: 12px; flex-direction: column; align-items: center;">
        <span style="font-size: 12px; color: var(--text-muted);">Tarjeta</span>
        <span style="font-size: 18px; font-weight: 700; color: var(--card-color);">${formatCurrency(summary.tarjeta)}</span>
      </div>
      <div class="stat-row transfer" style="padding: 12px; flex-direction: column; align-items: center;">
        <span style="font-size: 12px; color: var(--text-muted);">Transferencia</span>
        <span style="font-size: 18px; font-weight: 700; color: var(--transfer-color);">${formatCurrency(summary.transferencia)}</span>
      </div>
      <div class="stat-row" style="padding: 12px; flex-direction: column; align-items: center; background: rgba(255,107,157,0.1);">
        <span style="font-size: 12px; color: var(--text-muted);">Total</span>
        <span style="font-size: 18px; font-weight: 700; color: var(--accent-pink);">${formatCurrency(summary.total)}</span>
      </div>
    </div>

    <h4 style="font-size: 14px; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">Ventas del Día (${sales.length})</h4>
    <div style="max-height: 300px; overflow-y: auto;">
      ${sales.length > 0 ? sales.map(s => `
        <div class="sale-item">
          <div class="sale-info">
            <span class="sale-time">${s.hora.substring(0, 5)}</span>
            <span>${s.producto_nombre}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="sale-method ${s.metodo_pago}">${s.metodo_pago}</span>
            <span class="sale-amount">${formatCurrency(s.precio)}</span>
          </div>
        </div>
      `).join('') : '<p style="color: var(--text-muted); text-align: center; padding: 16px;">Sin ventas registradas</p>'}
    </div>
  `;

  document.getElementById('detail-modal').style.display = 'flex';
}

export function cleanup() {}
