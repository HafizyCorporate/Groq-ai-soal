const express = require("express");
const db = require("../db");
const router = express.Router();

router.post("/register", (req, res) => {
  const { email, password } = req.body;
  db.run("INSERT INTO users (email,password) VALUES (?,?)", [email, password], (err) => {
    if (err) return res.status(400).send("Email sudah ada");
    res.redirect("/");
  });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body;
  db.get("SELECT * FROM users WHERE email=? AND password=?", [email, password], (err, row) => {
    if (!row) return res.status(401).send("Salah email/password");
    req.session.user = { id: row.id, email: row.email };
    res.redirect("/dashboard");
  });
});

router.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

module.exports = router;
