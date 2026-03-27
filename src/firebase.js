import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Configuración de Firebase usando variables de entorno (Vite)
// Si no hay variables de entorno, usará los datos de producción originales por defecto
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC9lpZkFLAGz5aPd6ZgKEOEeddyjvwWlKQ",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "yogu-ice-carapungo.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "yogu-ice-carapungo",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "yogu-ice-carapungo.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "153730189364",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:153730189364:web:e8ccfe96a708f76013a261",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-DF0PGS340Z"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Firestore (Base de datos)
export const db = getFirestore(app);
