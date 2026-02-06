const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Menggunakan database.db sesuai file aslimu
const db = new sqlite3.Database("database.db");

db.serialize(() => {
  // 1. Tabel User (Ditambahkan kolom role dan username secara otomatis jika belum ada)
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'user'
  )`);

  // 2. Tabel History (Ditambahkan created_at untuk hitung limit harian)
  db.run(`CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    soal TEXT,
    jawaban TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // --- LOGIKA OTOMATIS UNTUK ADMIN VERSACY ---

  // Pastikan kolom 'role' ada (untuk jaga-jaga jika tabel sudah terlanjur dibuat tanpa role)
  db.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'", (err) => {
    // Abaikan error jika kolom sudah ada
  });

  // Pastikan kolom 'username' ada
  db.run("ALTER TABLE users ADD COLUMN username TEXT", (err) => {
    // Abaikan error jika kolom sudah ada
  });

  // JADIKAN VERSACY SEBAGAI ADMIN (Bebas Limit)
  // Username: Versacy, Password sesuai permintaanmu
  const adminUser = 'Versacy';
  db.run("UPDATE users SET role = 'admin' WHERE username = ?", [adminUser], (err) => {
    if (!err) {
      console.log(`>>> SUKSES: Akun '${adminUser}' sekarang adalah ADMIN dan BEBAS LIMIT.`);
    }
  });
});

module.exports = db;
