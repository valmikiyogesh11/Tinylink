# TinyLink

TinyLink is a small URL shortener web app (similar to bit.ly) built with **Node.js + Express + EJS + Postgres**.

It implements the exact routes and API contract from the assignment, plus a clean, responsive UI using Tailwind (via CDN) and a tiny layer of custom CSS.

## Stack

- Node.js + Express
- EJS templates
- Postgres (Neon / Railway / Render / etc.)
- Tailwind CSS (CDN)
- Vanilla JS for interactivity (fetch, copy, delete, search)

## Core features

- Create short links with:
  - Required `targetUrl`
  - Optional custom `code` (6–8 alphanumeric, globally unique)
- Redirect:
  - `GET /:code` → 302 redirect to original URL
  - Every redirect increments `total_clicks` and updates `last_clicked_at`
- Delete:
  - `DELETE /api/links/:code` → removes the link
  - Afterwards `/:code` returns 404 and no longer redirects
- Dashboard `/`
  - Table of all links
  - Short code, target URL, total clicks, last clicked, actions
  - Optional search/filter by code or URL (client-side)
  - Create form with inline validation & loading / success / error states
- Stats page `/code/:code`
  - Per-link stats (short URL, clicks, timestamps, destination)
- Health check `/healthz`
  - Returns `{ "ok": true, "version": "1.0", ... }` with HTTP 200

## Routes (as required for autograding)

### Pages

- `GET /` — Dashboard (list, add, delete)
- `GET /code/:code` — Stats page
- `GET /:code` — Redirect (302 or 404)
- `GET /healthz` — Health check JSON

### API

- `POST /api/links` — Create link (409 if code exists)
- `GET /api/links` — List all links
- `GET /api/links/:code` — Stats for one code
- `DELETE /api/links/:code` — Delete link

Codes follow: `[A-Za-z0-9]{6,8}`.

## Database

`schema.sql` contains the table definition:

```sql
CREATE TABLE IF NOT EXISTS links (
  id SERIAL PRIMARY KEY,
  code VARCHAR(8) UNIQUE NOT NULL,
  target_url TEXT NOT NULL,
  total_clicks INTEGER NOT NULL DEFAULT 0,
  last_clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Run this on your Postgres instance (e.g., Neon).

## Environment variables

Copy `.env.example` to `.env` and fill in:

- `DATABASE_URL` — Postgres connection string
- `BASE_URL` — Public URL of your deployment
- `PORT` — Local dev port (default 3000)

## Local development

```bash
npm install
cp .env.example .env     # then edit .env
# make sure you created the links table using schema.sql

npm run dev
# App runs on http://localhost:3000
```

## Deploying

You can deploy this server to:

- Render
- Railway
- Fly.io
- Or any Node-friendly host with Postgres

Just make sure:

- `NODE_ENV=production`
- `DATABASE_URL` is set
- `BASE_URL` is set to your public HTTPS URL

---

> **Important:** This project is meant as a starting point / reference.  
> Make sure you understand every route, query, and UI behavior so you can explain it confidently in the interview.
