const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
// Starts the Firebase Admin SDK when the API starts
require("./config/firebase");
const { notFound, errorHandler } = require("./middleware/error");

const app = express();

// Frontend sites the browser lets read API responses, comma separated in ALLOWED_ORIGINS
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

app.use(notFound);
app.use(errorHandler);

module.exports = app;
