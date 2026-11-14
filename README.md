# Prompt2Movie con pgvector

Aplicación de recomendación de películas con React, Node.js, PostgreSQL/pgvector,
embeddings locales y generación de respuestas mediante Gemini.

## Arquitectura

1. El frontend envía una descripción a `POST /api/chat`.
2. El backend obtiene un embedding de consulta desde el servicio `embedder`.
3. PostgreSQL recupera las películas más similares mediante pgvector.
4. El backend construye un contexto únicamente con esas películas.
5. Gemini genera una recomendación fundamentada en el contexto recuperado.

El servicio `loader` carga de forma idempotente las películas y sus embeddings antes de
que arranque el backend.

## Configuración

Copiar el archivo de ejemplo y completar la clave de Gemini:

```powershell
Copy-Item .env.example .env
```

Variables necesarias:

- `GEMINI_API_KEY`: clave creada en Google AI Studio, obligatoria para el chat.
- `GEMINI_MODEL`: modelo generativo; por defecto `gemini-3.5-flash`.
- `HF_TOKEN`: opcional, autentica la descarga del modelo local de embeddings desde Hugging Face Hub.

## Ejecución

```bash
docker compose up --build
```

Servicios:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`
- Embedder: `http://localhost:8000`
- PostgreSQL: `localhost:5433`

El primer inicio del embedder descarga el modelo `intfloat/multilingual-e5-base`, por lo
que puede demorar varios minutos. Sus pesos quedan persistidos en el volumen `hf_models`.

## API

### Estado

```http
GET /api/health
```

Informa la conexión, versión de pgvector, cantidad de películas y cantidad de embeddings.

### Chat RAG

```http
POST /api/chat
Content-Type: application/json

{
  "message": "Quiero una aventura espacial emotiva",
  "topK": 5
}
```

La respuesta contiene el texto generado y las películas utilizadas como fuentes:

```json
{
  "answer": "...",
  "movies": [
    {
      "id": 157336,
      "title": "Interstellar",
      "similarity": 0.84
    }
  ]
}
```

### Explorar películas

```http
GET /api/movies?page=1&limit=20&q=space&genre=Science%20Fiction&yearFrom=1990&yearTo=2020&sort=vote_average&order=desc
```

Parámetros:

- `page`: página desde 1.
- `limit`: entre 1 y 100.
- `q`: búsqueda en título, sinopsis y géneros.
- `genre`: género exacto, sin distinguir mayúsculas.
- `yearFrom` y `yearTo`: rango de años.
- `sort`: `title`, `release_year`, `vote_average` o `popularity`.
- `order`: `asc` o `desc`.

Los valores de los desplegables se obtienen desde la propia base:

```http
GET /api/movies/filters
```

Devuelve todos los géneros presentes y el año mínimo y máximo del dataset.

## Frontend

La interfaz (`frontend/src`) tiene dos pestañas:

- **Chat**: conversación con historial (se guarda en el navegador y se reinicia con
  "Nueva conversación"), indicador de carga mientras el backend consulta pgvector y Gemini,
  respuesta con formato y tarjetas de las películas recuperadas con su similitud. Cada
  tarjeta abre el detalle de la película. Los errores del backend se muestran en español
  con la opción de reintentar.
- **Explorar**: listado de todas las películas con búsqueda, filtros, ordenamiento y
  paginación, en vista de grilla o de tabla, con detalle al hacer clic.

En el encabezado se muestra el estado de `GET /api/health` (versión de pgvector y cantidad
de películas con embedding).

Estructura:

- `api.js`: llamadas al backend y mensajes de error.
- `views/ChatView.jsx` y `views/ExploreView.jsx`: las dos pestañas.
- `components/`: tarjeta, detalle de película y renderizado del Markdown de Gemini.

## Pruebas end-to-end

La carpeta `e2e` tiene pruebas con Playwright que recorren todo el sistema: API, pestaña de
exploración y chat (frontend, backend, embedder, pgvector y Gemini). Con el stack levantado
(`docker compose up --build`) y la `GEMINI_API_KEY` configurada:

```bash
cd e2e
npm install
npx playwright install chromium
npm test
```

El reporte queda en `e2e/playwright-report` (`npm run report` para abrirlo). Las URLs se
pueden cambiar con `E2E_BASE_URL` (frontend) y `E2E_API_URL` (backend).

## Scripts manuales

Para ejecutar el pipeline fuera de Docker, copiar `scripts/.env.example` a
`scripts/.env` y ejecutar, en orden:

```bash
python scripts/01_clean.py
python scripts/02_embed.py
python scripts/03_load.py
python scripts/04_search.py "una aventura espacial"
```

## Detener servicios

```bash
docker compose down
```

Para eliminar también los volúmenes persistentes:

```bash
docker compose down -v
```
