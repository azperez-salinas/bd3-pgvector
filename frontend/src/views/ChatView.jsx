import React, { useEffect, useRef, useState } from "react";
import { apiRequest } from "../api.js";
import Markdown from "../components/Markdown.jsx";
import MovieCard from "../components/MovieCard.jsx";
import MovieDetail from "../components/MovieDetail.jsx";

const STORAGE_KEY = "prompt2movie-chat-v1";
const EXAMPLES = [
  "Una aventura espacial emotiva sobre el paso del tiempo",
  "Una comedia liviana para ver en familia un domingo",
  "Un thriller psicológico con un giro inesperado al final",
  "Una película de mafia con conflictos familiares",
];

function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter((m) => m.status !== "loading") : [];
  } catch (_error) {
    return [];
  }
}

function saveHistory(messages) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.filter((m) => m.status !== "loading")));
  } catch (_error) {
    // Modo privado o almacenamiento lleno: el chat sigue funcionando sin guardar.
  }
}

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function LoadingMessage({ topK }) {
  return (
    <div className="assistantBody" data-testid="chat-loading">
      <div className="typing" aria-label="Generando respuesta"><span /><span /><span /></div>
      <p className="muted">Buscando las {topK} películas más parecidas en pgvector y generando la respuesta con Gemini…</p>
      <div className="movieGrid compact">
        {Array.from({ length: Math.min(topK, 3) }, (_, i) => <div key={i} className="movieCard skeleton" />)}
      </div>
    </div>
  );
}

function AssistantMessage({ message, onRetry, onOpen }) {
  if (message.status === "loading") return <LoadingMessage topK={message.topK} />;
  if (message.status === "error") {
    return (
      <div className="assistantBody">
        <p className="errorBox" data-testid="chat-error">{message.error}</p>
        <button className="secondary" onClick={() => onRetry(message)}>Reintentar</button>
      </div>
    );
  }
  return (
    <div className="assistantBody">
      <div className="answer" data-testid="chat-answer"><Markdown text={message.text} /></div>
      <div className="sourcesHeader">
        <h3>Películas recuperadas por pgvector</h3>
        <span className="muted">
          {message.movies.length} más similares{message.elapsedMs ? ` · ${(message.elapsedMs / 1000).toFixed(1)} s` : ""}
        </span>
      </div>
      <div className="movieGrid compact">
        {message.movies.map((movie, index) => (
          <MovieCard key={movie.id} movie={movie} rank={index + 1} showSimilarity onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

export default function ChatView() {
  const [messages, setMessages] = useState(loadHistory);
  const [draft, setDraft] = useState("");
  const [topK, setTopK] = useState("5");
  const [selected, setSelected] = useState(null);
  const conversationRef = useRef(null);
  const loading = messages.some((m) => m.status === "loading");

  useEffect(() => { saveHistory(messages); }, [messages]);
  // Al llegar un mensaje nuevo, se desplaza la conversación hasta la última pregunta,
  // así la respuesta se lee desde el principio y no desde las tarjetas del final.
  useEffect(() => {
    const container = conversationRef.current;
    const rows = container?.querySelectorAll(".userRow");
    const last = rows?.[rows.length - 1];
    if (last) container.scrollTo({ top: last.offsetTop - 8, behavior: "smooth" });
  }, [messages.length]);

  async function ask(text, k, replaceId) {
    const assistantId = replaceId || newId();
    const started = performance.now();
    const pending = { id: assistantId, role: "assistant", status: "loading", topK: k, question: text };

    setMessages((current) => replaceId
      ? current.map((m) => (m.id === replaceId ? pending : m))
      : [...current, { id: newId(), role: "user", text, topK: k }, pending]);

    try {
      const data = await apiRequest("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, topK: k }),
      });
      const done = { ...pending, status: "done", text: data.answer, movies: data.movies, elapsedMs: performance.now() - started };
      setMessages((current) => current.map((m) => (m.id === assistantId ? done : m)));
    } catch (error) {
      const failed = { ...pending, status: "error", error: error.message };
      setMessages((current) => current.map((m) => (m.id === assistantId ? failed : m)));
    }
  }

  function submit(event) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || loading) return;
    setDraft("");
    ask(text, Number(topK));
  }

  function onKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) submit(event);
  }

  function clearHistory() {
    setMessages([]);
  }

  return (
    <section className="chatView">
      <div className="sectionHeader">
        <div>
          <h2>Chat de recomendaciones</h2>
          <p>Describí la película que tenés ganas de ver. Buscamos las más parecidas con pgvector y Gemini explica por qué encajan.</p>
        </div>
        {messages.length > 0 && (
          <button className="secondary" onClick={clearHistory} disabled={loading}>Nueva conversación</button>
        )}
      </div>

      <div className="conversation" data-testid="conversation" ref={conversationRef}>
        {messages.length === 0 && (
          <div className="welcome">
            <h3>¿Qué querés ver hoy?</h3>
            <p className="muted">Podés escribir en español o en inglés. Algunos ejemplos:</p>
            <div className="examples">
              {EXAMPLES.map((example) => (
                <button key={example} className="secondary chip" onClick={() => setDraft(example)}>{example}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          message.role === "user" ? (
            <div key={message.id} className="userRow">
              <div className="userBubble" data-testid="user-message">{message.text}</div>
            </div>
          ) : (
            <div key={message.id} className="assistantRow">
              <div className="avatar" aria-hidden="true">P2M</div>
              <AssistantMessage
                message={message}
                onOpen={setSelected}
                onRetry={(m) => ask(m.question, m.topK, m.id)}
              />
            </div>
          )
        ))}
      </div>

      <form className="composer" onSubmit={submit}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          maxLength={2000}
          rows={2}
          placeholder="Ejemplo: una aventura espacial emotiva sobre el paso del tiempo"
          aria-label="Describí la película que buscás"
        />
        <div className="composerActions">
          <label className="inline">Películas
            <select value={topK} onChange={(event) => setTopK(event.target.value)} aria-label="Cantidad de películas para el contexto">
              {[3, 5, 8, 10].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <button type="submit" disabled={loading || !draft.trim()}>{loading ? "Buscando…" : "Enviar"}</button>
        </div>
        <p className="hint">Enter para enviar · Shift + Enter para nueva línea</p>
      </form>

      {selected && <MovieDetail movie={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}
