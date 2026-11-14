import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { apiRequest } from "./api.js";
import ChatView from "./views/ChatView.jsx";
import ExploreView from "./views/ExploreView.jsx";
import "./styles.css";

const number = new Intl.NumberFormat("es-UY");

// Indicador de estado del sistema a partir de GET /api/health.
function HealthBadge() {
  const [health, setHealth] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiRequest("/health").then(setHealth).catch(() => setFailed(true));
  }, []);

  if (failed) return <span className="health down" data-testid="health">Backend sin conexión</span>;
  if (!health) return <span className="health" data-testid="health">Conectando…</span>;
  return (
    <span className="health ok" data-testid="health" title={`Gemini: ${health.services.geminiModel}`}>
      pgvector {health.pgvector.version} · {number.format(health.database.embeddingCount)} películas con embedding
    </span>
  );
}

function App() {
  const [view, setView] = useState("chat");

  return (
    <main className="page">
      <header className="appHeader">
        <div>
          <span className="eyebrow">PGVECTOR LAB</span>
          <h1>Prompt2Movie</h1>
          <HealthBadge />
        </div>
        <nav aria-label="Secciones">
          <button className={view === "chat" ? "active" : "secondary"} onClick={() => setView("chat")}>Chat</button>
          <button className={view === "explore" ? "active" : "secondary"} onClick={() => setView("explore")}>Explorar</button>
        </nav>
      </header>
      <div className="panel">
        {/* Las dos vistas quedan montadas para no perder el estado al cambiar de pestaña. */}
        <div hidden={view !== "chat"}><ChatView /></div>
        <div hidden={view !== "explore"}><ExploreView /></div>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
