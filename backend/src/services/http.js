const { AppError } = require("../errors");

async function fetchJson(url, options, { timeoutMs, service }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let body;

    try {
      body = text ? JSON.parse(text) : null;
    } catch (_error) {
      throw new AppError(502, `${service}_INVALID_RESPONSE`, `${service} returned invalid JSON`);
    }

    if (!response.ok) {
      const upstreamMessage = body?.error?.message || body?.detail || body?.message;
      throw new AppError(
        502,
        `${service}_ERROR`,
        `${service} request failed`,
        upstreamMessage ? { upstreamStatus: response.status, upstreamMessage } : { upstreamStatus: response.status }
      );
    }

    return body;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new AppError(504, `${service}_TIMEOUT`, `${service} did not respond in time`);
    }
    if (error instanceof AppError) throw error;
    throw new AppError(503, `${service}_UNAVAILABLE`, `${service} is unavailable`);
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchJson };
