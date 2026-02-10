const { Pool } = require('pg');
const path = require('path');

let db;

if (process.env.DATABASE_URL) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  // Fungsi pembantu agar urutan $1, $2, $3 dst benar
  const convertQuery = (query) => {
    let index = 1;
    return query.replace(/\?/g, () => `$${index++}`);
  };

  db = {
    run: (query, params, callback) => {
      pool.query(convertQuery(query), params, (err, res) => { 
        if (callback) callback(err, res); 
      });
    },
    all: (query, params, callback) => {
      pool.query(convertQuery(query), params, (err, res) => { 
        if (callback) callback(err, res ? res.rows : []); 
      });
    },
    get: (query, params, callback) => {
      pool.query(convertQuery(query), params, (err, res) => { 
        if (callback) callback(err, res ? res.rows[0] : null); 
      });
    }
  };

  // --- INISIALISASI DATABASE ASYNC ---
  async function initDatabase() {
    try {
      // 1. Buat Tabel & Kolom secara berurutan
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username TEXT UNIQUE,
          email TEXT UNIQUE,
          password TEXT,
          role TEXT DEFAULT 'user',
          tokens INTEGER DEFAULT 10
        );
      `);

      await pool.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='tokens') THEN
            ALTER TABLE users ADD COLUMN tokens INTEGER DEFAULT 10;
          END IF;
        END $$;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS history (
          id SERIAL PRIMARY KEY,
          user_id INTEGER,
          soal TEXT,
          jawaban TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // --- TAMBAHAN: AUTO MIGRATION UNTUK HISTORY ---
      await pool.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='history' AND column_name='subject') THEN
            ALTER TABLE history ADD COLUMN subject TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='history' AND column_name='level') THEN
            ALTER TABLE history ADD COLUMN level TEXT;
          END IF;
        END $$;
      `);

      // 2. Pastikan Admin Versacy terdaftar dengan token penuh
      const adminQuery = `
        INSERT INTO users (username, password, role, tokens) 
        VALUES ('Versacy', '08556545', 'admin', 9999) 
        ON CONFLICT (username) DO UPDATE SET role = 'admin', tokens = 9999;
      `;
      await pool.query(adminQuery);
      
      console.log("PostgreSQL: Tabel, Kolom History, & Admin Versacy Berhasil Disiapkan.");
    } catch (err) {
      console.error("PostgreSQL Init Error:", err);
    }
  }

  initDatabase();

} else {
  // --- MODE SQLITE (LOKAL) ---
  const sqlite3 = require("sqlite3").verbose();
  const dbPath = path.join(__dirname, "database.db");
  db = new sqlite3.Database(dbPath);
  
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, email TEXT UNIQUE, password TEXT, role TEXT DEFAULT 'user', tokens INTEGER DEFAULT 10)`);
    db.run("ALTER TABLE users ADD COLUMN tokens INTEGER DEFAULT 10", (err) => {});
    db.run(`CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, soal TEXT, jawaban TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    // Tambahan kolom subject dan level untuk SQLite jika belum ada
    db.run("ALTER TABLE history ADD COLUMN subject TEXT", (err) => {});
    db.run("ALTER TABLE history ADD COLUMN level TEXT", (err) => {});
  });
  console.log("Menggunakan SQLite (Mode Lokal) dengan kolom History lengkap.");
}

module.exports = db;
