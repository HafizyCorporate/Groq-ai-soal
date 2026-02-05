require("dotenv").config()
const express = require("express")
const session = require("express-session")
const sqlite3 = require("sqlite3").verbose()

const app = express()

// DATABASE
const db = new sqlite3.Database("./database.db")
db.run(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE,
  password TEXT
)
`)
global.db = db

// MIDDLEWARE
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static("public"))
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}))

app.use("/", require("./routes/auth"))
app.use("/ai", require("./routes/ai"))

app.listen(process.env.PORT, () =>
  console.log("🔥 PRO SERVER RUNNING")
)
