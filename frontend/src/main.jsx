import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

function StatusBadge({ status }) {
  const isOk = status === "ok";

  return (
    <span className={isOk ? "badge badgeOk" : "badge badgeError"}>
      {isOk ? "Connected" : "Disconnected"}
    </span>
  );
}

function App() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadHealth() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/health`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Health check failed");
      }

      setHealth(data);
    } catch (err) {
      setHealth(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHealth();
  }, []);

  return (
    <main className="page">
      <section className="card">
        <div className="eyebrow">Prompt2Movie template</div>
        <h1>pgvector Database Connection</h1>
        <p className="subtitle">
          This React app only checks whether the Node backend can connect to PostgreSQL with pgvector enabled.
        </p>

        <div className="statusRow">
          <span>Database status</span>
          <StatusBadge status={health?.status} />
        </div>

        {loading && <p className="info">Checking backend and database...</p>}

        {error && (
          <div className="errorBox">
            <strong>Connection failed</strong>
            <span>{error}</span>
          </div>
        )}

        {health && (
          <div className="grid">
            <div className="metric">
              <span className="label">Backend</span>
              <strong>{health.backend}</strong>
            </div>
            <div className="metric">
              <span className="label">Database</span>
              <strong>{health.database.name}</strong>
            </div>
            <div className="metric">
              <span className="label">User</span>
              <strong>{health.database.user}</strong>
            </div>
            <div className="metric">
              <span className="label">pgvector</span>
              <strong>
                {health.pgvector.enabled ? `Enabled v${health.pgvector.version}` : "Disabled"}
              </strong>
            </div>
          </div>
        )}

        <button onClick={loadHealth} disabled={loading}>
          {loading ? "Checking..." : "Refresh status"}
        </button>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
