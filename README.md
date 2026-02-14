# haze-search

Self-hosted search microservice (Node/TypeScript + SQLite FTS5).

## Quick start

```bash
npm install
npm run dev
```

## API

- `POST /crawl` — start a crawl job
- `GET /status/:id` — crawl job status
- `GET /search?q=...` — search indexed pages

## Env

- `PORT` (default 3000)
- `DB_PATH` (default ./data/search.db)
- `USER_AGENT` (default "haze-search/0.1")
```
