// ========================================
// 🔐 YOGU-ICE POS - Session Management
// ========================================

import { USUARIOS } from './db.js';

let currentUser = null;

const PERMISSIONS = {
  'ventas': ['mesero', 'jefe', 'dev'],
  'mesas': ['mesero', 'jefe', 'dev'],
  'productos': ['jefe', 'dev'],
  'cuadre': ['jefe', 'dev'],
  'historial': ['jefe', 'dev'],
  'reportes': ['jefe', 'dev'],
  'estadisticas': ['jefe', 'dev'],
  'gastos': ['jefe', 'dev'],
  'cocina': ['mesero', 'jefe', 'dev'],
  'cancelar_cuenta': ['mesero', 'jefe', 'dev'], // Waiter has freedom as requested
  'debug_panel': ['dev']
};

export function login(pin) {
  const user = USUARIOS.find(u => u.pin === pin);
  if (user) {
    currentUser = user;
    localStorage.setItem('yoguice_session', JSON.stringify(user));
    return user;
  }
  return null;
}

export function logout() {
  currentUser = null;
  localStorage.removeItem('yoguice_session');
  window.location.reload();
}

export function getCurrentUser() {
  if (!currentUser) {
    const saved = localStorage.getItem('yoguice_session');
    if (saved) currentUser = JSON.parse(saved);
  }
  return currentUser;
}

export function hasPermission(action) {
  const user = getCurrentUser();
  if (!user) return false;
  const allowedRoles = PERMISSIONS[action];
  if (!allowedRoles) return false;
  return allowedRoles.includes(user.rol);
}

export function initSession() {
  return getCurrentUser();
}
