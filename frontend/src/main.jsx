import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

async function apiRequest(path, options) {
  const response = await fetch(`${API_URL}${path}`, options);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error?.message || `La solicitud falló (${response.status})`);
  }
  return body;
}

function MovieCard({ movie, showSimilarity = false }) {
  const year = movie.releaseYear ?? movie.release_year;
  const vote = movie.voteAverage ?? movie.vote_average;

  return (
    <article className="movieCard">
      <div className="movieHeading">
        <h3>{movie.title}</h3>
        {year && <span>{year}</span>}
      </div>
      <div className="tags">
        {(movie.genres || []).map((genre) => <span key={genre}>{genre}</span>)}
      </div>
      <p>{movie.overview || "Sin sinopsis disponible."}</p>
      <div className="movieMeta">
        {vote !== null && vote !== undefined && <span>★ {Number(vote).toFixed(1)}</span>}
        {showSimilarity && <span>Similitud: {(Number(movie.similarity) * 100).toFixed(1)}%</span>}
      </div>
    </article>
  );
}

function ExploreView() {
  const [metadata, setMetadata] = useState({ genres: [], minYear: null, maxYear: null });
  const [filters, setFilters] = useState({ q: "", genre: "", yearFrom: "", yearTo: "", sort: "title", order: "asc" });
  const [movies, setMovies] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const years = useMemo(() => {
    if (!metadata.minYear || !metadata.maxYear) return [];
    return Array.from({ length: metadata.maxYear - metadata.minYear + 1 }, (_, index) => metadata.maxYear - index);
  }, [metadata]);

  async function loadMovies(page = 1, activeFilters = filters) {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), limit: "12", sort: activeFilters.sort, order: activeFilters.order });
    for (const name of ["q", "genre", "yearFrom", "yearTo"]) {
      if (activeFilters[name]) params.set(name, activeFilters[name]);
    }

    try {
      const data = await apiRequest(`/movies?${params}`);
      setMovies(data.items);
      setPagination(data.pagination);
    } catch (requestError) {
      setError(requestError.message);
      setMovies([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function initialize() {
      try {
        const filterData = await apiRequest("/movies/filters");
        setMetadata(filterData);
      } catch (requestError) {
        setError(requestError.message);
      }
      await loadMovies(1);
    }
    initialize();
  }, []);

  function updateFilter(event) {
    setFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function submit(event) {
    event.preventDefault();
    loadMovies(1);
  }

  function clearFilters() {
    const cleared = { q: "", genre: "", yearFrom: "", yearTo: "", sort: "title", order: "asc" };
    setFilters(cleared);
    loadMovies(1, cleared);
  }

  return (
    <section>
      <div className="sectionHeader">
        <div>
          <h2>Explorar películas</h2>
          <p>Consulta tradicional con búsqueda, filtros y ordenamiento SQL.</p>
        </div>
        <strong>{pagination.total} resultados</strong>
      </div>

      <form className="filters" onSubmit={submit}>
        <label className="wideField">Buscar
          <input name="q" value={filters.q} onChange={updateFilter} placeholder="Título, sinopsis o género" />
        </label>
        <label>Género
          <select name="genre" value={filters.genre} onChange={updateFilter}>
            <option value="">Todos</option>
            {metadata.genres.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
          </select>
        </label>
        <label>Desde
          <select name="yearFrom" value={filters.yearFrom} onChange={updateFilter}>
            <option value="">Cualquier año</option>
            {years.slice().reverse().map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
        <label>Hasta
          <select name="yearTo" value={filters.yearTo} onChange={updateFilter}>
            <option value="">Cualquier año</option>
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
        <label>Ordenar por
          <select name="sort" value={filters.sort} onChange={updateFilter}>
            <option value="title">Título</option>
            <option value="release_year">Año</option>
            <option value="vote_average">Puntuación</option>
            <option value="popularity">Popularidad</option>
          </select>
        </label>
        <label>Dirección
          <select name="order" value={filters.order} onChange={updateFilter}>
            <option value="asc">Ascendente</option>
            <option value="desc">Descendente</option>
          </select>
        </label>
        <div className="formActions">
          <button type="submit" disabled={loading}>Aplicar filtros</button>
          <button type="button" className="secondary" onClick={clearFilters} disabled={loading}>Limpiar</button>
        </div>
      </form>

      {error && <p className="errorBox">{error}</p>}
      {loading ? <p className="emptyState">Cargando películas…</p> : (
        <div className="movieGrid">
          {movies.map((movie) => <MovieCard key={movie.id} movie={movie} />)}
        </div>
      )}
      {!loading && !movies.length && !error && <p className="emptyState">No se encontraron películas.</p>}

      <div className="pagination">
        <button className="secondary" disabled={loading || pagination.page <= 1} onClick={() => loadMovies(pagination.page - 1)}>Anterior</button>
        <span>Página {pagination.page} de {pagination.totalPages || 1}</span>
        <button className="secondary" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => loadMovies(pagination.page + 1)}>Siguiente</button>
      </div>
    </section>
  );
}

function ChatView() {
  const [message, setMessage] = useState("");
  const [topK, setTopK] = useState("5");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (!message.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const data = await apiRequest("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), topK: Number(topK) }),
      });
      setResult(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <div className="sectionHeader">
        <div>
          <h2>Chat de recomendaciones</h2>
          <p>Búsqueda semántica con pgvector y respuesta generada por Gemini.</p>
        </div>
      </div>

      <form className="chatForm" onSubmit={submit}>
        <label>¿Qué película estás buscando?
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} placeholder="Ejemplo: una aventura espacial emotiva sobre el paso del tiempo" />
        </label>
        <label>Películas para contexto
          <select value={topK} onChange={(event) => setTopK(event.target.value)}>
            {[3, 5, 8, 10].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <button type="submit" disabled={loading || !message.trim()}>{loading ? "Buscando…" : "Recomendar"}</button>
      </form>

      {error && <p className="errorBox">{error}</p>}
      {result && (
        <div className="chatResult">
          <div className="answer"><strong>Respuesta</strong><p>{result.answer}</p></div>
          <h3>Películas utilizadas como contexto</h3>
          <div className="movieGrid">
            {result.movies.map((movie) => <MovieCard key={movie.id} movie={movie} showSimilarity />)}
          </div>
        </div>
      )}
    </section>
  );
}

function App() {
  const [view, setView] = useState("explore");

  return (
    <main className="page">
      <header className="appHeader">
        <div><span className="eyebrow">PGVECTOR LAB</span><h1>Prompt2Movie</h1></div>
        <nav aria-label="Secciones">
          <button className={view === "explore" ? "active" : "secondary"} onClick={() => setView("explore")}>Explorar</button>
          <button className={view === "chat" ? "active" : "secondary"} onClick={() => setView("chat")}>Chat</button>
        </nav>
      </header>
      <div className="panel">{view === "explore" ? <ExploreView /> : <ChatView />}</div>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
