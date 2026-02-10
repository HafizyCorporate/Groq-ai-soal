const express = require("express");
const router = express.Router();
const db = require("../db");
const path = require("path");

router.post("/login", (req, res) => {
    const { email, password } = req.body; 
    
    // Tetap menggunakan (?) karena db.js akan mengubahnya menjadi ($1, $2, dst) secara otomatis
    const loginQuery = `
        SELECT * FROM users 
        WHERE (LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)) 
        AND password = ?
    `;
    
    db.get(loginQuery, [email, email, password], (err, user) => {
        if (err) {
            console.error("Login Database Error:", err);
            return res.status(500).json({ error: "Database Error" });
        }
        
        if (!user) {
            return res.status(401).json({ error: "Akun tidak ditemukan atau password salah" });
        }
        
        req.session.user = {
            id: user.id,
            username: user.username,
            email: user.email, // Tambahkan email ke session agar middleware isAdmin di server.js bekerja
            role: user.role 
        };
        
        res.json({ success: true, role: user.role });
    });
});

router.post("/register", (req, res) => {
    const { email, password } = req.body;
    const username = email.split('@')[0];

    db.get("SELECT email FROM users WHERE LOWER(email) = LOWER(?)", [email], (err, row) => {
        if (err) return res.status(500).json({ error: "Database Error" });
        if (row) return res.status(400).json({ error: "Email sudah terdaftar" });

        db.run("INSERT INTO users (username, email, password, role, tokens) VALUES (?, ?, ?, 'user', 10)", 
        [username, email, password], (err) => {
            if (err) {
                console.error("Register Error:", err);
                return res.status(400).json({ error: "Gagal mendaftarkan akun" });
            }
            res.json({ success: true });
        });
    });
});

router.get("/me", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, error: "Belum login" });
    }
    const userId = req.session.user.id;
    db.get("SELECT id, username, role, tokens FROM users WHERE id = ?", [userId], (err, user) => {
        if (err || !user) return res.status(500).json({ success: false });
        res.json({ success: true, user });
    });
});

router.get("/admin_page", (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).send("Akses dilarang! Area ini khusus Admin.");
    }
    res.sendFile(path.join(__dirname, "../views/admin.html"));
});

router.get("/admin/users", (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ success: false });
    db.all("SELECT id, username, email, tokens, role FROM users ORDER BY id DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, users: rows });
    });
});

router.post("/admin/update-token", (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ success: false });
    const { userId, newToken } = req.body;
    db.run("UPDATE users SET tokens = ? WHERE id = ?", [newToken, userId], (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

router.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/");
});

module.exports = router;
