const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

// --- LOGIKA PENYIMPANAN RAILWAY (PERSISTENT) ---
// Jika di Railway, simpan di /app/data/ agar tidak hilang. Jika lokal, simpan di folder biasa.
const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.PORT;
const dbDir = isRailway ? "/app/data" : path.join(__dirname);
const dbPath = path.join(dbDir, "database.db");

// Buat folder jika belum ada (Penting untuk Railway Volume)
if (isRailway && !fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Gagal membuka database:", err.message);
  } else {
    console.log("Database aktif di:", dbPath);
  }
});

db.serialize(() => {
  // Tabel User lengkap dengan role
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'user'
  )`);

  // Tabel History dengan created_at untuk limit harian
  db.run(`CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    soal TEXT,
    jawaban TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Pastikan kolom baru ada jika tabel lama sudah ada (Graceful error handling)
  db.run("ALTER TABLE users ADD COLUMN username TEXT", (err) => {});
  db.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'", (err) => {});

  // DAFTARKAN / UPDATE VERSACY JADI ADMIN
  db.run(`INSERT OR IGNORE INTO users (username, password, role) 
          VALUES ('Versacy', '08556545', 'admin')`);
  db.run(`UPDATE users SET role = 'admin' WHERE username = 'Versacy'`);
});

module.exports = db;
