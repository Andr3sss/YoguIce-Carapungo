// ========================================
// 🍦 Heladería POS - Estadísticas Module
// Business intelligence for the ice cream shop
// ========================================

import * as db from '../db.js';
import { formatCurrency } from '../main.js';

export async function render() {
  const allSales = await db.getGlobalSales();
  const todaySales = db.getSalesForJornada();
  const todaySummary = db.calcDaySummary(todaySales);
  const topProducts = db.getTopProducts(allSales, 8);
  const hourlyData = db.getSalesByHour(allSales);
  const monthlyTotals = db.getMonthlyTotals(allSales);
  const dailyTotals = db.getDailyTotals(allSales, 14);

  // Calculate some interesting stats
  const totalRevenue = allSales.reduce((s, v) => s + v.precio, 0);
  const uniqueDays = new Set(allSales.map(s => s.fecha)).size;
  const avgPerDay = uniqueDays > 0 ? totalRevenue / uniqueDays : 0;

  // Peak hour
  const peakHour = Object.entries(hourlyData).reduce((max, [h, v]) => v > max.value ? { hour: Number(h), value: v } : max, { hour: 0, value: 0 });

  // Cuentas stats
  const todayCuentas = db.getCuentasForJornada();
  const cuentasSummary = db.calcCuentasSummary(todayCuentas);

  return `
    <div class="page-header">
      <h2>📈 Estadísticas</h2>
      <p>Análisis inteligente de tu negocio</p>
    </div>

    <!-- Quick Stats -->
    <div class="stats-grid">
      <div class="stat-card pink">
        <div class="stat-number">${formatCurrency(todaySummary.total)}</div>
        <div class="stat-desc">Ingresos Hoy</div>
      </div>
      <div class="stat-card mint">
        <div class="stat-number">${formatCurrency(totalRevenue)}</div>
        <div class="stat-desc">Ingresos Totales</div>
      </div>
      <div class="stat-card lavender">
        <div class="stat-number">${formatCurrency(avgPerDay)}</div>
        <div class="stat-desc">Promedio Diario</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-number">${cuentasSummary.cerradas}</div>
        <div class="stat-desc">Cuentas Cerradas Hoy</div>
      </div>
      <div class="stat-card peach">
        <div class="stat-number">${formatCurrency(cuentasSummary.promedio_por_cliente)}</div>
        <div class="stat-desc">Promedio por Cliente</div>
      </div>
      <div class="stat-card pink">
        <div class="stat-number">${peakHour.value > 0 ? peakHour.hour + ':00' : '--'}</div>
        <div class="stat-desc">Hora Pico</div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
      <!-- Top Products -->
      <div class="card">
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
        ` : '<div class="empty-state"><p>Sin datos aún</p></div>'}
      </div>

      <!-- Sales by Hour -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">🕐 Ventas por Hora</h3>
        </div>
        ${renderHourlyChart(hourlyData)}
      </div>
    </div>

    <!-- Daily Trend -->
    <div class="chart-container" style="margin-top: 24px;">
      <div class="chart-title">📅 Ingresos Diarios (Últimos 14 días)</div>
      <div class="bar-chart" style="height: 220px;">
        ${renderDailyTrendBars(dailyTotals)}
      </div>
    </div>

    <!-- Monthly Totals -->
    ${monthlyTotals.length > 0 ? `
      <div class="card" style="margin-top: 24px;">
        <div class="card-header">
          <h3 class="card-title">📆 Ingresos Mensuales</h3>
        </div>
        <div class="table-container" style="border: none;">
          <table>
            <thead>
              <tr>
                <th>Mes</th>
                <th>Ventas</th>
                <th>Ingresos</th>
                <th>Prom./Venta</th>
              </tr>
            </thead>
            <tbody>
              ${monthlyTotals.slice().reverse().map(m => `
                <tr>
                  <td style="font-weight: 600; color: var(--text-primary); text-transform: capitalize;">${m.label}</td>
                  <td>${m.count}</td>
                  <td style="font-weight: 700; color: var(--accent-mint);">${formatCurrency(m.total)}</td>
                  <td>${formatCurrency(m.count > 0 ? m.total / m.count : 0)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}
  `;
}

function renderHourlyChart(hourlyData) {
  // Show only business hours (8 AM - 10 PM)
  const startHour = 8;
  const endHour = 22;
  const hours = [];
  for (let h = startHour; h <= endHour; h++) {
    hours.push({ hour: h, value: hourlyData[h] || 0 });
  }
  const max = Math.max(...hours.map(h => h.value), 1);

  return `
    <div class="bar-chart" style="height: 180px;">
      ${hours.map(h => `
        <div class="bar-col">
          ${h.value > 0 ? `<div class="bar-value" style="font-size:10px;">${formatCurrency(h.value)}</div>` : ''}
          <div class="bar lavender" style="height: ${Math.max((h.value / max) * 100, 2)}%;"></div>
          <div class="bar-label" style="font-size:10px;">${h.hour}h</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderDailyTrendBars(dailyTotals) {
  const max = Math.max(...dailyTotals.map(d => d.total), 1);

  return dailyTotals.map(d => `
    <div class="bar-col">
      ${d.total > 0 ? `<div class="bar-value">${formatCurrency(d.total)}</div>` : ''}
      <div class="bar pink" style="height: ${Math.max((d.total / max) * 100, 2)}%;"></div>
      <div class="bar-label">${d.label}</div>
    </div>
  `).join('');
}

export function init() {
  // Cloud Sync listener
  db.on('sales-changed', rerender);
}

function rerender() {
  const container = document.getElementById('page-container');
  if (container) {
    render().then(html => {
      container.innerHTML = html;
      init();
    });
  }
}

export function cleanup() {
  db.off('sales-changed', rerender);
}
