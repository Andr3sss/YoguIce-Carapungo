// ========================================
// ⏰ YOGU-ICE POS - Recordatorios
// CRUD de avisos programados (crear / editar / eliminar / pausar)
// Formulario en modal con selector de hora tipo rueda.
// El disparo (alarma central) lo maneja el checker global en main.js
// ========================================

import * as db from '../db.js';

const ROW_H = 44; // alto de cada fila del selector de hora (debe coincidir con el CSS)

// Chips de días en orden Lun → Dom (n = getDay(): 0=Dom .. 6=Sab)
const DAY_CHIPS = [
  { n: 1, l: 'L' }, { n: 2, l: 'M' }, { n: 3, l: 'X' },
  { n: 4, l: 'J' }, { n: 5, l: 'V' }, { n: 6, l: 'S' }, { n: 0, l: 'D' },
];
const DAY_NAMES = { 0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb' };
const PRIORIDADES = { baja: 'Baja', normal: 'Normal', alta: 'Alta' };

// Estado del módulo
let editingId = null;
let modalOpen = false;
let justOpened = false;
let formState = freshForm();

function freshForm() {
  return {
    texto: '', nota: '', tipo: 'diario',
    h: new Date().getHours(), m: 0,
    fecha: '', dias: [], prioridad: 'normal',
  };
}

function resetForm() {
  editingId = null;
  modalOpen = false;
  formState = freshForm();
}

// ── Helpers de presentación ──────────────────────────────

function pad2(n) { return String(n).padStart(2, '0'); }

function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function tipoIcon(tipo) {
  return tipo === 'unico' ? '📅' : tipo === 'semanal' ? '🗓️' : '🔁';
}

function formatDesc(r) {
  if (r.tipo === 'diario') return 'Todos los días';
  if (r.tipo === 'unico') return `Una vez · ${r.fecha || 'sin fecha'}`;
  if (r.tipo === 'semanal') {
    const dias = [...(r.dias || [])]
      .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
      .map(d => DAY_NAMES[d])
      .join(', ');
    return dias || 'Sin días';
  }
  return '';
}

function isVencido(r, nowHHMM, today) {
  if (r.tipo !== 'unico' || !r.fecha) return false;
  return r.fecha < today || (r.fecha === today && r.hora < nowHHMM);
}

// ── Render ───────────────────────────────────────────────

export function render() {
  const recordatorios = db.getRecordatorios()
    .slice()
    .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));

  const now = new Date();
  const today = db.getLocalDate(now);
  const nowHHMM = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

  return `
    <div class="page-header rec-page-header">
      <div>
        <h2>⏰ Recordatorios</h2>
        <p>Crea avisos que aparecerán en todas las pantallas a la hora que elijas</p>
      </div>
      <button class="btn btn-primary btn-lg" data-action="open-modal">➕ Nuevo Recordatorio</button>
    </div>

    <div class="card rec-list-card">
      <div class="rec-list-header">
        <h3>📋 Mis recordatorios</h3>
        <span class="rec-count">${recordatorios.length}</span>
      </div>

      <div class="rec-list">
        ${recordatorios.length === 0 ? `
          <div class="rec-empty">
            <div style="font-size:40px;">⏰</div>
            <p>Aún no hay recordatorios.<br>Crea el primero con el botón de arriba.</p>
          </div>
        ` : recordatorios.map(r => {
          const vencido = isVencido(r, nowHHMM, today);
          return `
            <div class="rec-item prioridad-${r.prioridad || 'normal'} ${!r.activo ? 'inactivo' : ''} ${vencido ? 'vencido' : ''}">
              <div class="rec-item-hora">${r.hora || '--:--'}</div>
              <div class="rec-item-body">
                <div class="rec-item-texto">${escapeHtml(r.texto)}</div>
                ${r.nota ? `<div class="rec-item-nota">${escapeHtml(r.nota)}</div>` : ''}
                <div class="rec-item-meta">
                  ${tipoIcon(r.tipo)} ${formatDesc(r)}${r.creado_por ? ` · 👤 ${escapeHtml(r.creado_por)}` : ''}
                  ${(r.prioridad === 'alta') ? '<span class="rec-badge alta">Alta</span>' : ''}
                  ${vencido ? '<span class="rec-badge vencido">Vencido</span>' : ''}
                  ${!r.activo ? '<span class="rec-badge pausado">Pausado</span>' : ''}
                </div>
              </div>
              <div class="rec-item-actions">
                <button class="rec-btn" data-action="toggle-activo" data-id="${r.id}" title="${r.activo ? 'Pausar' : 'Activar'}">${r.activo ? '🟢' : '⚪'}</button>
                <button class="rec-btn" data-action="edit-rec" data-id="${r.id}" title="Editar">✏️</button>
                <button class="rec-btn" data-action="delete-rec" data-id="${r.id}" title="Eliminar">🗑️</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    ${modalOpen ? renderModal(today) : ''}
  `;
}

function renderModal(today) {
  const fs = formState;
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const mins = Array.from({ length: 60 }, (_, i) => i);

  return `
    <div class="modal-overlay rec-modal-overlay" id="rec-modal-overlay" style="display:flex;">
      <div class="modal rec-modal">
        <div class="modal-header">
          <h2>${editingId ? '✏️ Editar Recordatorio' : '➕ Nuevo Recordatorio'}</h2>
          <button class="modal-close" data-action="close-modal">&times;</button>
        </div>

        <div class="form-group">
          <label class="form-label">Título *</label>
          <input type="text" id="rec-texto" class="form-input" maxlength="60"
            placeholder="Ej: Hacer el cuadre de caja" value="${escapeHtml(fs.texto)}" />
        </div>

        <div class="form-group">
          <label class="form-label">Nota (opcional)</label>
          <input type="text" id="rec-nota" class="form-input" maxlength="120"
            placeholder="Detalle adicional..." value="${escapeHtml(fs.nota)}" />
        </div>

        <div class="form-group">
          <label class="form-label">Hora *</label>
          <div class="wheel-picker">
            <div class="wheel-highlight"></div>
            <div class="wheel-col" id="wheel-hora">
              ${hours.map(h => `<div class="wheel-item" data-unit="h" data-val="${h}">${pad2(h)}</div>`).join('')}
            </div>
            <div class="wheel-sep">:</div>
            <div class="wheel-col" id="wheel-min">
              ${mins.map(m => `<div class="wheel-item" data-unit="m" data-val="${m}">${pad2(m)}</div>`).join('')}
            </div>
          </div>
        </div>

        <div class="rec-form-row">
          <div class="form-group">
            <label class="form-label">Repetición</label>
            <select id="rec-repeticion" class="form-input">
              <option value="unico" ${fs.tipo === 'unico' ? 'selected' : ''}>Una vez</option>
              <option value="diario" ${fs.tipo === 'diario' ? 'selected' : ''}>Todos los días</option>
              <option value="semanal" ${fs.tipo === 'semanal' ? 'selected' : ''}>Días específicos</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Prioridad</label>
            <select id="rec-prioridad" class="form-input">
              ${Object.entries(PRIORIDADES).map(([v, l]) =>
                `<option value="${v}" ${fs.prioridad === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </div>
        </div>

        ${fs.tipo === 'unico' ? `
          <div class="form-group">
            <label class="form-label">Fecha *</label>
            <input type="date" id="rec-fecha" class="form-input" min="${today}" value="${fs.fecha || ''}" />
          </div>
        ` : ''}

        ${fs.tipo === 'semanal' ? `
          <div class="form-group">
            <label class="form-label">Días de la semana *</label>
            <div class="rec-dias">
              ${DAY_CHIPS.map(d => `
                <button class="rec-dia-chip ${fs.dias.includes(d.n) ? 'active' : ''}"
                  data-action="toggle-dia" data-dia="${d.n}">${d.l}</button>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="rec-modal-actions">
          <button class="btn btn-ghost btn-lg" data-action="close-modal">Cancelar</button>
          <button class="btn btn-primary btn-lg" data-action="save-rec">💾 Guardar</button>
        </div>
      </div>
    </div>
  `;
}

// ── Init / eventos ───────────────────────────────────────

export function init() {
  const container = document.getElementById('page-container');
  if (!container) return;

  // Asignación por propiedad → no se acumulan handlers entre re-renders
  container.onclick = handleClick;
  container.onchange = handleChange;
  container.onkeydown = handleKeydown;

  db.off('recordatorios-changed', rerender);
  db.on('recordatorios-changed', rerender);

  if (modalOpen) {
    initWheels();
    if (justOpened) {
      justOpened = false;
      document.getElementById('rec-texto')?.focus();
    }
  }
}

// ── Selector de hora tipo rueda ──────────────────────────

function initWheels() {
  setupWheel(document.getElementById('wheel-hora'), formState.h, 'h');
  setupWheel(document.getElementById('wheel-min'), formState.m, 'm');
}

function setupWheel(col, value, unit) {
  if (!col) return;
  col.scrollTop = value * ROW_H;
  updateWheelSelected(col, value);

  let t;
  col.addEventListener('scroll', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const max = unit === 'h' ? 23 : 59;
      const v = Math.max(0, Math.min(max, Math.round(col.scrollTop / ROW_H)));
      if (unit === 'h') formState.h = v; else formState.m = v;
      updateWheelSelected(col, v);
    }, 80);
  });
}

function updateWheelSelected(col, v) {
  col.querySelectorAll('.wheel-item').forEach(it => {
    it.classList.toggle('selected', Number(it.dataset.val) === v);
  });
}

// ── Manejo de eventos ────────────────────────────────────

function handleChange(e) {
  if (e.target.id === 'rec-repeticion') {
    captureForm();
    formState.tipo = e.target.value;
    rerender();
  }
  // prioridad se lee al guardar (captureForm)
}

async function handleClick(e) {
  // Click fuera del modal → cerrar
  if (e.target.id === 'rec-modal-overlay') {
    resetForm();
    rerender();
    return;
  }

  // Click en un número de la rueda → centrarlo
  const wheelItem = e.target.closest('.wheel-item');
  if (wheelItem) {
    const col = wheelItem.parentElement;
    col.scrollTo({ top: Number(wheelItem.dataset.val) * ROW_H, behavior: 'smooth' });
    return;
  }

  const target = e.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;
  const id = target.dataset.id;

  if (action === 'open-modal') {
    editingId = null;
    formState = freshForm();
    modalOpen = true;
    justOpened = true;
    rerender();
    return;
  }

  if (action === 'close-modal') {
    resetForm();
    rerender();
    return;
  }

  if (action === 'toggle-dia') {
    captureForm();
    const d = Number(target.dataset.dia);
    formState.dias = formState.dias.includes(d)
      ? formState.dias.filter(x => x !== d)
      : [...formState.dias, d];
    rerender();
    return;
  }

  if (action === 'save-rec') {
    await handleSave();
    return;
  }

  if (action === 'edit-rec') {
    const r = db.getRecordatorios().find(x => x.id === id);
    if (!r) return;
    const [hh, mm] = (r.hora || '').split(':');
    editingId = id;
    formState = {
      texto: r.texto || '',
      nota: r.nota || '',
      tipo: r.tipo || 'diario',
      h: Number(hh) || 0,
      m: Number(mm) || 0,
      fecha: r.fecha || '',
      dias: [...(r.dias || [])],
      prioridad: r.prioridad || 'normal',
    };
    modalOpen = true;
    justOpened = true;
    rerender();
    return;
  }

  if (action === 'toggle-activo') {
    const r = db.getRecordatorios().find(x => x.id === id);
    if (!r) return;
    await db.updateRecordatorio(id, { activo: !r.activo });
    window.showToast(r.activo ? '⏸️ Recordatorio pausado' : '🟢 Recordatorio activado', 'info');
    return;
  }

  if (action === 'delete-rec') {
    const r = db.getRecordatorios().find(x => x.id === id);
    const ok = await window.showConfirm({
      icon: '🗑️',
      title: '¿Eliminar recordatorio?',
      message: `Se eliminará permanentemente <b>${escapeHtml(r?.texto || 'este recordatorio')}</b>.`,
      confirmText: '🗑️ Eliminar',
      confirmClass: 'btn-danger',
    });
    if (!ok) return;
    if (editingId === id) resetForm();
    await db.deleteRecordatorio(id);
    window.showToast('🗑️ Recordatorio eliminado', 'error');
    return;
  }
}

function handleKeydown(e) {
  if (e.key === 'Enter' && e.target.id === 'rec-texto') {
    e.preventDefault();
    document.getElementById('rec-nota')?.focus();
  }
  if (e.key === 'Escape' && modalOpen) {
    resetForm();
    rerender();
  }
}

// Lee los campos de texto/select al estado (la hora vive en formState.h/m)
function captureForm() {
  const t = document.getElementById('rec-texto');
  const n = document.getElementById('rec-nota');
  const f = document.getElementById('rec-fecha');
  const p = document.getElementById('rec-prioridad');
  if (t) formState.texto = t.value;
  if (n) formState.nota = n.value;
  if (f) formState.fecha = f.value;
  if (p) formState.prioridad = p.value;
}

async function handleSave() {
  captureForm();
  const texto = formState.texto.trim();

  if (!texto) {
    window.showToast('❌ Escribe un título', 'error');
    return;
  }
  if (formState.tipo === 'unico' && !formState.fecha) {
    window.showToast('❌ Elige una fecha', 'error');
    return;
  }
  if (formState.tipo === 'semanal' && formState.dias.length === 0) {
    window.showToast('❌ Marca al menos un día de la semana', 'error');
    return;
  }

  const payload = {
    texto,
    nota: formState.nota.trim(),
    tipo: formState.tipo,
    hora: `${pad2(formState.h)}:${pad2(formState.m)}`,
    fecha: formState.tipo === 'unico' ? formState.fecha : null,
    dias: formState.tipo === 'semanal' ? [...formState.dias].sort((a, b) => a - b) : [],
    prioridad: formState.prioridad,
  };

  if (editingId) {
    await db.updateRecordatorio(editingId, payload);
    window.showToast('✅ Recordatorio actualizado', 'success');
  } else {
    payload.activo = true;
    payload.creado_por = db.getCurrentUser()?.nombre || 'Sistema';
    await db.addRecordatorio(payload);
    window.showToast('✅ Recordatorio creado', 'success');
  }

  resetForm();
  rerender();
}

function rerender() {
  const container = document.getElementById('page-container');
  if (container) {
    container.innerHTML = render();
    init();
  }
}

export function cleanup() {
  db.off('recordatorios-changed', rerender);
  resetForm();
}
