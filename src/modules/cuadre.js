// ========================================
// 🍦 Heladería POS - Cuadre de Caja Module
// Apertura y cierre del día + reconciliación
// ========================================

import * as db from '../db.js';
import { formatCurrency, formatTime } from '../main.js';

const TEMP_CONCILIACION_KEY = 'heladeria_tmp_conciliacion';
let conciliacionTransferencias = [];

function saveTempConciliacion() {
  localStorage.setItem(TEMP_CONCILIACION_KEY, JSON.stringify(conciliacionTransferencias));
}

function loadTempConciliacion() {
  try {
    const data = localStorage.getItem(TEMP_CONCILIACION_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

export function render() {
  const apertura = db.getAperturaHoy();

  // State machine: no apertura → show apertura form
  //                abierto → show cierre form
  //                cerrado → show cierre completed
  if (!apertura) {
    return renderAperturaForm();
  } else if (apertura.estado === 'abierto') {
    // Load reconciliation state from localStorage to prevent data loss on navigation
    conciliacionTransferencias = loadTempConciliacion();
    return renderCierreForm(apertura);
  } else {
    return renderCierreDone(apertura);
  }
}

// ========================================
// 1. Apertura del día
// ========================================

function renderAperturaForm() {
  const insumos = db.getActiveInsumos();
  
  return `
    <div class="page-header">
      <h2>☀️ Apertura del Día</h2>
      <p>Abre la caja para comenzar a registrar ventas</p>
    </div>

    <!-- Dashboard Layout Wrapper -->
    <div style="max-width: 900px; margin: 0 auto;">
      
      <!-- Dashboard Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 24px; margin-bottom: 24px;">
        
        <!-- Left Column: Financials -->
        <div class="card" style="padding: 32px 24px; text-align: center; display: flex; flex-direction: column; justify-content: center; align-items: center;">
          <div style="width: 72px; height: 72px; padding: 16px; border-radius: 50%; background: rgba(16, 185, 129, 0.1); font-size: 32px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">🔓</div>
          <h3 style="font-size: 22px; margin-top: 0; margin-bottom: 12px;">Iniciar jornada</h3>
          <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 32px; max-width: 250px;">
            Ingresa la cantidad de efectivo físico con la que abre tu caja hoy.
          </p>

          <div class="form-group" style="width: 100%; max-width: 300px; text-align: left;">
            <label class="form-label" style="font-size: 13px; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Efectivo Inicial en Caja ($)</label>
            <input type="number" id="efectivo-inicial" class="form-input large" placeholder="0.00" step="0.01" min="0" value="0" style="font-size: 28px; text-align: center; font-weight: 700; color: var(--accent-mint);" />
          </div>
        </div>

        <!-- Right Column: Inventory -->
        ${insumos.length > 0 ? `
          <div class="card" style="padding: 24px; display: flex; flex-direction: column;">
            <h4 style="margin-top: 0; margin-bottom: 16px; font-size: 16px; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
              <span>📦</span> Inventario Inicial
            </h4>
            <div style="background: var(--bg-tertiary); padding: 16px; border-radius: var(--radius-md); flex-grow: 1; display: flex; flex-direction: column;">
              
              <div style="display: grid; grid-template-columns: 1fr 100px; gap: 12px; font-size: 12px; color: var(--text-muted); margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border-color);">
                <div>INSUMO</div>
                <div style="text-align: center;">CANTIDAD</div>
              </div>
              
              <div style="max-height: 300px; overflow-y: auto; padding-right: 8px;">
                ${insumos.map(i => `
                  <div style="display: grid; grid-template-columns: 1fr 100px; gap: 12px; align-items: center; margin-bottom: 12px;">
                    <div style="font-size: 14px; font-weight: 500;">${i.nombre}</div>
                    <input type="number" class="form-input inventario-inicial-input" data-id="${i.id}" data-nombre="${i.nombre}" placeholder="0" min="0" value="0" style="text-align: center; font-size: 15px; font-weight: 600;" />
                  </div>
                `).join('')}
              </div>

            </div>
          </div>
        ` : `
          <!-- Placeholder if no inventory items -->
          <div class="card" style="padding: 24px; display: flex; justify-content: center; align-items: center; flex-direction: column; color: var(--text-muted); background: rgba(0,0,0,0.05); border: 2px dashed var(--border-color);">
            <span style="font-size: 32px; margin-bottom: 12px; opacity: 0.5;">📦</span>
            <p>No hay insumos activos</p>
          </div>
        `}
      </div>

      <button class="btn btn-success btn-lg" id="btn-abrir-dia" style="width: 100%; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        ☀️ Abrir Día
      </button>
    </div>
  `;
}

// ========================================
// 2. Cierre del día (con cuadre)
// ========================================

function renderCierreForm(apertura) {
  const jornadaSales = db.getSalesForJornada();
  const summary = db.calcDaySummary(jornadaSales);
  const cuentasAbiertas = db.getCuentasAbiertas();
  const jornadaCuentas = db.getCuentasForJornada();
  const cuentasSummary = db.calcCuentasSummary(jornadaCuentas);

  // To count actual transfer transactions, group by cuenta_id (since one cuenta with 3 items creates 3 sale records)
  const transferenciasSales = jornadaSales.filter(s => s.metodo_pago === 'transferencia');
  const uniqueCuentas = new Set();
  let transferenciasCount = 0;

  transferenciasSales.forEach(s => {
    if (s.cuenta_id) {
      if (!uniqueCuentas.has(s.cuenta_id)) {
        uniqueCuentas.add(s.cuenta_id);
        transferenciasCount++;
      }
    } else {
      transferenciasCount++;
    }
  });
  // EFECTIVO FISICO ESPERADO = efectivo_inicial + solo ventas en efectivo
  const totalEsperado = db.round2(apertura.efectivo_inicial + summary.efectivo);

  return `
    <div class="page-header">
      <h2>💰 Cuadre de Caja</h2>
      <p>Cierre diario y reconciliación de efectivo</p>
    </div>

    ${cuentasAbiertas.length > 0 ? `
      <div class="cuadre-warning" style="max-width: 900px; margin: 0 auto 24px auto;">
        <span>⚠️</span>
        <div>
          <strong>Hay ${cuentasAbiertas.length} cuenta${cuentasAbiertas.length > 1 ? 's' : ''} abierta${cuentasAbiertas.length > 1 ? 's' : ''}</strong>
          <p>Se recomienda cobrar o cancelar todas las cuentas activas antes de proceder con el cierre de caja.</p>
        </div>
      </div>
    ` : ''}

    <!-- Dashboard Grid Layout -->
    <div style="max-width: 900px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 24px; padding-bottom: 32px;">
      
      <!-- LEFT COLUMN: Financial Flow -->
      <div style="display: flex; flex-direction: column; gap: 24px;">
        
        <!-- System Totals -->
        <div class="card" style="padding: 20px;">
          <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 16px; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
            <span>📊</span> Totales del Sistema
          </h3>

          <div class="cuadre-info-row" style="margin-bottom: 8px; font-size: 13px;">
            <span style="color: var(--text-muted);">☀️ Apertura</span>
            <span>${formatTime(apertura.hora_apertura)}</span>
          </div>
          <div class="cuadre-info-row" style="margin-bottom: 16px; font-size: 14px;">
            <span>💵 Efectivo inicial</span>
            <strong>${formatCurrency(apertura.efectivo_inicial)}</strong>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 16px;">
            <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.1); padding: 12px; border-radius: var(--radius-sm); text-align: center;">
              <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">EFECTIVO</div>
              <strong style="color: var(--accent-mint); font-size: 16px;">${formatCurrency(summary.efectivo)}</strong>
            </div>
            <div style="background: rgba(99, 102, 241, 0.05); border: 1px solid rgba(99, 102, 241, 0.1); padding: 12px; border-radius: var(--radius-sm); text-align: center;">
              <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">TARJETA</div>
              <strong style="color: var(--accent-blue); font-size: 16px;">${formatCurrency(summary.tarjeta)}</strong>
            </div>
            <div style="background: rgba(168, 85, 247, 0.05); border: 1px solid rgba(168, 85, 247, 0.1); padding: 12px; border-radius: var(--radius-sm); text-align: center;">
              <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">TRANSFER.</div>
              <strong style="color: var(--accent-lavender); font-size: 16px;">${formatCurrency(summary.transferencia)}</strong>
            </div>
          </div>

          <div style="padding: 16px; background: rgba(255, 107, 157, 0.05); border: 1px dashed rgba(255, 107, 157, 0.3); border-radius: var(--radius-sm); text-align: center;">
            <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Total Ventas del Día</div>
            <div style="font-size: 32px; font-weight: 800; color: var(--accent-pink);">${formatCurrency(summary.total)}</div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${summary.count} ventas · ${cuentasSummary.cerradas} cuentas cerradas</div>
          </div>

          <div class="cuadre-info-row" style="margin-top: 16px; background: rgba(110, 231, 183, 0.1); border-radius: var(--radius-sm); padding: 16px;">
            <span style="font-weight: 600; font-size: 15px;">💵 Efectivo esperado en caja</span>
            <strong style="font-size: 20px; color: var(--accent-mint);">${formatCurrency(totalEsperado)}</strong>
          </div>
          <div style="font-size: 11px; color: var(--text-muted); text-align: center; margin-top: 4px;">
            Inicial (${formatCurrency(apertura.efectivo_inicial)}) + Ventas Efectivo (${formatCurrency(summary.efectivo)})
          </div>
        </div>

        <!-- Physical Cash Count & Action Base -->
        <div class="card" style="padding: 24px; border: 2px solid rgba(16, 185, 129, 0.2); background: linear-gradient(to bottom, rgba(16, 185, 129, 0.02), transparent);">
          <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 18px; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
            <span>🔢</span> Cuadre Físico Final
          </h3>
          <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 20px;">
            Cuenta todos billetes y monedas en caja e ingresa el total exacto abajo.
          </p>

          <div class="form-group" style="margin-bottom: 20px;">
            <label class="form-label" style="font-size: 12px; text-transform: uppercase;">Efectivo real contado ($)</label>
            <input type="number" id="efectivo-real" class="form-input large" placeholder="0.00" step="0.01" min="0" style="font-size: 28px; font-weight: bold; text-align: center; color: var(--accent-mint);" />
          </div>

          <button class="btn btn-primary btn-lg" style="width: 100%; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);" id="btn-calcular">
            🔍 Calcular Diferencia
          </button>

          <div id="cuadre-result" style="margin-top: 16px;"></div>

          <button class="btn btn-success btn-lg" style="width: 100%; margin-top: 16px; display: none; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.15);" id="btn-cerrar-dia">
            🔒 Cerrar Día y Guardar
          </button>
        </div>

      </div>

      <!-- RIGHT COLUMN: Audits & Reconciliations -->
      <div style="display: flex; flex-direction: column; gap: 24px;">
        
        <!-- Transfer Reconciliation -->
        <div class="card" style="padding: 20px;">
          <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 16px; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
            <span>📱</span> Conciliación de Transferencias
          </h3>
          
          <div style="background: rgba(0,0,0,0.1); padding: 12px 16px; border-radius: var(--radius-sm); margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 2px;">Sistema Registró</div>
              <div style="font-size: 14px; font-weight: 500;">${transferenciasCount} transferencias</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 2px;">Total Sistema</div>
              <div style="font-size: 18px; font-weight: 700; color: var(--accent-lavender);" id="conciliacion-total-sistema" data-total="${summary.transferencia}" data-count="${transferenciasCount}">
                ${formatCurrency(summary.transferencia)}
              </div>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 100px auto; gap: 8px; margin-bottom: 16px;">
            <input type="text" id="transfer-ref" class="form-input" placeholder="Referencia" maxlength="15" style="font-size: 13px;" />
            <input type="number" id="transfer-monto" class="form-input" placeholder="Monto" step="0.01" min="0.01" max="500" style="font-size: 13px;" />
            <button class="btn btn-primary" id="btn-add-transfer" style="padding: 0 16px;">➕</button>
          </div>

          <!-- Dynamic Table via JS -->
          <div id="conciliacion-table-container"></div>
        </div>

        <!-- Inventory Form -->
        ${apertura.inventario_inicial && apertura.inventario_inicial.length > 0 ? `
          <div class="card" style="padding: 20px; display: flex; flex-direction: column; flex-grow: 1;">
            <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 16px; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
              <span>📦</span> Auditoría de Insumos
            </h3>
            <p style="color: var(--text-secondary); font-size: 12px; margin-bottom: 16px;">
              Ingresa la cantidad física actual para calcular el consumo.
            </p>
            
            <div style="background: var(--bg-tertiary); padding: 16px; border-radius: var(--radius-md); flex-grow: 1; display: flex; flex-direction: column;">
              
              <div style="display: grid; grid-template-columns: 1fr 60px 80px; gap: 12px; font-size: 11px; color: var(--text-muted); margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--border-color);">
                <div>INSUMO</div>
                <div style="text-align: center;">INICIAL</div>
                <div style="text-align: center;">FINAL</div>
              </div>
              
              <div style="max-height: 250px; overflow-y: auto; padding-right: 4px;">
                ${apertura.inventario_inicial.map(i => `
                  <div style="display: grid; grid-template-columns: 1fr 60px 80px; gap: 12px; align-items: center; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.02);">
                    <div style="font-weight: 500; font-size: 13px;">${i.nombre}</div>
                    <div style="text-align: center; font-size: 13px; color: var(--text-secondary); background: rgba(0,0,0,0.1); border-radius: 4px; padding: 4px 0;">${i.cantidad}</div>
                    <input type="number" class="form-input inventario-final-input" data-id="${i.id}" data-nombre="${i.nombre}" placeholder="0" min="0" value="0" style="text-align: center; font-size: 14px; font-weight: bold; padding: 6px;" />
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        ` : ''}

      </div>
    </div>
  `;
}

// ========================================
// 3. Cierre completado
// ========================================

function renderCierreDone(apertura) {
  const c = apertura.cierre;
  if (!c) {
    return `
      <div class="page-header">
        <h2>💰 Cuadre de Caja</h2>
        <p>El día fue cerrado</p>
      </div>
      <div class="card" style="max-width: 500px; margin: 0 auto; text-align: center; padding: 48px;">
        <div style="font-size: 64px; margin-bottom: 16px;">🔒</div>
        <h3>Día cerrado</h3>
        <p style="color: var(--text-muted);">Cerrado a las ${formatTime(apertura.hora_cierre)}</p>
      </div>
    `;
  }

  const diff = c.diferencia;
  const statusClass = Math.abs(diff) < 0.01 ? 'success' : diff < 0 ? 'danger' : 'warning';
  const statusIcon = Math.abs(diff) < 0.01 ? '✅' : diff < 0 ? '❌' : '⚠️';
  const statusMsg = Math.abs(diff) < 0.01 ? 'Caja cuadrada correctamente' : diff < 0 ? 'Faltante en caja' : 'Sobrante en caja';

  return `
    <div class="page-header">
      <h2>💰 Cuadre de Caja</h2>
      <p>Cierre del día completado</p>
    </div>

    <!-- Dashboard Layout Wrapper -->
    <div style="max-width: 900px; margin: 0 auto;">
      
      <!-- Top Status Banner -->
      <div class="card" style="text-align: center; padding: 24px; margin-bottom: 24px; border-bottom: 4px solid var(--${statusClass});">
        <div style="font-size: 48px; margin-bottom: 8px;">${statusIcon}</div>
        <h3 style="font-size: 24px; font-weight: 800; margin-bottom: 4px;">${statusMsg}</h3>
        <p style="font-size: 14px; color: var(--text-muted);">
          Abierto: ${formatTime(apertura.hora_apertura)} &rarr; Cerrado: ${formatTime(apertura.hora_cierre)}
        </p>
      </div>

      <!-- Dashboard Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 24px; margin-bottom: 24px;">
        
        <!-- Left Column: Financials -->
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div class="card" style="padding: 16px;">
            <h4 style="margin-top: 0; margin-bottom: 16px; font-size: 15px; color: var(--text-secondary);">📊 Resumen de Ingresos</h4>
            
            <div class="cuadre-info-row" style="margin-bottom: 16px; font-size: 15px;">
              <span>💵 Efectivo inicial</span>
              <strong>${formatCurrency(apertura.efectivo_inicial)}</strong>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px;">
              <div class="stat-row cash" style="padding: 16px; flex-direction: column; align-items: flex-start; gap: 6px;">
                <span class="stat-label" style="font-size: 12px;">Efectivo Ventas</span>
                <span class="stat-value" style="font-size: 20px;">${formatCurrency(c.total_efectivo_sistema)}</span>
              </div>
              <div class="stat-row card" style="padding: 16px; flex-direction: column; align-items: flex-start; gap: 6px;">
                <span class="stat-label" style="font-size: 12px;">Tarjeta</span>
                <span class="stat-value" style="font-size: 20px;">${formatCurrency(c.total_tarjeta)}</span>
              </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px;">
              <div class="stat-row transfer" style="padding: 16px; flex-direction: column; align-items: flex-start; gap: 6px;">
                <span class="stat-label" style="font-size: 12px;">Transferencia</span>
                <span class="stat-value" style="font-size: 20px;">${formatCurrency(c.total_transferencia)}</span>
              </div>
              <div class="stat-row" style="padding: 16px; flex-direction: column; align-items: flex-start; gap: 6px; background: rgba(255, 107, 157, 0.1);">
                <span class="stat-label" style="font-size: 12px;">Total Ventas</span>
                <span class="stat-value" style="font-size: 20px; color: var(--accent-pink);">${formatCurrency(c.total_dia)}</span>
              </div>
            </div>
          </div>

          <div class="card" style="padding: 16px;">
            <h4 style="margin-top: 0; margin-bottom: 16px; font-size: 15px; color: var(--text-secondary);">⚖️ Cuadre Físico (Efectivo)</h4>
            
            <div class="cuadre-info-row" style="margin-bottom: 12px; background: rgba(110, 231, 183, 0.08); padding: 12px; border-radius: var(--radius-sm);">
              <span>💵 Efectivo esperado</span>
              <strong>${formatCurrency(c.total_esperado || c.efectivo_esperado || 0)}</strong>
            </div>
            
            <div class="cuadre-info-row" style="margin-bottom: 16px; padding: 0 12px;">
              <span>💵 Efectivo contado</span>
              <strong>${formatCurrency(c.efectivo_real)}</strong>
            </div>

            <div class="cuadre-result ${statusClass}" style="margin-top: 0; padding: 16px;">
              <div class="result-message" style="font-size: 14px;">Diferencia Final</div>
              <div class="result-amount" style="font-size: 32px; color: ${Math.abs(diff) < 0.01 ? 'var(--success)' : diff < 0 ? 'var(--danger)' : 'var(--warning)'}; border: none; margin-top: 4px; padding-top: 0;">
                ${Math.abs(diff) < 0.01 ? '$0.00' : formatCurrency(Math.abs(diff))}
                <span style="font-size: 14px; font-weight: normal; margin-left: 8px;">${diff < -0.01 ? '(faltante)' : diff > 0.01 ? '(sobrante)' : ''}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column: Reconciliations & Inventory -->
        <div style="display: flex; flex-direction: column; gap: 16px;">
          
          ${c.conciliacion_transferencias ? `
            <div class="card" style="padding: 16px; background: var(--bg-tertiary); text-align: left;">
              <h4 style="margin-top: 0; margin-bottom: 16px; font-size: 15px;">📱 Transferencias Conciliadas</h4>
              
              <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 12px; padding: 0 8px;">
                <span class="text-muted">Sistema Registró (${c.conciliacion_transferencias.cantidad_sistema}):</span>
                <strong>${formatCurrency(c.conciliacion_transferencias.total_sistema)}</strong>
              </div>
              
              <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 16px; padding: 0 8px;">
                <span class="text-muted">Manual Ingresadas (${c.conciliacion_transferencias.cantidad_ingresadas}):</span>
                <strong>${formatCurrency(c.conciliacion_transferencias.total_ingresadas)}</strong>
              </div>
              
              ${Math.abs(c.conciliacion_transferencias.diferencia) >= 0.01 || c.conciliacion_transferencias.cantidad_sistema !== c.conciliacion_transferencias.cantidad_ingresadas ? `
                <div style="padding: 12px; background: rgba(239, 68, 68, 0.1); border-radius: var(--radius-sm); color: var(--danger); font-size: 13px; font-weight: 600; text-align: center;">
                  ⚠️ Diferencia detectada de ${formatCurrency(c.conciliacion_transferencias.diferencia)}
                </div>
              ` : `
                <div style="padding: 12px; background: rgba(16, 185, 129, 0.1); border-radius: var(--radius-sm); color: var(--success); font-size: 13px; font-weight: 600; text-align: center;">
                  ✅ Transacciones cuadradas
                </div>
              `}
            </div>
          ` : ''}

          ${apertura.inventario_diario && apertura.inventario_diario.length > 0 ? `
            <div class="card" style="padding: 16px; background: var(--bg-tertiary); text-align: left; flex-grow: 1;">
              <h4 style="margin-top: 0; margin-bottom: 16px; font-size: 15px;">📦 Consumo de Insumos</h4>
              
              <div style="display: grid; grid-template-columns: 1fr 60px 60px 60px; gap: 8px; font-size: 11px; color: var(--text-muted); margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border-color);">
                <div>INSUMO</div>
                <div style="text-align: center;">INICIAL</div>
                <div style="text-align: center;">FINAL</div>
                <div style="text-align: center; font-weight: bold;">USADO</div>
              </div>
              
              <div style="max-height: 250px; overflow-y: auto; padding-right: 4px;">
                ${apertura.inventario_diario.map(i => `
                  <div style="display: grid; grid-template-columns: 1fr 60px 60px 60px; gap: 8px; align-items: center; margin-bottom: 8px; font-size: 13px;">
                    <div style="font-weight: 500;">${i.nombre}</div>
                    <div style="text-align: center; color: var(--text-secondary); background: rgba(0,0,0,0.1); border-radius: 4px; padding: 4px 2px;">${i.cantidad_inicial}</div>
                    <div style="text-align: center; color: var(--text-secondary); background: rgba(0,0,0,0.1); border-radius: 4px; padding: 4px 2px;">${i.cantidad_final}</div>
                    <div style="text-align: center; font-weight: bold; font-size: 15px; color: ${i.consumo > 0 ? 'var(--accent-pink)' : 'var(--text-primary)'};">${i.consumo}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

        </div>
      </div>

      <button class="btn btn-primary btn-lg" style="width: 100%; margin-top: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);" id="btn-nueva-jornada">
        ☀️ Abrir Nueva Jornada
      </button>
    </div>
  `;
}

// ========================================
// Init & Event handlers
// ========================================

export function init() {
  // Apertura button
  const btnAbrir = document.getElementById('btn-abrir-dia');
  if (btnAbrir) {
    btnAbrir.addEventListener('click', async () => {
      const input = document.getElementById('efectivo-inicial');
      const efectivo = parseFloat(input.value) || 0;
      if (efectivo < 0) {
        window.showToast('❌ La cantidad no puede ser negativa', 'error');
        return;
      }
      const inventarioInicial = Array.from(document.querySelectorAll('.inventario-inicial-input')).map(input => ({
        id: Number(input.dataset.id),
        nombre: input.dataset.nombre,
        cantidad: parseInt(input.value) || 0
      }));

      const ap = await db.abrirDia(efectivo, inventarioInicial);
      if (ap) {
        window.showToast('☀️ Día abierto correctamente', 'success');
        if (window.navigateTo) window.navigateTo('cuadre');
      } else {
        window.showToast('⚠️ El día ya fue abierto', 'error');
      }
    });
  }

  // Cloud Sync Listeners
  db.on('apertura-changed', rerender);
  db.on('sales-changed', rerender);
  
  // Helper function to render conciliation table
  if (document.getElementById('conciliacion-table-container')) {
    renderConciliacionTable();
  }

  // Add transfer button
  const btnAddTransfer = document.getElementById('btn-add-transfer');
  if (btnAddTransfer) {
    btnAddTransfer.addEventListener('click', () => {
      const montoInput = document.getElementById('transfer-monto');
      const refInput = document.getElementById('transfer-ref');
      const monto = parseFloat(montoInput.value);

      if (isNaN(monto) || monto <= 0 || monto > 500) {
        window.showToast('❌ Monto inválido. Debe ser mayor a 0 y máximo 500', 'error');
        return;
      }

      conciliacionTransferencias.push({
        id: Date.now(),
        numero: conciliacionTransferencias.length + 1,
        monto: db.round2(monto),
        referencia: refInput.value.trim()
      });

      saveTempConciliacion();

      montoInput.value = '';
      refInput.value = '';
      montoInput.focus();
      renderConciliacionTable();
    });
  }

  // Delete transfer delegate
  const tableContainer = document.getElementById('conciliacion-table-container');
  if (tableContainer) {
    tableContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-delete-transfer');
      if (btn) {
        const id = parseInt(btn.dataset.id);
        conciliacionTransferencias = conciliacionTransferencias.filter(t => t.id !== id);
        // re-number
        conciliacionTransferencias.forEach((t, i) => t.numero = i + 1);
        saveTempConciliacion();
        renderConciliacionTable();
      }
    });
  }

  // Calcular diferencia button
  const btnCalc = document.getElementById('btn-calcular');
  if (btnCalc) {
    btnCalc.addEventListener('click', calcularDiferencia);
  }

  // Cerrar día button
  const btnCerrar = document.getElementById('btn-cerrar-dia');
  if (btnCerrar) {
    btnCerrar.addEventListener('click', handleCerrarDia);
  }

  // Nueva jornada button (shown after day is closed)
  const btnNuevaJornada = document.getElementById('btn-nueva-jornada');
  if (btnNuevaJornada) {
    btnNuevaJornada.addEventListener('click', () => {
      // Re-render to show the apertura form
      const container = document.getElementById('page-container');
      if (container) {
        container.innerHTML = renderAperturaForm();
        init(); // re-bind listeners
      }
    });
  }
}

function calcularDiferencia() {
  const input = document.getElementById('efectivo-real');
  const efectivoReal = parseFloat(input.value);

  if (isNaN(efectivoReal) || efectivoReal < 0) {
    window.showToast('❌ Ingresa una cantidad válida', 'error');
    return;
  }

  const apertura = db.getAperturaHoy();
  const jornadaSales = db.getSalesForJornada();
  const summary = db.calcDaySummary(jornadaSales);
  const totalEsperado = db.round2(apertura.efectivo_inicial + summary.efectivo);
  const diferencia = db.round2(efectivoReal - totalEsperado);

  let statusClass, statusIcon, statusMsg;
  if (Math.abs(diferencia) < 0.01) {
    statusClass = 'success';
    statusIcon = '✅';
    statusMsg = 'Caja cuadrada correctamente';
  } else if (diferencia < 0) {
    statusClass = 'danger';
    statusIcon = '❌';
    statusMsg = 'Faltante en caja';
  } else {
    statusClass = 'warning';
    statusIcon = '⚠️';
    statusMsg = 'Sobrante en caja';
  }

  const resultEl = document.getElementById('cuadre-result');
  resultEl.innerHTML = `
    <div class="cuadre-result ${statusClass}">
      <div class="result-icon">${statusIcon}</div>
      <div class="result-message">${statusMsg}</div>
      <div class="result-amount" style="color: ${statusClass === 'success' ? 'var(--success)' : statusClass === 'danger' ? 'var(--danger)' : 'var(--warning)'};">
        ${Math.abs(diferencia) < 0.01 ? '$0.00' : formatCurrency(Math.abs(diferencia))}
      </div>
      <div style="margin-top: 8px; font-size: 13px; color: var(--text-secondary);">
        Esperado: ${formatCurrency(totalEsperado)} | Contado: ${formatCurrency(efectivoReal)}
      </div>
    </div>
  `;

  const btnCerrar = document.getElementById('btn-cerrar-dia');
  if (btnCerrar) btnCerrar.style.display = 'block';
}

async function handleCerrarDia() {
  const input = document.getElementById('efectivo-real');
  const efectivoReal = parseFloat(input.value);
  const apertura = db.getAperturaHoy();
  const jornadaSales = db.getSalesForJornada();
  const summary = db.calcDaySummary(jornadaSales);
  const totalEsperado = db.round2(apertura.efectivo_inicial + summary.efectivo);
  const diferencia = db.round2(efectivoReal - totalEsperado);

  const transferenciasCount = jornadaSales.filter(s => s.metodo_pago === 'transferencia').length;
  const totalIngresadas = db.round2(conciliacionTransferencias.reduce((sum, t) => sum + t.monto, 0));
  const diffTransferencias = db.round2(totalIngresadas - summary.transferencia);

  const cuentasAbiertas = db.getCuentasAbiertas();

  let warningMsg = 'Se guardará el cierre definitivo del día. Esta acción no se puede deshacer.';
  if (cuentasAbiertas.length > 0) {
    warningMsg = `Hay ${cuentasAbiertas.length} cuenta(s) abierta(s). Se cerrarán como canceladas. <br/>` + warningMsg;
  }
  if (Math.abs(diffTransferencias) > 0.01 || transferenciasCount !== conciliacionTransferencias.length) {
    warningMsg = `⚠️ <b>Atención:</b> Hay diferencias en la conciliación de transferencias.<br/><br/>` + warningMsg;
  }

  const confirmed = await window.showConfirm({
    icon: '🔒',
    title: '¿Cerrar el día?',
    message: warningMsg,
    details: `
      <div class="confirm-cuenta-info">
        <div class="confirm-cuenta-row">
          <span>Ventas Efectivo</span><strong style="color: var(--accent-mint);">${formatCurrency(summary.efectivo)}</strong>
        </div>
        <div class="confirm-cuenta-row" style="background: rgba(110, 231, 183, 0.1); padding: 4px; border-radius: 4px;">
          <span>Efectivo Esperado</span><strong>${formatCurrency(totalEsperado)}</strong>
        </div>
        <div class="confirm-cuenta-row">
          <span>Efectivo Contado</span><strong>${formatCurrency(efectivoReal)}</strong>
        </div>
        <div class="confirm-cuenta-row">
          <span>Diferencia Caja</span><strong style="color: ${Math.abs(diferencia) < 0.01 ? 'var(--success)' : diferencia < 0 ? 'var(--danger)' : 'var(--warning)'};">${formatCurrency(diferencia)}</strong>
        </div>
      </div>
    `,
    confirmText: '🔒 Cerrar día',
    confirmClass: 'btn-primary',
  });

  if (!confirmed) return;

  // Auto-cancel open accounts in Cloud
  for (const c of cuentasAbiertas) {
    await db.cancelarCuenta(c.id);
  }

  const dataCierre = {
    total_efectivo_sistema: summary.efectivo,
    total_tarjeta: summary.tarjeta,
    total_transferencia: summary.transferencia,
    total_dia: summary.total,
    total_esperado: totalEsperado,
    efectivo_real: efectivoReal,
    diferencia: diferencia,
    num_ventas: summary.count,
    conciliacion_transferencias: {
      cantidad_sistema: transferenciasCount,
      total_sistema: summary.transferencia,
      cantidad_ingresadas: conciliacionTransferencias.length,
      total_ingresadas: totalIngresadas,
      diferencia: diffTransferencias,
      detalle: conciliacionTransferencias
    }
  };

  const inventarioFinal = Array.from(document.querySelectorAll('.inventario-final-input')).map(input => ({
    id: Number(input.dataset.id),
    nombre: input.dataset.nombre,
    cantidad: parseInt(input.value) || 0
  }));

  await db.cerrarDia(dataCierre, inventarioFinal);
  
  // Clear temporary reconciliation data on close
  conciliacionTransferencias = [];
  localStorage.removeItem(TEMP_CONCILIACION_KEY);
  
  window.showToast('🔒 Día cerrado correctamente', 'success');

  if (window.navigateTo) window.navigateTo('cuadre');
}

// ========================================
// Transfer Reconciliation Helper
// ========================================

function renderConciliacionTable() {
  const container = document.getElementById('conciliacion-table-container');
  if (!container) return;

  const totalSistemaEl = document.getElementById('conciliacion-total-sistema');
  const countSistema = parseInt(totalSistemaEl.dataset.count) || 0;
  const totalSistema = parseFloat(totalSistemaEl.dataset.total) || 0;

  const countIngresadas = conciliacionTransferencias.length;
  const totalIngresadas = conciliacionTransferencias.reduce((sum, t) => sum + t.monto, 0);

  const diferencia = db.round2(totalIngresadas - totalSistema);
  
  let resultHtml = '';
  if (countIngresadas === 0) {
    resultHtml = ``; // default state
  } else if (countIngresadas === countSistema && Math.abs(diferencia) < 0.01) {
    resultHtml = `<div style="background: rgba(16, 185, 129, 0.1); color: var(--success); padding: 12px; border-radius: var(--radius-sm); margin-top: 16px; text-align: center; font-weight: 600;">✅ Transferencias cuadradas correctamente</div>`;
  } else {
    // There's a mismatch
    let warnings = [];
    if (countIngresadas < countSistema) warnings.push('Faltan comprobantes ingresados');
    else if (countIngresadas > countSistema) warnings.push('Sobran comprobantes ingresados');
    
    if (Math.abs(diferencia) >= 0.01) {
      warnings.push(`Diferencia de monto: ${diferencia < 0 ? '-' : '+'} ${formatCurrency(Math.abs(diferencia))}`);
    }
    
    resultHtml = `<div style="background: rgba(239, 68, 68, 0.1); color: var(--danger); padding: 12px; border-radius: var(--radius-sm); margin-top: 16px; font-weight: 500;">
      <div style="margin-bottom: 4px; display: flex; align-items: center; gap: 8px;"><span>⚠️</span> <strong>Diferencia detectada:</strong></div>
      <ul style="margin: 0; padding-left: 28px; font-size: 13px;">
        ${warnings.map(w => `<li>${w}</li>`).join('')}
      </ul>
    </div>`;
  }

  container.innerHTML = `
    ${conciliacionTransferencias.length > 0 ? `
      <div class="table-container" style="border: none; margin-bottom: 12px; background: rgba(0,0,0,0.1); max-height: 250px; overflow-y: auto;">
        <table style="font-size: 13px;">
          <thead style="position: sticky; top: 0; background: var(--bg-tertiary); z-index: 1;">
            <tr>
              <th style="width: 40px; text-align: center;">#</th>
              <th>Valor transferido</th>
              <th>Ref</th>
              <th style="text-align: right;"></th>
            </tr>
          </thead>
          <tbody>
            ${conciliacionTransferencias.map(t => `
              <tr>
                <td style="color: var(--text-muted); text-align: center;">${t.numero}</td>
                <td style="font-weight: 600;">${formatCurrency(t.monto)}</td>
                <td style="color: var(--text-secondary);">${t.referencia || '-'}</td>
                <td style="text-align: right;">
                  <button class="btn btn-ghost btn-sm btn-delete-transfer" data-id="${t.id}" style="color: var(--danger); padding: 4px 8px; min-width: auto; height: auto;">🗑️</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : '<div style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 16px; background: rgba(0,0,0,0.1); border-radius: var(--radius-sm); margin-bottom: 12px;">Ninguna transferencia ingresada</div>'}
    
    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid var(--border-color);">
      <div>
        <div style="font-size: 12px; color: var(--text-muted);">Añadidas</div>
        <div style="font-size: 14px; font-weight: 600;">${countIngresadas} / ${countSistema} registradas</div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 12px; color: var(--text-muted);">Total Calculado</div>
        <div style="font-size: 16px; font-weight: 700; color: ${Math.abs(diferencia) < 0.01 && countIngresadas === countSistema ? 'var(--success)' : 'var(--text-primary)'};">${formatCurrency(totalIngresadas)}</div>
      </div>
    </div>
    
    ${resultHtml}
  `;
}

function rerender() {
  const container = document.getElementById('page-container');
  if (container) {
    container.innerHTML = render();
    init();
  }
}

export function cleanup() {
  db.off('apertura-changed', rerender);
  db.off('sales-changed', rerender);
}
