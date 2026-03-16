// ========================================
// 🍦 Heladería POS - Reportes Module
// Sales reports with charts (day/week/month)
// ========================================

import * as db from '../db.js';
import { formatCurrency } from '../main.js';

let currentFilter = 'semana';

export async function render() {
  const content = await renderReport(currentFilter);
  return `
    <div class="page-header">
      <h2>📊 Reportes de Ventas</h2>
      <p>Análisis de ventas por período</p>
    </div>

    <div class="filter-tabs">
      <button class="filter-tab ${currentFilter === 'dia' ? 'active' : ''}" data-filter="dia">Hoy</button>
      <button class="filter-tab ${currentFilter === 'semana' ? 'active' : ''}" data-filter="semana">Semana</button>
      <button class="filter-tab ${currentFilter === 'mes' ? 'active' : ''}" data-filter="mes">Mes</button>
      <button class="filter-tab ${currentFilter === 'todo' ? 'active' : ''}" data-filter="todo">Todo</button>
    </div>

    <div id="report-content">
      ${content}
    </div>
  `;
}

async function getFilteredSales(filter) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  switch (filter) {
    case 'dia':
      return db.getSalesByDate(todayStr);
    case 'semana': {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return db.getSalesByDateRange(weekAgo.toISOString().split('T')[0], todayStr);
    }
    case 'mes': {
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);
      return db.getSalesByDateRange(monthAgo.toISOString().split('T')[0], todayStr);
    }
    case 'todo':
      return await db.getGlobalSales();
    default:
      return db.getSales();
  }
}

async function getFilteredGastos(filter) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const allGastos = db.getGastos();

  switch (filter) {
    case 'dia':
      return allGastos.filter(g => g.fecha === todayStr);
    case 'semana': {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekStr = weekAgo.toISOString().split('T')[0];
      return allGastos.filter(g => g.fecha >= weekStr && g.fecha <= todayStr);
    }
    case 'mes': {
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);
      const monthStr = monthAgo.toISOString().split('T')[0];
      return allGastos.filter(g => g.fecha >= monthStr && g.fecha <= todayStr);
    }
    case 'todo':
      return await db.getGlobalGastos();
    default:
      return allGastos;
  }
}

function getFilteredAperturas(filter) {
  const allAperturas = db.getHistorialAperturas();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  switch (filter) {
    case 'dia':
      return allAperturas.filter(a => a.fecha === todayStr);
    case 'semana': {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekStr = weekAgo.toISOString().split('T')[0];
      return allAperturas.filter(a => a.fecha >= weekStr && a.fecha <= todayStr);
    }
    case 'mes': {
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);
      const monthStr = monthAgo.toISOString().split('T')[0];
      return allAperturas.filter(a => a.fecha >= monthStr && a.fecha <= todayStr);
    }
    case 'todo':
      return allAperturas;
    default:
      return allAperturas;
  }
}

function calcInventarioSummary(aperturas) {
  const summary = {};
  aperturas.forEach(ap => {
    if (ap.inventario_diario) {
      ap.inventario_diario.forEach(item => {
        if (!summary[item.id]) {
          summary[item.id] = { nombre: item.nombre, inicial: 0, final: 0, consumo: 0 };
        }
        summary[item.id].inicial += item.cantidad_inicial || 0;
        summary[item.id].final += item.cantidad_final || 0;
        summary[item.id].consumo += item.consumo || 0;
      });
    }
  });
  return Object.values(summary).sort((a, b) => b.consumo - a.consumo);
}

async function renderReport(filter) {
  const sales = await getFilteredSales(filter);
  const gastos = await getFilteredGastos(filter);
  const aperturas = getFilteredAperturas(filter);

  const summary = db.calcDaySummary(sales);
  const totalGastos = gastos.reduce((sum, g) => sum + g.monto, 0);
  const utilidadNeta = summary.total - totalGastos;

  const dailyTotals = db.getDailyTotals(sales, filter === 'dia' ? 1 : filter === 'semana' ? 7 : filter === 'mes' ? 30 : 30);
  const topProducts = db.getTopProducts(sales);
  const inventarioSummary = calcInventarioSummary(aperturas);

  return `
    <!-- Stats Cards -->
    <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
      <div class="stat-card pink">
        <div class="stat-number">${formatCurrency(summary.total)}</div>
        <div class="stat-desc">Ingresos Brutos</div>
      </div>
      <div class="stat-card lavender" style="background: var(--bg-card); color: var(--danger); border: 1px solid var(--danger);">
        <div class="stat-number">${formatCurrency(totalGastos)}</div>
        <div class="stat-desc">Gastos / Egresos</div>
      </div>
      <div class="stat-card mint">
        <div class="stat-number" style="color: ${utilidadNeta >= 0 ? 'var(--success)' : 'var(--danger)'}">
          ${formatCurrency(utilidadNeta)}
        </div>
        <div class="stat-desc">Utilidad Neta</div>
      </div>
      <div class="stat-card" style="background: var(--bg-card); border: 1px solid var(--border);">
        <div class="stat-number">${summary.count}</div>
        <div class="stat-desc">Ventas Realizadas</div>
      </div>
    </div>

    <!-- Payment Methods Chart -->
    <div class="chart-container">
      <div class="chart-title">Ventas por Método de Pago</div>
      <div class="bar-chart" style="height: 180px; align-items: flex-end;">
        ${renderPaymentBars(summary)}
      </div>
    </div>

    <!-- Daily Sales Chart -->
    ${filter !== 'dia' ? `
      <div class="chart-container">
        <div class="chart-title">Ventas Diarias</div>
        <div class="bar-chart" style="height: 200px;">
          ${renderDailyBars(dailyTotals)}
        </div>
      </div>
    ` : ''}

    <!-- Top Products -->
    <div class="card" style="margin-top: 16px;">
      <div class="card-header">
        <h3 class="card-title">🏆 Productos Más Vendidos</h3>
      </div>
      ${topProducts.length > 0 ? `
        <div class="ranking-list">
          ${topProducts.map((p, i) => `
            <div class="ranking-item">
              <div class="ranking-position ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'other'}">${i + 1}</div>
              <div class="ranking-info">
                <div class="ranking-name">${p.nombre}</div>
                <div class="ranking-count">${p.cantidad} ventas</div>
              </div>
              <div class="ranking-amount">${formatCurrency(p.total)}</div>
            </div>
          `).join('')}
        </div>
      ` : '<div class="empty-state"><p>Sin datos para este período</p></div>'}
    </div>

    <!-- Inventory Usage -->
    <div class="card" style="margin-top: 16px;">
      <div class="card-header">
        <h3 class="card-title">📦 Consumo de Inventario</h3>
      </div>
      ${inventarioSummary.length > 0 ? `
        <div class="table-container" style="border: none;">
          <table>
            <thead>
              <tr>
                <th>Insumo</th>
                <th style="text-align: center;">Total Inicial</th>
                <th style="text-align: center;">Total Final</th>
                <th style="text-align: center;">Total Usado</th>
              </tr>
            </thead>
            <tbody>
              ${inventarioSummary.map(i => `
                <tr>
                  <td style="font-weight: 500;">${i.nombre}</td>
                  <td style="text-align: center; color: var(--text-secondary);">${i.inicial}</td>
                  <td style="text-align: center; color: var(--text-secondary);">${i.final}</td>
                  <td style="text-align: center; font-weight: bold; color: ${i.consumo > 0 ? 'var(--accent-pink)' : 'var(--text-primary)'};">${i.consumo}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="empty-state"><p>No hay datos de inventario para este período</p></div>'}
    </div>

    <!-- Payment breakdown table -->
    <div class="card" style="margin-top: 16px;">
      <div class="card-header">
        <h3 class="card-title">💳 Desglose por Método de Pago</h3>
      </div>
      <div class="table-container" style="border: none;">
        <table>
          <thead>
            <tr>
              <th>Método</th>
              <th>Ventas</th>
              <th>Total</th>
              <th>% del Total</th>
            </tr>
          </thead>
          <tbody>
            ${renderPaymentTable(sales, summary)}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderPaymentBars(summary) {
  const max = Math.max(summary.efectivo, summary.tarjeta, summary.transferencia, 1);
  const items = [
    { label: 'Efectivo', value: summary.efectivo, color: 'mint' },
    { label: 'Tarjeta', value: summary.tarjeta, color: 'blue' },
    { label: 'Transferencia', value: summary.transferencia, color: 'lavender' },
  ];

  return items.map(item => `
    <div class="bar-col">
      <div class="bar-value">${formatCurrency(item.value)}</div>
      <div class="bar ${item.color}" style="height: ${Math.max((item.value / max) * 100, 3)}%;"></div>
      <div class="bar-label">${item.label}</div>
    </div>
  `).join('');
}

function renderDailyBars(dailyTotals) {
  const display = dailyTotals.slice(-10);
  const max = Math.max(...display.map(d => d.total), 1);

  return display.map(d => `
    <div class="bar-col">
      <div class="bar-value">${d.total > 0 ? formatCurrency(d.total) : '-'}</div>
      <div class="bar pink" style="height: ${Math.max((d.total / max) * 100, 3)}%;"></div>
      <div class="bar-label">${d.label}</div>
    </div>
  `).join('');
}

function renderPaymentTable(sales, summary) {
  const methods = ['efectivo', 'tarjeta', 'transferencia'];
  const icons = { efectivo: '💵', tarjeta: '💳', transferencia: '📱' };
  const colors = { efectivo: 'var(--cash-color)', tarjeta: 'var(--card-color)', transferencia: 'var(--transfer-color)' };

  return methods.map(method => {
    const count = sales.filter(s => s.metodo_pago === method).length;
    const total = summary[method];
    const pct = summary.total > 0 ? ((total / summary.total) * 100).toFixed(1) : '0.0';
    return `
      <tr>
        <td style="font-weight: 600; color: ${colors[method]};">
          ${icons[method]} ${method.charAt(0).toUpperCase() + method.slice(1)}
        </td>
        <td>${count}</td>
        <td style="font-weight: 700;">${formatCurrency(total)}</td>
        <td>${pct}%</td>
      </tr>
    `;
  }).join('');
}

export function init() {
  // Filter tab clicks
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', async () => {
      currentFilter = tab.dataset.filter;
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const content = await renderReport(currentFilter);
      const container = document.getElementById('report-content');
      if (container) container.innerHTML = content;
    });
  });

  // Cloud Sync listener
  db.on('sales-changed', refreshReport);
  db.on('gastos-changed', refreshReport);
}

async function refreshReport() {
  const content = await renderReport(currentFilter);
  const container = document.getElementById('report-content');
  if (container) container.innerHTML = content;
}

export function cleanup() {
  db.off('sales-changed', refreshReport);
  db.off('gastos-changed', refreshReport);
}
