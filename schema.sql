-- TinyLink Postgres schema

CREATE TABLE IF NOT EXISTS links (
    id SERIAL PRIMARY KEY,
    code VARCHAR(8) UNIQUE NOT NULL,
    target_url TEXT NOT NULL,
    total_clicks INTEGER NOT NULL DEFAULT 0,
    last_clicked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helpful index for redirects / stats
CREATE INDEX IF NOT EXISTS idx_links_code ON links (code);
