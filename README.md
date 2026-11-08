# Prompt2Movie pgvector Template

- React frontend
- Node.js + Express backend
- PostgreSQL with pgvector
- Docker Compose

## Run the app
From the project root:

```bash
docker compose up --build
```

Then open:

```text
http://localhost:5173
```

The backend health endpoint is available at:

```text
http://localhost:3001/api/health
```

## Stop the app

```bash
docker compose down
```