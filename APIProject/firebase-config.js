// firebase-config.js
// Inicialización de Firebase y Firestore usando configuración del entorno Canvas
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getAuth, signInWithCustomToken, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

// Configuración proporcionada por el entorno Canvas
const firebaseConfig = JSON.parse(__firebase_config);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let userId = null;

async function authenticate() {
  try {
    if (typeof __initial_auth_token !== 'undefined') {
      await signInWithCustomToken(auth, __initial_auth_token);
    } else {
      await signInAnonymously(auth);
    }
    userId = auth.currentUser?.uid || crypto.randomUUID();
  } catch (error) {
    console.error('Error de autenticación:', error);
    userId = crypto.randomUUID();
  }
}

await authenticate();

export { db, auth, userId }; 