const sqlite3 = require("sqlite3").verbose()
const db = new sqlite3.Database("database.db")

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password TEXT
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      soal TEXT,
      jawaban TEXT,
      foto TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
})

module.exports = db
