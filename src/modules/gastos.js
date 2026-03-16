// ========================================
// 🍦 Heladería POS - Gastos Module
// Manage operational expenses
// ========================================

import * as db from '../db.js';
import { formatCurrency } from '../main.js';

export function render() {
  const gastos = db.getGastos().slice().sort((a, b) => b.timestamp - a.timestamp);
  const totalGastos = gastos.reduce((sum, g) => sum + g.monto, 0);

  return `
    <div class="page-header">
      <h2>💸 Registro de Gastos</h2>
      <p>Controla los egresos operativos de la heladería</p>
    </div>

    <div style="max-width: 900px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 24px;">
      
      <!-- New Gasto Form -->
      <div class="card" style="padding: 24px;">
        <h3 style="margin-top: 0; margin-bottom: 20px; font-size: 18px;">➕ Registrar Gasto</h3>
        
        <div class="form-group">
          <label class="form-label">Descripción del Gasto</label>
          <input type="text" id="gasto-desc" class="form-input" placeholder="Ej: Compra de leche, Pago luz..." maxlength="50" />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Monto ($)</label>
            <input type="number" id="gasto-monto" class="form-input" placeholder="0.00" step="0.01" min="0.01" />
          </div>
          <div class="form-group">
            <label class="form-label">Categoría</label>
            <select id="gasto-cat" class="form-input">
              <option value="Insumos">Insumos</option>
              <option value="Servicios">Servicios</option>
              <option value="Personal">Personal</option>
              <option value="Mantenimiento">Mantenimiento</option>
              <option value="Otros">Otros</option>
            </select>
          </div>
        </div>

        <button class="btn btn-primary btn-lg" id="btn-save-gasto" style="width: 100%; margin-top: 8px;">
          💾 Guardar Gasto
        </button>
      </div>

      <!-- Totals & History Summary -->
      <div style="display: flex; flex-direction: column; gap: 24px;">
        <div class="stat-card lavender" style="padding: 32px 24px; text-align: center;">
          <div class="stat-desc" style="font-size: 14px; text-transform: uppercase;">Total Gastos Registrados</div>
          <div class="stat-number" style="font-size: 42px; margin-top: 8px;">${formatCurrency(totalGastos)}</div>
        </div>

        <div class="card" style="padding: 20px; flex-grow: 1;">
          <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 16px;">📋 Últimos Gastos</h3>
          
          <div class="table-container" style="border: none; max-height: 400px; overflow-y: auto;">
            ${gastos.length === 0 ? `
              <div style="text-align: center; color: var(--text-muted); padding: 40px 0;">
                <p>No hay gastos registrados aún</p>
              </div>
            ` : `
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Concepto</th>
                    <th style="text-align: right;">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  ${gastos.slice(0, 10).map(g => `
                    <tr>
                      <td style="font-size: 12px; color: var(--text-muted);">${g.fecha}</td>
                      <td>
                        <div style="font-weight: 500;">${g.descripcion}</div>
                        <div style="font-size: 10px; opacity: 0.6;">${g.categoria}</div>
                      </td>
                      <td style="text-align: right; font-weight: 700; color: var(--danger);">${formatCurrency(g.monto)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>
        </div>
      </div>
    </div>
  `;
}

export function init() {
  const btnSave = document.getElementById('btn-save-gasto');
  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      const descInput = document.getElementById('gasto-desc');
      const montoInput = document.getElementById('gasto-monto');
      const catInput = document.getElementById('gasto-cat');

      const descripcion = descInput.value.trim();
      const monto = parseFloat(montoInput.value);
      const categoria = catInput.value;

      if (!descripcion || isNaN(monto) || monto <= 0) {
        window.showToast('❌ Ingresa una descripción y un monto válido', 'error');
        return;
      }

      const confirmed = await window.showConfirm({
        icon: '💸',
        title: '¿Registrar este gasto?',
        message: `Se descontará <b>${formatCurrency(monto)}</b> de los balances globales.`,
        details: `<div style="text-align:center; padding: 10px; background: rgba(0,0,0,0.05); border-radius: 8px;"><b>${descripcion}</b> (${categoria})</div>`,
        confirmText: '💸 Registrar Gasto',
        confirmClass: 'btn-danger'
      });

      if (!confirmed) return;

      const result = await db.addGasto({ descripcion, monto, categoria });
      if (result) {
        window.showToast('✅ Gasto registrado correctamente', 'success');
        renderGastos();
      }
    });
  }

  // Cloud Sync listener
  db.on('gastos-changed', renderGastos);
}

function renderGastos() {
  const container = document.getElementById('page-container');
  if (container) {
    container.innerHTML = render();
    init();
  }
}

export function cleanup() {
  db.off('gastos-changed', renderGastos);
}
