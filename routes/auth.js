const express = require("express");
const db = require("../db");
const router = express.Router();

// REGISTER
router.post("/register", (req, res) => {
  const { email, password } = req.body;
  if(!email || !password) return res.status(400).send("Email & password wajib");

  db.run("INSERT INTO users (email,password) VALUES (?,?)", [email,password], function(err){
    if(err) return res.status(400).send("Email sudah terdaftar");
    res.redirect("/");
  });
});

// LOGIN
router.post("/login", (req,res) => {
  const { email, password } = req.body;
  if(!email || !password) return res.status(400).send("Email & password wajib");

  db.get("SELECT * FROM users WHERE email=? AND password=?", [email,password], (err,row) => {
    if(err) return res.status(500).send("DB error");
    if(!row) return res.status(401).send("Email atau password salah");

    req.session.user = { id: row.id, email: row.email };
    res.redirect("/dashboard");
  });
});

// LOGOUT
router.get("/logout", (req,res) => {
  req.session.destroy();
  res.redirect("/");
});

module.exports = router;
