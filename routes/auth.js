const express = require("express");
const router = express.Router();
const db = require("../db");

// 1. PROSES REGISTER (Daftar Akun)
router.post("/register", (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email dan password wajib diisi" });
    }

    db.run("INSERT INTO users (email, password) VALUES (?, ?)", [email, password], function(err) {
        if (err) {
            // Jika email sudah ada di database
            if (err.message.includes("UNIQUE constraint failed")) {
                return res.status(400).json({ error: "Email sudah terdaftar" });
            }
            return res.status(500).json({ error: "Database Error" });
        }
        
        // Kirim sukses saja agar frontend bisa langsung redirect
        res.json({ success: true });
    });
});

// 2. PROSES LOGIN
router.post("/login", (req, res) => {
    const { email, password } = req.body;
    
    db.get("SELECT * FROM users WHERE email = ? AND password = ?", [email, password], (err, user) => {
        if (err) return res.status(500).json({ error: "Database Error" });
        if (!user) return res.status(401).json({ error: "Email atau password salah" });
        
        // Simpan data user ke session agar bisa akses dashboard
        req.session.user = {
            id: user.id,
            email: user.email
        };
        
        res.json({ success: true });
    });
});

// 3. PROSES LOGOUT
router.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/");
});

module.exports = router;
