import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC9lpZkFLAGz5aPd6ZgKEOEeddyjvwWlKQ",
  authDomain: "yogu-ice-carapungo.firebaseapp.com",
  projectId: "yogu-ice-carapungo",
  storageBucket: "yogu-ice-carapungo.firebasestorage.app",
  messagingSenderId: "153730189364",
  appId: "1:153730189364:web:e8ccfe96a708f76013a261",
  measurementId: "G-DF0PGS340Z"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Firestore (Base de datos)
export const db = getFirestore(app);
