import * as db from './src/db.js';

async function reopenDay() {
  const aperturas = db.getCollection('heladeria_aperturajornada');
  const today = new Date().toISOString().split('T')[0];
  const lastAp = aperturas.find(a => a.fecha === today && a.estado === 'cerrado');
  
  if (lastAp) {
    console.log(`Re-abriendo jornada: ${lastAp.id}`);
    lastAp.estado = 'abierto';
    lastAp.hora_cierre = null;
    lastAp.timestamp_cierre = null;
    lastAp.cierre = null;
    
    // Save locally
    db.saveCollection('heladeria_aperturajornada', aperturas);
    
    // Note: This won't sync to Cloud unless we use the Firebase API, 
    // but the getAperturaHoy() will favor the local 'abierto' state.
    console.log("✅ Jornada re-abierta localmente. Por favor refresca la página.");
  } else {
    console.log("No se encontró una jornada cerrada hoy para re-abrir.");
  }
}

reopenDay();
