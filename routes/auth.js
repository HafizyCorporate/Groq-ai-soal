const express = require("express");
const router = express.Router();
const db = require("../db");

// Proses Register
router.post("/register", (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email dan password wajib diisi" });
    }

    db.run("INSERT INTO users (email, password) VALUES (?, ?)", [email, password], function(err) {
        if (err) {
            console.error("DEBUG REGISTER ERROR:", err.message);
            // Cek jika error karena email duplikat
            if (err.message.includes("UNIQUE constraint failed")) {
                return res.status(400).json({ error: "Email sudah terdaftar. Silakan login." });
            }
            return res.status(500).json({ error: "Masalah database: " + err.message });
        }
        res.json({ success: true, message: "Berhasil daftar!" });
    });
});

// Proses Login
router.post("/login", (req, res) => {
    const { email, password } = req.body;
    db.get("SELECT * FROM users WHERE email = ? AND password = ?", [email, password], (err, user) => {
        if (err) return res.status(500).json({ error: "Error database" });
        if (!user) return res.status(401).json({ error: "Email atau password salah" });
        
        req.session.user = user;
        res.json({ success: true });
    });
});

module.exports = router;
