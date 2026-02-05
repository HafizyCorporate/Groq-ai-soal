const express = require("express")
const bcrypt = require("bcrypt")
const db = require("../db")
const router = express.Router()

router.post("/register", async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, 10)
  db.run(
    "INSERT INTO users (email,password) VALUES (?,?)",
    [req.body.email, hash],
    err => err ? res.send("Email sudah ada") : res.redirect("/")
  )
})

router.post("/login", (req, res) => {
  db.get(
    "SELECT * FROM users WHERE email=?",
    [req.body.email],
    async (err, user) => {
      if (!user) return res.send("User tidak ada")
      const ok = await bcrypt.compare(req.body.password, user.password)
      if (!ok) return res.send("Password salah")
      req.session.user = user
      res.redirect("/dashboard")
    }
  )
})

module.exports = router
