// ========================================
// 🍦 YOGU-ICE - Auth Module
// 6-digit PIN login & session management
// ========================================

import * as db from '../db.js';

let currentPin = "";

export function render() {
  // Check if there's already a logged in user
  const user = db.getCurrentUser();
  if (user) return '';

  return `
    <div id="login-overlay" class="login-overlay">
      <div class="login-card">
        <div class="login-header">
          <div class="login-logo">
            <span class="logo-emoji">🍦</span>
            <h1 class="logo-text">YOGU<span>-ICE</span> <span style="font-size: 16px; opacity: 0.8; display: block; margin-top: -5px; letter-spacing: 4px; color: var(--accent-pink); font-weight: 800;">CARAPUNGO</span></h1>
          </div>
          <h2>Bienvenido</h2>
          <p>Ingresa tu PIN de 6 dígitos para continuar</p>
        </div>

        <div class="pin-display">
          <div class="pin-dot ${currentPin.length >= 1 ? 'filled' : ''}"></div>
          <div class="pin-dot ${currentPin.length >= 2 ? 'filled' : ''}"></div>
          <div class="pin-dot ${currentPin.length >= 3 ? 'filled' : ''}"></div>
          <div class="pin-dot ${currentPin.length >= 4 ? 'filled' : ''}"></div>
          <div class="pin-dot ${currentPin.length >= 5 ? 'filled' : ''}"></div>
          <div class="pin-dot ${currentPin.length >= 6 ? 'filled' : ''}"></div>
        </div>

        <div class="pin-pad">
          <button class="pin-btn" data-val="1">1</button>
          <button class="pin-btn" data-val="2">2</button>
          <button class="pin-btn" data-val="3">3</button>
          <button class="pin-btn" data-val="4">4</button>
          <button class="pin-btn" data-val="5">5</button>
          <button class="pin-btn" data-val="6">6</button>
          <button class="pin-btn" data-val="7">7</button>
          <button class="pin-btn" data-val="8">8</button>
          <button class="pin-btn" data-val="9">9</button>
          <button class="pin-btn btn-clear" data-action="clear">C</button>
          <button class="pin-btn" data-val="0">0</button>
          <button class="pin-btn btn-back" data-action="back">⌫</button>
        </div>

        <div class="login-footer">
          <p>© 2026 YOGU-ICE CARAPUNGO POS • v2.0</p>
        </div>
      </div>
    </div>
  `;
}

export function init() {
  const pinButtons = document.querySelectorAll('.pin-btn');
  pinButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.val;
      const action = btn.dataset.action;

      if (val) {
        if (currentPin.length < 6) {
          currentPin += val;
          updatePinDisplay();
          
          if (currentPin.length === 6) {
            handleLogin();
          }
        }
      } else if (action === 'clear') {
        currentPin = "";
        updatePinDisplay();
      } else if (action === 'back') {
        currentPin = currentPin.slice(0, -1);
        updatePinDisplay();
      }
    });
  });

  // Numeric keyboard support
  const handleKeydown = (e) => {
    if (!document.getElementById('login-overlay')) {
      window.removeEventListener('keydown', handleKeydown);
      return;
    }

    if (e.key >= '0' && e.key <= '9') {
      if (currentPin.length < 6) {
        currentPin += e.key;
        updatePinDisplay();
        if (currentPin.length === 6) handleLogin();
      }
    } else if (e.key === 'Backspace') {
      currentPin = currentPin.slice(0, -1);
      updatePinDisplay();
    } else if (e.key === 'Escape') {
      currentPin = "";
      updatePinDisplay();
    }
  };

  window.addEventListener('keydown', handleKeydown);
}

function updatePinDisplay() {
  const dots = document.querySelectorAll('.pin-dot');
  dots.forEach((dot, i) => {
    dot.classList.toggle('filled', i < currentPin.length);
  });
}

function handleLogin() {
  const user = db.getUserByPIN(currentPin);
  
  if (user) {
    window.showToast(`¡Hola, ${user.nombre}!`, 'success');
    db.setCurrentUser(user);
    currentPin = "";
    
    // Hide login screen and refresh UI
    const overlay = document.getElementById('login-overlay');
    if (overlay) {
      overlay.style.animation = 'fadeOut 0.3s ease forwards';
      setTimeout(() => {
        window.location.reload(); // Hard reload to apply permissions correctly
      }, 300);
    }
  } else {
    window.showToast('PIN incorrecto', 'error');
    shakePinDisplay();
    currentPin = "";
    setTimeout(updatePinDisplay, 300);
  }
}

function shakePinDisplay() {
  const display = document.querySelector('.pin-display');
  display.classList.add('shake');
  setTimeout(() => display.classList.remove('shake'), 400);
}

export function logout() {
  db.setCurrentUser(null);
  window.location.reload();
}
