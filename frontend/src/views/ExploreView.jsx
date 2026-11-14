import React, { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api.js";
import MovieCard, { movieVote } from "../components/MovieCard.jsx";
import MovieDetail from "../components/MovieDetail.jsx";

const EMPTY_FILTERS = { q: "", genre: "", yearFrom: "", yearTo: "", sort: "title", order: "asc" };
const PAGE_SIZE = 12;
const number = new Intl.NumberFormat("es-UY");

function MovieTable({ movies, onOpen }) {
  return (
    <div className="tableWrap">
      <table className="movieTable" data-testid="movie-table">
        <thead>
          <tr><th>Título</th><th>Año</th><th>Géneros</th><th>Puntuación</th><th>Popularidad</th></tr>
        </thead>
        <tbody>
          {movies.map((movie) => {
            const vote = movieVote(movie);
            return (
              <tr key={movie.id} onClick={() => onOpen(movie)} tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") onOpen(movie); }}>
                <td className="titleCell">{movie.title}</td>
                <td>{movie.release_year ?? "—"}</td>
                <td>{(movie.genres || []).join(", ") || "—"}</td>
                <td>{vote !== null ? `★ ${vote.toFixed(1)}` : "—"}</td>
                <td>{movie.popularity ? Number(movie.popularity).toFixed(1) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ExploreView() {
  const [metadata, setMetadata] = useState({ genres: [], minYear: null, maxYear: null });
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [movies, setMovies] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [layout, setLayout] = useState("grid");
  const [selected, setSelected] = useState(null);

  const years = useMemo(() => {
    if (!metadata.minYear || !metadata.maxYear) return [];
    return Array.from({ length: metadata.maxYear - metadata.minYear + 1 }, (_, index) => metadata.maxYear - index);
  }, [metadata]);

  async function loadMovies(page = 1, activeFilters = filters) {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), sort: activeFilters.sort, order: activeFilters.order });
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
        setMetadata(await apiRequest("/movies/filters"));
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
    setFilters(EMPTY_FILTERS);
    loadMovies(1, EMPTY_FILTERS);
  }

  const from = pagination.total ? (pagination.page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(pagination.page * PAGE_SIZE, pagination.total);

  return (
    <section>
      <div className="sectionHeader">
        <div>
          <h2>Explorar películas</h2>
          <p>Consulta SQL tradicional (sin embeddings) con búsqueda por texto, filtros, ordenamiento y paginación.</p>
        </div>
        <div className="layoutToggle" role="group" aria-label="Vista">
          <button className={layout === "grid" ? "active" : "secondary"} onClick={() => setLayout("grid")}>Grilla</button>
          <button className={layout === "table" ? "active" : "secondary"} onClick={() => setLayout("table")}>Tabla</button>
        </div>
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

      <p className="resultCount" data-testid="result-count">
        {loading ? "Cargando…" : `Mostrando ${from}–${to} de ${number.format(pagination.total)} películas`}
      </p>

      {error && <p className="errorBox">{error}</p>}
      {loading ? (
        <div className="movieGrid">{Array.from({ length: 6 }, (_, i) => <div key={i} className="movieCard skeleton" />)}</div>
      ) : layout === "grid" ? (
        <div className="movieGrid">
          {movies.map((movie) => <MovieCard key={movie.id} movie={movie} onOpen={setSelected} />)}
        </div>
      ) : (
        movies.length > 0 && <MovieTable movies={movies} onOpen={setSelected} />
      )}
      {!loading && !movies.length && !error && <p className="emptyState">No se encontraron películas con esos filtros.</p>}

      <div className="pagination">
        <button className="secondary" disabled={loading || pagination.page <= 1} onClick={() => loadMovies(pagination.page - 1)}>Anterior</button>
        <span>Página {pagination.page} de {pagination.totalPages || 1}</span>
        <button className="secondary" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => loadMovies(pagination.page + 1)}>Siguiente</button>
      </div>

      {selected && <MovieDetail movie={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}
