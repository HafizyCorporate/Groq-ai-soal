const { Pool } = require('pg');
const path = require('path');

let db;

if (process.env.DATABASE_URL) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  db = {
    run: (query, params, callback) => {
      const pgQuery = query.replace(/\?/g, (v, i) => `$${i + 1}`);
      pool.query(pgQuery, params, (err, res) => { if (callback) callback(err, res); });
    },
    all: (query, params, callback) => {
      const pgQuery = query.replace(/\?/g, (v, i) => `$${i + 1}`);
      pool.query(pgQuery, params, (err, res) => { if (callback) callback(err, res ? res.rows : []); });
    },
    get: (query, params, callback) => {
      const pgQuery = query.replace(/\?/g, (v, i) => `$${i + 1}`);
      pool.query(pgQuery, params, (err, res) => { if (callback) callback(err, res ? res.rows[0] : null); });
    }
  };

  // --- INISIALISASI TABEL & KOLOM TOKEN ---
  const initQueries = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'user',
      tokens INTEGER DEFAULT 10
    );
    
    -- Tambahkan kolom tokens jika tabel users sudah ada sebelumnya
    DO $$ 
    BEGIN 
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='tokens') THEN
        ALTER TABLE users ADD COLUMN tokens INTEGER DEFAULT 10;
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS history (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      soal TEXT,
      jawaban TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  pool.query(initQueries)
    .then(() => {
      console.log("PostgreSQL: Tabel & Sistem Token Siap.");
      const adminQuery = `
        INSERT INTO users (username, password, role, tokens) 
        VALUES ('Versacy', '08556545', 'admin', 9999) 
        ON CONFLICT (username) DO UPDATE SET role = 'admin';
      `;
      return pool.query(adminQuery);
    })
    .catch(err => console.error("PostgreSQL Init Error:", err));

} else {
  // --- MODE SQLITE (LOKAL) ---
  const sqlite3 = require("sqlite3").verbose();
  const dbPath = path.join(__dirname, "database.db");
  db = new sqlite3.Database(dbPath);
  
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      username TEXT UNIQUE, 
      email TEXT UNIQUE, 
      password TEXT, 
      role TEXT DEFAULT 'user',
      tokens INTEGER DEFAULT 10
    )`);
    // Pastikan kolom token ada di sqlite lokal juga
    db.run("ALTER TABLE users ADD COLUMN tokens INTEGER DEFAULT 10", (err) => {});
    db.run(`CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, soal TEXT, jawaban TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  });
}

module.exports = db;
