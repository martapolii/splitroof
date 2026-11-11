const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// The Firebase ID token gets added to the headers in HM1.
export async function apiFetch(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...options.headers };
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
