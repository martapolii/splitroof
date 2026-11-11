const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const db = require("./config/firebase");
const { notFound, errorHandler } = require("./middleware/error");

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// TEMPORARY: proves Firestore read/write works. Delete after confirming.
app.get("/api/firestore-check", async (req, res, next) => {
  try {
    const ref = db.collection("_healthcheck").doc("ping");
    await ref.set({ at: new Date().toISOString() });
    const snap = await ref.get();
    res.json({ status: "ok", data: snap.data() });
  } catch (err) {
    next(err);
  }
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;