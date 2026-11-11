import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase.js";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

async function bearerHeader() {
  const user = auth?.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

// Sends the Firebase ID token on every API call (HM1).
export async function apiFetch(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(await bearerHeader()),
    ...options.headers,
  };
  let body = options.body;
  if (body && typeof body !== "string") {
    body = JSON.stringify(body);
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers, body });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
  }
  return data;
}

function loginError(error) {
  const wrongCredentials = [
    "auth/invalid-credential",
    "auth/wrong-password",
    "auth/user-not-found",
    "auth/invalid-email",
  ];
  if (wrongCredentials.includes(error?.code)) {
    return new Error("Email or password is incorrect.");
  }
  return error;
}

export const AuthAPI = {
  // Sign in with the Firebase Web SDK. The password never goes to our API.
  login: async ({ email, password }) => {
    if (!auth) {
      throw new Error("Firebase config is missing. Copy .env.example to .env and fill in the VITE_FIREBASE_ values.");
    }

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      return {
        user: {
          uid: credential.user.uid,
          email: credential.user.email,
        },
      };
    } catch (error) {
      throw loginError(error);
    }
  },
};
