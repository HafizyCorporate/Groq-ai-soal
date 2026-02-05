const express = require("express")
const bcrypt = require("bcryptjs")
const auth = require("../middleware/auth")
const router = express.Router()

router.get("/login", (req, res) =>
  res.sendFile("login.html", { root: "views" })
)

router.get("/register", (req, res) =>
  res.sendFile("register.html", { root: "views" })
)

router.post("/register", async (req, res) => {
  const { email, password } = req.body
  const hash = await bcrypt.hash(password, 10)

  global.db.run(
    "INSERT INTO users (email, password) VALUES (?,?)",
    [email, hash],
    err => {
      if (err) return res.send("Email sudah terdaftar")
      res.redirect("/login")
    }
  )
})

router.post("/login", (req, res) => {
  const { email, password } = req.body

  global.db.get(
    "SELECT * FROM users WHERE email=?",
    [email],
    async (err, user) => {
      if (!user) return res.send("User tidak ditemukan")

      const valid = await bcrypt.compare(password, user.password)
      if (!valid) return res.send("Password salah")

      req.session.user = user
      res.redirect("/dashboard")
    }
  )
})

router.get("/dashboard", auth, (req, res) =>
  res.sendFile("dashboard.html", { root: "views" })
)

router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"))
})

router.get("/", (req, res) => res.redirect("/login"))

module.exports = router
