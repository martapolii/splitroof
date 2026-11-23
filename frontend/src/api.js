import { createUserWithEmailAndPassword, deleteUser, signInWithEmailAndPassword, signOut } from "firebase/auth";
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

function signUpError(error) {
  if (error?.code === "auth/email-already-in-use") {
    return new Error("An account with this email already exists.");
  }
  if (error?.code === "auth/weak-password") {
    return new Error("Password must be at least 6 characters.");
  }
  if (error?.code === "auth/invalid-email") {
    return new Error("Please enter a valid email.");
  }
  return error;
}

export const HouseholdAPI = {
  current: () => apiFetch("/api/households/current"),
  create: (name) =>
    apiFetch("/api/households", {
      method: "POST",
      body: { name },
    }),
  balances: (householdId) =>
    apiFetch(`/api/households/${encodeURIComponent(householdId)}/balances`),
  debts: (householdId) =>
    apiFetch(`/api/households/${encodeURIComponent(householdId)}/debts`),
};

export const AuthAPI = {
  // Create the account with the Firebase Web SDK, save the username, then sign out.
  signUp: async ({ email, password, username }) => {
    if (!auth) {
      throw new Error("Firebase config is missing. Copy .env.example to .env and fill in the VITE_FIREBASE_ values.");
    }

    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const user = {
        uid: credential.user.uid,
        email: credential.user.email,
      };

      try {
        // The new account is signed in, so this call can send its ID token.
        await apiFetch("/api/auth/profile", {
          method: "POST",
          body: { username },
        });
      } catch (error) {
        // No username saved, so remove the new account. Then they can try again with the same email.
        await deleteUser(credential.user).catch(() => {});
        throw error;
      } finally {
        // Sign In starts from a signed-out user, including when the profile save fails.
        await signOut(auth);
      }

      return { user };
    } catch (error) {
      throw signUpError(error);
    }
  },

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
