const { Pool } = require('pg');
const path = require('path');

let db;

// Deteksi Database Railway (DATABASE_URL otomatis ada jika Bapak/Ibu sudah tambah PostgreSQL di Railway)
if (process.env.DATABASE_URL) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Wajib untuk koneksi aman Railway
    }
  });

  // Helper agar perintah db.run, db.all, dan db.get tetap berfungsi seperti SQLite
  db = {
    run: (query, params, callback) => {
      const pgQuery = query.replace(/\?/g, (v, i) => `$${i + 1}`);
      pool.query(pgQuery, params, (err, res) => {
        if (callback) callback(err, res);
      });
    },
    all: (query, params, callback) => {
      const pgQuery = query.replace(/\?/g, (v, i) => `$${i + 1}`);
      pool.query(pgQuery, params, (err, res) => {
        if (callback) callback(err, res ? res.rows : []);
      });
    },
    get: (query, params, callback) => {
      const pgQuery = query.replace(/\?/g, (v, i) => `$${i + 1}`);
      pool.query(pgQuery, params, (err, res) => {
        if (callback) callback(err, res ? res.rows[0] : null);
      });
    }
  };

  // --- INISIALISASI TABEL POSTGRESQL ---
  const initQueries = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'user'
    );
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
      console.log("PostgreSQL: Tabel Berhasil Dicek/Dibuat.");
      // DAFTARKAN ADMIN VERSACY (ON CONFLICT untuk PostgreSQL)
      const adminQuery = `
        INSERT INTO users (username, password, role) 
        VALUES ('Versacy', '08556545', 'admin') 
        ON CONFLICT (username) DO UPDATE SET role = 'admin';
      `;
      return pool.query(adminQuery);
    })
    .catch(err => console.error("PostgreSQL Init Error:", err));

} else {
  // JIKA DI LOKAL (Gunakan SQLite sebagai cadangan agar tidak error saat di HP/PC sendiri)
  const sqlite3 = require("sqlite3").verbose();
  const dbPath = path.join(__dirname, "database.db");
  db = new sqlite3.Database(dbPath);
  
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, email TEXT UNIQUE, password TEXT, role TEXT DEFAULT 'user')`);
    db.run(`CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, soal TEXT, jawaban TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  });
  console.log("Menggunakan SQLite (Mode Lokal).");
}

module.exports = db;
