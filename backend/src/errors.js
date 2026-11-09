class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function notFoundHandler(req, _res, next) {
  next(new AppError(404, "NOT_FOUND", `Route ${req.method} ${req.originalUrl} was not found`));
}

function errorHandler(error, _req, res, _next) {
  let normalized = error;
  if (error?.type === "entity.parse.failed") {
    normalized = new AppError(400, "INVALID_JSON", "Request body contains invalid JSON");
  } else if (error?.type === "entity.too.large") {
    normalized = new AppError(413, "PAYLOAD_TOO_LARGE", "Request body is too large");
  }

  const status = normalized instanceof AppError ? normalized.status : 500;
  const code = normalized instanceof AppError ? normalized.code : "INTERNAL_ERROR";
  const message = normalized instanceof AppError ? normalized.message : "An unexpected error occurred";

  if (!(normalized instanceof AppError)) {
    console.error(error);
  }

  const body = { status: "error", error: { code, message } };
  if (normalized instanceof AppError && normalized.details !== undefined) {
    body.error.details = normalized.details;
  }
  res.status(status).json(body);
}

module.exports = { AppError, asyncRoute, errorHandler, notFoundHandler };
