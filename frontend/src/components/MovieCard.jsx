import React from "react";

export function movieYear(movie) {
  return movie.releaseYear ?? movie.release_year ?? null;
}

export function movieVote(movie) {
  const vote = movie.voteAverage ?? movie.vote_average;
  return vote === null || vote === undefined ? null : Number(vote);
}

export function SimilarityBar({ value }) {
  const percent = Math.max(0, Math.min(1, Number(value))) * 100;
  return (
    <div className="similarity" title="Similitud coseno entre tu descripción y la película (1 - distancia <=>)">
      <div className="similarityTrack"><div className="similarityFill" style={{ width: `${percent}%` }} /></div>
      <span>{percent.toFixed(1)}%</span>
    </div>
  );
}

export default function MovieCard({ movie, rank, showSimilarity = false, onOpen }) {
  const year = movieYear(movie);
  const vote = movieVote(movie);

  return (
    <article
      className={`movieCard${onOpen ? " clickable" : ""}`}
      onClick={onOpen ? () => onOpen(movie) : undefined}
      onKeyDown={onOpen ? (event) => { if (event.key === "Enter") onOpen(movie); } : undefined}
      tabIndex={onOpen ? 0 : undefined}
      data-testid="movie-card"
    >
      <div className="movieHeading">
        <h3>{rank ? <span className="rank">#{rank}</span> : null}{movie.title}</h3>
        {year && <span>{year}</span>}
      </div>
      {movie.tagline && <p className="tagline">“{movie.tagline}”</p>}
      <div className="tags">
        {(movie.genres || []).map((genre) => <span key={genre}>{genre}</span>)}
      </div>
      <p className="overview">{movie.overview || "Sin sinopsis disponible."}</p>
      <div className="movieMeta">
        {vote !== null ? <span>★ {vote.toFixed(1)}</span> : <span>Sin puntuación</span>}
        {showSimilarity && <SimilarityBar value={movie.similarity} />}
      </div>
    </article>
  );
}
