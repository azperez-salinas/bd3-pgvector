import React, { useEffect } from "react";
import { movieVote, movieYear, SimilarityBar } from "./MovieCard.jsx";

const money = new Intl.NumberFormat("es-UY", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("es-UY");

function Field({ label, children }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className="detailField">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default function MovieDetail({ movie, onClose }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const vote = movieVote(movie);
  const year = movieYear(movie);
  const releaseDate = movie.release_date ? new Date(movie.release_date).toLocaleDateString("es-UY", { timeZone: "UTC" }) : null;

  return (
    <div className="modalBackdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={movie.title} onClick={(event) => event.stopPropagation()}>
        <button className="secondary closeButton" onClick={onClose} aria-label="Cerrar">✕</button>
        <h2>{movie.title} {year && <span className="muted">({year})</span>}</h2>
        {movie.original_title && movie.original_title !== movie.title && <p className="muted">Título original: {movie.original_title}</p>}
        {movie.tagline && <p className="tagline">“{movie.tagline}”</p>}
        <div className="tags">{(movie.genres || []).map((genre) => <span key={genre}>{genre}</span>)}</div>
        <p>{movie.overview}</p>
        {movie.similarity !== undefined && (
          <div className="detailSimilarity"><strong>Similitud con tu descripción</strong><SimilarityBar value={movie.similarity} /></div>
        )}
        <dl className="detailGrid">
          <Field label="Puntuación">{vote !== null ? `★ ${vote.toFixed(1)}${movie.vote_count ? ` (${number.format(movie.vote_count)} votos)` : ""}` : null}</Field>
          <Field label="Estreno">{releaseDate}</Field>
          <Field label="Duración">{movie.runtime ? `${movie.runtime} min` : null}</Field>
          <Field label="Idioma original">{movie.original_language?.toUpperCase()}</Field>
          <Field label="Presupuesto">{movie.budget ? money.format(movie.budget) : null}</Field>
          <Field label="Recaudación">{movie.revenue ? money.format(movie.revenue) : null}</Field>
          <Field label="Popularidad">{movie.popularity ? Number(movie.popularity).toFixed(1) : null}</Field>
          <Field label="Estado">{movie.status}</Field>
        </dl>
        {movie.keywords?.length > 0 && (
          <div className="keywords"><strong>Palabras clave</strong><p>{movie.keywords.join(", ")}</p></div>
        )}
      </div>
    </div>
  );
}
