const SORT_COLUMNS = {
  title: "LOWER(m.title)",
  release_year: "m.release_year",
  vote_average: "m.vote_average",
  popularity: "m.popularity",
};

function vectorLiteral(embedding) {
  return `[${embedding.join(",")}]`;
}

async function searchSimilarMovies(pool, embedding, topK) {
  const result = await pool.query(
    `SELECT id, title, overview, tagline, genres, release_year, vote_average, similarity
       FROM search_movies($1::vector(768), $2)`,
    [vectorLiteral(embedding), topK]
  );
  return result.rows;
}

async function getMovieFilters(pool) {
  const result = await pool.query(`
    SELECT
      COALESCE((SELECT json_agg(genre ORDER BY genre)
                  FROM (SELECT DISTINCT unnest(genres) AS genre FROM movies) genres), '[]'::json) AS genres,
      MIN(release_year)::integer AS min_year,
      MAX(release_year)::integer AS max_year
    FROM movies
  `);
  return result.rows[0];
}

function addFilter(filters, params, sql, value) {
  params.push(value);
  filters.push(sql.replace("?", `$${params.length}`));
}

async function listMovies(pool, options) {
  const filters = [];
  const params = [];

  if (options.q) {
    params.push(`%${options.q}%`);
    const placeholder = `$${params.length}`;
    filters.push(
      `(m.title ILIKE ${placeholder} OR m.overview ILIKE ${placeholder} ` +
        `OR array_to_string(m.genres, ' ') ILIKE ${placeholder})`
    );
  }
  if (options.genre) {
    addFilter(filters, params, "EXISTS (SELECT 1 FROM unnest(m.genres) AS genre WHERE LOWER(genre) = LOWER(?))", options.genre);
  }
  if (options.yearFrom !== undefined) addFilter(filters, params, "m.release_year >= ?", options.yearFrom);
  if (options.yearTo !== undefined) addFilter(filters, params, "m.release_year <= ?", options.yearTo);

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const countResult = await pool.query(`SELECT COUNT(*)::integer AS total FROM movies m ${where}`, params);

  const limitPosition = params.length + 1;
  const offsetPosition = params.length + 2;
  const orderBy = SORT_COLUMNS[options.sort] || SORT_COLUMNS.title;
  const order = options.order === "desc" ? "DESC" : "ASC";
  const result = await pool.query(
    `SELECT m.id, m.title, m.original_title, m.original_language, m.overview, m.tagline,
            m.genres, m.keywords, m.release_date, m.release_year, m.runtime, m.budget,
            m.revenue, m.vote_average, m.vote_count, m.popularity, m.status
       FROM movies m
       ${where}
      ORDER BY ${orderBy} ${order} NULLS LAST, m.id ASC
      LIMIT $${limitPosition} OFFSET $${offsetPosition}`,
    [...params, options.limit, options.offset]
  );

  return { items: result.rows, total: countResult.rows[0].total };
}

module.exports = { getMovieFilters, listMovies, searchSimilarMovies, SORT_COLUMNS };
