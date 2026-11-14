export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

// Mensajes en español para los códigos de error que devuelve el backend.
const ERROR_MESSAGES = {
  INVALID_MESSAGE: "El mensaje está vacío o supera los 2000 caracteres.",
  INVALID_QUERY: "Alguno de los filtros tiene un valor inválido.",
  NO_EMBEDDED_MOVIES: "La base todavía no tiene películas con embeddings. Esperá a que termine el servicio loader.",
  GEMINI_NOT_CONFIGURED: "Falta configurar GEMINI_API_KEY en el archivo .env para usar el chat.",
  GEMINI_ERROR: "Gemini rechazó la solicitud. Revisá la API key y el modelo configurado.",
  GEMINI_TIMEOUT: "Gemini tardó demasiado en responder. Probá de nuevo.",
  GEMINI_UNAVAILABLE: "No se pudo conectar con Gemini.",
  GEMINI_INVALID_RESPONSE: "Gemini devolvió una respuesta vacía. Probá reformular la descripción.",
  EMBEDDER_TIMEOUT: "El servicio de embeddings tardó demasiado. Si recién arrancó, puede estar descargando el modelo.",
  EMBEDDER_UNAVAILABLE: "El servicio de embeddings no está disponible. Si recién arrancó, puede estar descargando el modelo.",
  EMBEDDER_ERROR: "El servicio de embeddings devolvió un error.",
};

export class ApiError extends Error {
  constructor(message, code, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function apiRequest(path, options) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, options);
  } catch (_error) {
    throw new ApiError("No se pudo conectar con el backend. ¿Está corriendo en el puerto 3001?", "NETWORK", 0);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const code = body?.error?.code;
    const message = ERROR_MESSAGES[code] || body?.error?.message || `La solicitud falló (${response.status})`;
    throw new ApiError(message, code, response.status);
  }
  return body;
}
