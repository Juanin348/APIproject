// firebase-config.js
// Inicialización de Firebase y Firestore usando configuración del entorno Canvas
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getAuth, signInWithCustomToken, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

// Configuración proporcionada por el entorno Canvas
const firebaseConfig = JSON.parse(window.__firebase_config);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let userId = null;

async function authenticate() {
  try {
    await signInAnonymously(auth);
    userId = auth.currentUser.uid;
    console.log('Autenticación anónima exitosa. UID:', userId);
  } catch (error) {
    console.warn(
      'Error de autenticación anónima. Por favor, habilita el inicio de sesión anónimo en tu consola de Firebase para una funcionalidad completa. Usando un ID local de respaldo.',
      error.message
    );
    // Fallback a un ID local si la autenticación anónima falla
    userId = `local-${crypto.randomUUID()}`;
  }
}

await authenticate();

export { db, auth, userId };