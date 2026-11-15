function bearerToken(header) {
  if (typeof header !== "string") return null;
  const match = header.match(/^Bearer (\S+)$/);
  return match ? match[1] : null;
}

function isAuthError(err) {
  return typeof err?.code === "string" && err.code.startsWith("auth/");
}

// Checks the Firebase ID token before the route handler runs.
async function requireAuth(req, res, next) {
  const token = bearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ error: "Authentication token is missing" });
  }

  try {
    require("../config/firebase");
    const { getAuth } = require("firebase-admin/auth");
    req.user = await getAuth().verifyIdToken(token);
    return next();
  } catch (err) {
    if (isAuthError(err)) {
      return res.status(401).json({ error: "Authentication token is invalid" });
    }
    return next(err);
  }
}

module.exports = { requireAuth };
