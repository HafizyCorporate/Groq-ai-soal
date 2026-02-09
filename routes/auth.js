const express = require("express");
const router = express.Router();
const db = require("../db");

router.post("/login", (req, res) => {
    const { email, password } = req.body; // email menampung input dari form login
    
    // Login tetap mendukung pengecekan email atau username untuk fleksibilitas
    db.get("SELECT * FROM users WHERE (email = ? OR username = ?) AND password = ?", 
    [email, email, password], (err, user) => {
        if (err) return res.status(500).json({ error: "Database Error" });
        if (!user) return res.status(401).json({ error: "Akun tidak ditemukan atau password salah" });
        
        // Simpan data user ke session
        req.session.user = {
            id: user.id,
            username: user.username,
            role: user.role 
        };
        
        res.json({ success: true, role: user.role });
    });
});

router.post("/register", (req, res) => {
    const { email, password } = req.body;

    // OTOMATIS: Ambil bagian depan email sebagai username 
    // Contoh: azhardax94@gmail.com -> username: azhardax94
    const username = email.split('@')[0];

    // Cek apakah email sudah terdaftar sebelumnya agar tidak duplikat
    db.get("SELECT email FROM users WHERE email = ?", [email], (err, row) => {
        if (err) return res.status(500).json({ error: "Database Error" });
        if (row) return res.status(400).json({ error: "Email sudah terdaftar" });

        // Masukkan ke database dengan role default 'user'
        db.run("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, 'user')", 
        [username, email, password], (err) => {
            if (err) {
                console.error("Register Error:", err);
                return res.status(400).json({ error: "Gagal mendaftarkan akun" });
            }
            res.json({ success: true });
        });
    });
});

router.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/");
});

module.exports = router;
