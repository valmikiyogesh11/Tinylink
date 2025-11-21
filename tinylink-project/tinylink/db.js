// db.js
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'ROOT',
  database: process.env.DB_NAME || 'tinylink_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Small wrapper so the rest of the code can keep using db.query(...)
async function query(sql, params) {
  const [rows] = await pool.query(sql, params);

  if (Array.isArray(rows)) {
    // SELECT
    return {
      rows,
      rowCount: rows.length,
      insertId: null,
    };
  } else {
    // INSERT / UPDATE / DELETE -> OkPacket
    return {
      rows,
      rowCount: rows.affectedRows || 0,
      insertId: rows.insertId || null,
    };
  }
}

module.exports = { query };
