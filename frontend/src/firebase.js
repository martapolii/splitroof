import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Web config from the Firebase console. These values are public, but they
// still go in .env so the test bed and the release can use their own.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Log a hint if the Firebase config isn't set up, otherwise getAuth just fails.
if (!firebaseConfig.apiKey) {
  console.error("Firebase config is missing. Copy .env.example to .env and fill in the VITE_FIREBASE_ values.");
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export default app;
