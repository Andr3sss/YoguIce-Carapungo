import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDlU-O-Z9-gi260kjMp9-3_rJ8zJlZKVVU",
  authDomain: "yoguice-cdaae.firebaseapp.com",
  projectId: "yoguice-cdaae",
  storageBucket: "yoguice-cdaae.firebasestorage.app",
  messagingSenderId: "115939651224",
  appId: "1:115939651224:web:d1f728757c2af0ec48eaed",
  measurementId: "G-BSD586D373"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Firestore (Base de datos)
export const db = getFirestore(app);
