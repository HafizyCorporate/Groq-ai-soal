const express = require("express");
const router = express.Router();
const db = require("../db");

router.post("/register", (req, res) => {
    const { email, password } = req.body;
    db.run("INSERT INTO users (email, password) VALUES (?, ?)", [email, password], (err) => {
        if (err) return res.status(400).json({ error: "Gagal daftar" });
        res.json({ success: true });
    });
});

router.post("/login", (req, res) => {
    const { email, password } = req.body;
    db.get("SELECT * FROM users WHERE email = ? AND password = ?", [email, password], (err, user) => {
        if (!user) return res.status(401).json({ error: "Salah email/password" });
        req.session.user = user;
        res.json({ success: true });
    });
});

module.exports = router;
