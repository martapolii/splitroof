function notFound(req, res) {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
}

// Express treats a middleware with 4 arguments as the error handler.
// The frontend's apiFetch shows the "error" message to the user.
function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  let status = err.status ?? err.statusCode;
  if (!Number.isInteger(status) || status < 400 || status > 599) {
    status = 500;
  }

  // Server errors get logged here, the user only sees a general message
  if (status >= 500) {
    console.error(err);
    return res.status(status).json({ error: "Something went wrong on the server" });
  }

  let message = err.message || "Something was wrong with the request";
  if (err.type === "entity.parse.failed") {
    message = "Invalid JSON in the request body";
  }
  res.status(status).json({ error: String(message) });
}

module.exports = { notFound, errorHandler };
