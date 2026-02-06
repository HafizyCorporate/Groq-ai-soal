const express = require("express");
const router = express.Router();
const db = require("../db");

router.post("/login", (req, res) => {
    const { email, password } = req.body; // email di sini menampung input user/email
    
    db.get("SELECT * FROM users WHERE (email = ? OR username = ?) AND password = ?", 
    [email, email, password], (err, user) => {
        if (err) return res.status(500).json({ error: "Database Error" });
        if (!user) return res.status(401).json({ error: "Akun tidak ditemukan atau password salah" });
        
        // Simpan role agar di ai.js bisa dicek
        req.session.user = {
            id: user.id,
            username: user.username,
            role: user.role 
        };
        
        res.json({ success: true, role: user.role });
    });
});

router.post("/register", (req, res) => {
    const { username, email, password } = req.body;
    db.run("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, 'user')", 
    [username, email, password], (err) => {
        if (err) return res.status(400).json({ error: "Gagal daftar" });
        res.json({ success: true });
    });
});

router.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/");
});

module.exports = router;
