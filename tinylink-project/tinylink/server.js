require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./db');
const engine = require('ejs-mate'); // ✅ ADD THIS

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// ✅ View engine setup (UPDATED)
app.engine('ejs', engine);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// Helpers
function isValidUrl(str) {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (err) {
    return false;
  }
}

function isValidCode(code) {
  return /^[A-Za-z0-9]{6,8}$/.test(code);
}

function generateCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

// Healthcheck
app.get('/healthz', (req, res) => {
  res.status(200).json({
    ok: true,
    version: '1.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Dashboard
app.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM links ORDER BY created_at DESC');
    const totalLinks = rows.length;
    const totalClicks = rows.reduce((sum, row) => sum + (row.total_clicks || 0), 0);

    res.render('dashboard', {
      links: rows,
      stats: { totalLinks, totalClicks },
      baseUrl: BASE_URL,
    });
  } catch (err) {
    console.error('Error loading dashboard', err);
    res.status(500).render('error', {
      message: 'Something went wrong while loading your links.',
      details: err.message,
    });
  }
});

// Stats page
app.get('/code/:code', async (req, res) => {
  const { code } = req.params;
  try {
    const { rows } = await db.query('SELECT * FROM links WHERE code = ?', [code]);
    if (rows.length === 0) {
      return res.status(404).render('404', { message: 'Short link not found' });
    }
    const link = rows[0];
    res.render('stats', {
      link,
      baseUrl: BASE_URL,
    });
  } catch (err) {
    console.error('Error loading stats page', err);
    res.status(500).render('error', {
      message: 'Could not load stats page.',
      details: err.message,
    });
  }
});

// API: Create link
app.post('/api/links', async (req, res) => {
  try {
    let { targetUrl, code } = req.body;

    if (!targetUrl || typeof targetUrl !== 'string') {
      return res.status(400).json({ error: 'targetUrl is required.' });
    }

    targetUrl = targetUrl.trim();

    if (!isValidUrl(targetUrl)) {
      return res.status(400).json({ error: 'Please provide a valid http/https URL.' });
    }

    if (code && typeof code === 'string' && code.trim() !== '') {
      code = code.trim();
      if (!isValidCode(code)) {
        return res.status(400).json({
          error: 'Custom code must be 6-8 characters long and only contain letters and numbers.',
        });
      }
    } else {
      let unique = false;
      let attempts = 0;
      while (!unique && attempts < 10) {
        attempts++;
        const len = 6 + Math.floor(Math.random() * 3);
        const candidate = generateCode(len);
        const existing = await db.query('SELECT 1 FROM links WHERE code = ?', [candidate]);
        if (existing.rows.length === 0) {
          code = candidate;
          unique = true;
        }
      }
      if (!unique) {
        return res.status(500).json({ error: 'Failed to generate a unique short code. Please try again.' });
      }
    }

    const existingCode = await db.query('SELECT 1 FROM links WHERE code = ?', [code]);
    if (existingCode.rows.length > 0) {
      return res.status(409).json({ error: 'That short code is already taken. Try another one.' });
    }

    const insertQuery = `
      INSERT INTO links (code, target_url)
      VALUES (?, ?)
    `;

    const insertResult = await db.query(insertQuery, [code, targetUrl]);
    const insertedId = insertResult.insertId;

    const { rows } = await db.query(
      'SELECT id, code, target_url, total_clicks, last_clicked_at, created_at FROM links WHERE id = ?',
      [insertedId]
    );

    const link = rows[0];

    res.status(201).json({
      code: link.code,
      targetUrl: link.target_url,
      totalClicks: link.total_clicks,
      lastClickedAt: link.last_clicked_at,
      createdAt: link.created_at,
      shortUrl: `${BASE_URL}/${link.code}`,
    });
  } catch (err) {
    console.error('Error creating link', err);
    res.status(500).json({ error: 'Something went wrong while creating the link.' });
  }
});

// API: List links
app.get('/api/links', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, code, target_url, total_clicks, last_clicked_at, created_at FROM links ORDER BY created_at DESC'
    );

    const result = rows.map((row) => ({
      code: row.code,
      targetUrl: row.target_url,
      totalClicks: row.total_clicks,
      lastClickedAt: row.last_clicked_at,
      createdAt: row.created_at,
      shortUrl: `${BASE_URL}/${row.code}`,
    }));

    res.json(result);
  } catch (err) {
    console.error('Error listing links', err);
    res.status(500).json({ error: 'Could not load links.' });
  }
});

// API: Stats
app.get('/api/links/:code', async (req, res) => {
  const { code } = req.params;
  try {
    const { rows } = await db.query(
      'SELECT id, code, target_url, total_clicks, last_clicked_at, created_at FROM links WHERE code = ?',
      [code]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Short link not found.' });
    }

    const row = rows[0];

    res.json({
      code: row.code,
      targetUrl: row.target_url,
      totalClicks: row.total_clicks,
      lastClickedAt: row.last_clicked_at,
      createdAt: row.created_at,
      shortUrl: `${BASE_URL}/${row.code}`,
    });
  } catch (err) {
    console.error('Error getting link stats', err);
    res.status(500).json({ error: 'Could not load link stats.' });
  }
});

// API: Delete link
app.delete('/api/links/:code', async (req, res) => {
  const { code } = req.params;
  try {
    const result = await db.query('DELETE FROM links WHERE code = ?', [code]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Short link not found.' });
    }
    return res.status(204).send();
  } catch (err) {
    console.error('Error deleting link', err);
    res.status(500).json({ error: 'Could not delete link.' });
  }
});

// Redirect route
app.get('/:code', async (req, res) => {
  const { code } = req.params;

  if (code === 'favicon.ico' || code === 'robots.txt') {
    return res.status(404).end();
  }

  try {
    const { rows } = await db.query('SELECT * FROM links WHERE code = ?', [code]);
    if (rows.length === 0) {
      return res.status(404).render('404', { message: 'Short link not found' });
    }

    const link = rows[0];

    db.query(
      'UPDATE links SET total_clicks = total_clicks + 1, last_clicked_at = NOW() WHERE id = ?',
      [link.id]
    ).catch((err) => {
      console.error('Failed to update click count', err);
    });

    return res.redirect(302, link.target_url);
  } catch (err) {
    console.error('Error in redirect', err);
    return res.status(500).render('error', {
      message: 'Something went wrong while redirecting.',
      details: err.message,
    });
  }
});

// 404 fallback
app.use((req, res) => {
  res.status(404).render('404', { message: 'Page not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unexpected error middleware', err);
  res.status(500).render('error', {
    message: 'Unexpected error occurred.',
    details: err.message,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`TinyLink running at ${BASE_URL} (listening on port ${PORT})`);
});
