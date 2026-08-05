// ========================================
// 🍦 Heladería POS - Historial Module
// History of daily cash closings
// ========================================

import * as db from '../db.js';
import { formatCurrency } from '../main.js';

// --- Estado: Archivar y Limpiar Historial ---
let purgeStartDate = '';
let purgeEndDate = '';
let purgePreview = null;   // { ventas, cuentas, gastos, jornadas }
let purgeExported = false; // debe exportarse antes de poder borrar
let purgeLoading = false;

function getYesterdayStr() {
  return db.getLocalDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
}

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

    <!-- Archivar y Limpiar Historial -->
    <div class="card" style="margin-top: 24px; padding: 24px;">
      <h3 style="margin:0 0 4px 0; font-size: 18px;">🗄️ Archivar y Limpiar Historial</h3>
      <p style="color: var(--text-muted); font-size: 13px; margin: 0 0 16px 0;">
        Exporta a Excel un rango de fechas y bórralo permanentemente del sistema para mantenerlo liviano.
        Nunca incluye el día de hoy ni la jornada abierta.
      </p>

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(160px,1fr)) auto; gap:12px; align-items:end;">
        <div class="form-group" style="margin:0;">
          <label class="form-label">Desde</label>
          <input type="date" id="purge-start-date" class="form-input" value="${purgeStartDate}" max="${getYesterdayStr()}" />
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label">Hasta</label>
          <input type="date" id="purge-end-date" class="form-input" value="${purgeEndDate}" max="${getYesterdayStr()}" />
        </div>
        <button class="btn btn-ghost" id="btn-purge-preview" ${purgeLoading ? 'disabled' : ''}>
          ${purgeLoading ? '⏳ Cargando...' : '🔍 Vista previa'}
        </button>
      </div>

      ${purgePreview ? renderPurgePreview() : ''}
    </div>

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

function renderPurgePreview() {
  const p = purgePreview;
  const total = p.ventas.length + p.cuentas.length + p.gastos.length + p.jornadas.length;

  if (total === 0) {
    return `
      <div style="margin-top:16px; padding:16px; text-align:center; color: var(--text-muted); background: rgba(0,0,0,0.15); border-radius: var(--radius-sm);">
        No hay registros cerrados en ese rango de fechas.
      </div>
    `;
  }

  return `
    <div style="margin-top:16px; padding:16px; background: rgba(0,0,0,0.15); border-radius: var(--radius-sm);">
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(110px,1fr)); gap:12px; text-align:center; margin-bottom:16px;">
        <div>
          <div style="font-size:22px; font-weight:800; color: var(--accent-pink);">${p.ventas.length}</div>
          <div style="font-size:11px; color: var(--text-muted); text-transform:uppercase; letter-spacing: 0.5px;">Ventas</div>
        </div>
        <div>
          <div style="font-size:22px; font-weight:800; color: var(--accent-mint);">${p.cuentas.length}</div>
          <div style="font-size:11px; color: var(--text-muted); text-transform:uppercase; letter-spacing: 0.5px;">Cuentas</div>
        </div>
        <div>
          <div style="font-size:22px; font-weight:800; color: var(--accent-blue);">${p.jornadas.length}</div>
          <div style="font-size:11px; color: var(--text-muted); text-transform:uppercase; letter-spacing: 0.5px;">Cierres</div>
        </div>
        <div>
          <div style="font-size:22px; font-weight:800; color: var(--danger);">${p.gastos.length}</div>
          <div style="font-size:11px; color: var(--text-muted); text-transform:uppercase; letter-spacing: 0.5px;">Gastos</div>
        </div>
      </div>
      <div style="display:flex; gap:12px; flex-wrap:wrap;">
        <button class="btn btn-secondary" id="btn-purge-export" style="flex:1; min-width:200px;" ${purgeLoading ? 'disabled' : ''}>
          📤 Exportar a Excel
        </button>
        <button class="btn btn-danger" id="btn-purge-delete" style="flex:1; min-width:200px;"
          ${!purgeExported || purgeLoading ? 'disabled' : ''}
          title="${!purgeExported ? 'Primero exporta el respaldo a Excel' : ''}">
          🗑️ Eliminar Permanentemente
        </button>
      </div>
      ${purgeExported ? `
        <div style="margin-top:10px; font-size:12px; color: var(--success); text-align:center;">
          ✅ Respaldo exportado — ya puedes eliminar estos registros.
        </div>
      ` : ''}
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

  // Refresh when new cierres arrive from Firestore
  db.on('apertura-changed', rerender);
  db.on('cierres-changed', rerender);

  // Archivar y Limpiar Historial
  const btnPreview = document.getElementById('btn-purge-preview');
  if (btnPreview) btnPreview.addEventListener('click', handlePurgePreview);

  const btnExport = document.getElementById('btn-purge-export');
  if (btnExport) btnExport.addEventListener('click', handlePurgeExport);

  const btnDelete = document.getElementById('btn-purge-delete');
  if (btnDelete) btnDelete.addEventListener('click', handlePurgeDelete);
}

function rerender() {
  const container = document.getElementById('page-container');
  if (container) {
    container.innerHTML = render();
    init();
  }
}

async function showDetail(dateStr) {
  const contentEl = document.getElementById('detail-content');
  document.getElementById('detail-modal').style.display = 'flex';
  contentEl.innerHTML = `<p style="text-align:center; padding: 32px; color: var(--text-muted);">Cargando...</p>`;

  // Se consulta directo a Firestore (no el caché local, que ahora está
  // acotado a los últimos días) para que el detalle de cierres viejos
  // siga siendo correcto sin importar cuánto historial se haya limpiado.
  let sales;
  try {
    sales = await db.getSalesByDateFromCloud(dateStr);
  } catch (err) {
    console.error(err);
    contentEl.innerHTML = `<p style="text-align:center; padding: 32px; color: var(--danger);">Error al cargar el detalle.</p>`;
    return;
  }

  const cierre = db.getCierreByDate(dateStr);
  const summary = db.calcDaySummary(sales);
  const dateLabel = new Date(dateStr + 'T12:00:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Agrupar ventas por producto
  const productSummary = {};
  sales.forEach(s => {
    const name = s.producto_nombre;
    if (!productSummary[name]) {
      productSummary[name] = { count: 0, total: 0 };
    }
    productSummary[name].count += 1;
    productSummary[name].total += Number(s.precio);
  });

  const groupedSales = Object.entries(productSummary)
    .sort((a, b) => b[1].count - a[1].count) // Ordenar por cantidad (mayor a menor)
    .map(([name, data]) => ({ name, count: data.count, total: data.total }));

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

    <h4 style="font-size: 14px; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">Resumen de Productos Vendidos (${sales.length} items)</h4>
    <div style="max-height: 300px; overflow-y: auto;">
      ${groupedSales.length > 0 ? groupedSales.map(g => `
        <div class="sale-item" style="justify-content: space-between;">
          <div class="sale-info" style="display: flex; gap: 8px; align-items: center;">
            <span style="font-weight: 700; color: var(--text-primary);">${g.name}</span>
            <span style="color: var(--text-muted); font-size: 13px;">(${g.count} vendidos)</span>
          </div>
          <div style="display:flex;align-items:center;">
            <span class="sale-amount" style="color: var(--accent-pink); font-weight: 700;">${formatCurrency(g.total)}</span>
          </div>
        </div>
      `).join('') : '<p style="color: var(--text-muted); text-align: center; padding: 16px;">Sin ventas registradas</p>'}
    </div>
  `;
}

// --- Archivar y Limpiar Historial ---

async function handlePurgePreview() {
  const startInput = document.getElementById('purge-start-date');
  const endInput = document.getElementById('purge-end-date');
  const start = startInput.value;
  const end = endInput.value;

  if (!start || !end) {
    window.showToast('❌ Elige fecha de inicio y fin', 'error');
    return;
  }
  if (start > end) {
    window.showToast('❌ La fecha de inicio no puede ser posterior a la de fin', 'error');
    return;
  }

  purgeStartDate = start;
  purgeEndDate = end;
  purgeExported = false;
  purgePreview = null;
  purgeLoading = true;
  rerender();

  try {
    purgePreview = await db.getHistoricalRangeData(start, end);
  } catch (err) {
    console.error(err);
    window.showToast('❌ Error al consultar el historial', 'error');
  } finally {
    purgeLoading = false;
    rerender();
  }
}

async function handlePurgeExport() {
  if (!purgePreview) return;

  try {
    const XLSX = await import('xlsx'); // carga bajo demanda: no infla el bundle principal

    const ventasRows = purgePreview.ventas.map(v => ({
      Fecha: v.fecha, Hora: v.hora, Producto: v.producto_nombre, Precio: v.precio,
      'Método de Pago': v.metodo_pago, Usuario: v.usuario, 'ID Cuenta': v.cuenta_id || ''
    }));
    const cuentasRows = purgePreview.cuentas.map(c => ({
      Numero: c.numero, Mesa: c.mesa || '', Estado: c.estado, Items: c.items?.length || 0,
      Total: c.total, 'Método de Pago': c.metodo_pago || '',
      'Fecha Apertura': c.fecha_apertura, 'Hora Apertura': c.hora_apertura,
      'Fecha Cierre': c.fecha_cierre || '', 'Hora Cierre': c.hora_cierre || ''
    }));
    const cierresRows = purgePreview.jornadas.map(j => ({
      Fecha: j.fecha, 'Hora Apertura': j.hora_apertura, 'Hora Cierre': j.hora_cierre,
      'Efectivo Inicial': j.efectivo_inicial,
      'Total Efectivo': j.cierre?.total_efectivo_sistema, 'Total Tarjeta': j.cierre?.total_tarjeta,
      'Total Transferencia': j.cierre?.total_transferencia, 'Total Gastos': j.cierre?.total_gastos,
      'Total Día': j.cierre?.total_dia, 'Efectivo Contado': j.cierre?.efectivo_real,
      Diferencia: j.cierre?.diferencia
    }));
    const gastosRows = purgePreview.gastos.map(g => ({
      Fecha: g.fecha, Hora: g.hora, Descripción: g.descripcion, Categoría: g.categoria, Monto: g.monto
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ventasRows), 'Ventas');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cuentasRows), 'Cuentas');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cierresRows), 'Cierres de Caja');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gastosRows), 'Gastos');

    XLSX.writeFile(wb, `Historial_${purgeStartDate}_a_${purgeEndDate}.xlsx`);

    purgeExported = true;
    window.showToast('📤 Respaldo exportado correctamente', 'success');
    rerender();
  } catch (err) {
    console.error(err);
    window.showToast('❌ No se pudo generar el Excel', 'error');
  }
}

async function handlePurgeDelete() {
  if (!purgePreview || !purgeExported) return;

  const p = purgePreview;
  const total = p.ventas.length + p.cuentas.length + p.gastos.length + p.jornadas.length;

  const confirmed = await window.showConfirm({
    icon: '🗑️',
    title: '¿Eliminar historial permanentemente?',
    message: `Se borrarán <b>${total} registros</b> del ${purgeStartDate} al ${purgeEndDate} de forma <b>irreversible</b>. Ya exportaste el respaldo en Excel.`,
    details: `<div style="text-align:center; padding: 10px; background: rgba(0,0,0,0.05); border-radius: 8px;">${p.ventas.length} ventas · ${p.cuentas.length} cuentas · ${p.jornadas.length} cierres · ${p.gastos.length} gastos</div>`,
    confirmText: '🗑️ Sí, eliminar permanentemente',
    confirmClass: 'btn-danger'
  });

  if (!confirmed) return;

  purgeLoading = true;
  rerender();

  try {
    const result = await db.purgeHistoricalRange(purgeStartDate, purgeEndDate);
    window.showToast(`🧹 Historial eliminado: ${result.ventas} ventas, ${result.cuentas} cuentas, ${result.jornadas} cierres, ${result.gastos} gastos`, 'success');
    purgePreview = null;
    purgeExported = false;
    purgeStartDate = '';
    purgeEndDate = '';
  } catch (err) {
    console.error(err);
    window.showToast('❌ Error al eliminar el historial. Revisa la consola.', 'error');
  } finally {
    purgeLoading = false;
    rerender();
  }
}

export function cleanup() {
  purgeStartDate = '';
  purgeEndDate = '';
  purgePreview = null;
  purgeExported = false;
  purgeLoading = false;
}
