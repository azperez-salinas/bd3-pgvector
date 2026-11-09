const test = require("node:test");
const assert = require("node:assert/strict");

const { AppError } = require("../src/errors");
const { getMovieFilters, listMovies, searchSimilarMovies } = require("../src/repositories/movies");
const { recommendWithGemini } = require("../src/services/gemini");

test("listMovies builds parameterized filters and pagination", async () => {
  const calls = [];
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (calls.length === 1) return { rows: [{ total: 12 }] };
      return { rows: [{ id: 1, title: "Example" }] };
    },
  };

  const result = await listMovies(pool, {
    q: "space",
    genre: "Science Fiction",
    yearFrom: 1990,
    yearTo: 2020,
    sort: "vote_average",
    order: "desc",
    limit: 20,
    offset: 20,
  });

  assert.equal(result.total, 12);
  assert.equal(result.items[0].title, "Example");
  assert.deepEqual(calls[0].params, ["%space%", "Science Fiction", 1990, 2020]);
  assert.deepEqual(calls[1].params, ["%space%", "Science Fiction", 1990, 2020, 20, 20]);
  assert.match(calls[1].sql, /ORDER BY m\.vote_average DESC/);
  assert.doesNotMatch(calls[1].sql, /space|Science Fiction/);
});

test("searchSimilarMovies serializes the vector as a pgvector literal", async () => {
  let received;
  const pool = {
    async query(sql, params) {
      received = { sql, params };
      return { rows: [{ id: 7 }] };
    },
  };

  const rows = await searchSimilarMovies(pool, [0.1, -0.2, 0.3], 5);
  assert.deepEqual(rows, [{ id: 7 }]);
  assert.deepEqual(received.params, ["[0.1,-0.2,0.3]", 5]);
  assert.match(received.sql, /\$1::vector\(768\)/);
});

test("getMovieFilters exposes database-driven dropdown values", async () => {
  const pool = {
    async query(sql) {
      assert.match(sql, /DISTINCT unnest\(genres\)/);
      return { rows: [{ genres: ["Drama", "Science Fiction"], min_year: 1916, max_year: 2017 }] };
    },
  };

  assert.deepEqual(await getMovieFilters(pool), {
    genres: ["Drama", "Science Fiction"],
    min_year: 1916,
    max_year: 2017,
  });
});

test("Gemini integration fails clearly when credentials are absent", async () => {
  await assert.rejects(
    recommendWithGemini("something", [], {
      apiKey: "",
      model: "",
      apiUrlBase: "https://generativelanguage.googleapis.com/v1beta/models",
      timeoutMs: 1000,
      temperature: 0.2,
    }),
    (error) => error instanceof AppError && error.code === "GEMINI_NOT_CONFIGURED"
  );
});
