const express = require("express");
const router = express.Router();
const db = require("../db");

// Proses Register (Hanya simpan, tidak langsung login)
router.post("/register", (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email dan password wajib diisi" });
    }

    db.run("INSERT INTO users (email, password) VALUES (?, ?)", [email, password], function(err) {
        if (err) {
            // Cek jika email sudah ada di database
            if (err.message.includes("UNIQUE constraint failed")) {
                return res.status(400).json({ error: "Email sudah terdaftar. Silakan gunakan email lain." });
            }
            return res.status(500).json({ error: "Gagal menyimpan data ke database." });
        }
        
        // Hanya kirim sukses, tidak membuat session (req.session.user TIDAK diisi)
        res.json({ success: true, message: "Pendaftaran berhasil!" });
    });
});

// Proses Login (Tetap sama)
router.post("/login", (req, res) => {
    const { email, password } = req.body;
    db.get("SELECT * FROM users WHERE email = ? AND password = ?", [email, password], (err, user) => {
        if (err) return res.status(500).json({ error: "Error database" });
        if (!user) return res.status(401).json({ error: "Email atau password salah" });
        
        req.session.user = user; // Session baru dibuat di sini
        res.json({ success: true });
    });
});

module.exports = router;
