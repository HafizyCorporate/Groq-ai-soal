const express = require("express");
const router = express.Router();
const db = require("../db");

// 1. PROSES REGISTER (Daftar Akun)
router.post("/register", (req, res) => {
    // Menambahkan username agar sesuai dengan data Versacy
    const { username, email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email dan password wajib diisi" });
    }

    // Role default adalah 'user' (kena limit 1x)
    const role = 'user';

    db.run(
        "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)", 
        [username, email, password, role], 
        function(err) {
            if (err) {
                if (err.message.includes("UNIQUE constraint failed")) {
                    return res.status(400).json({ error: "Email atau Username sudah terdaftar" });
                }
                return res.status(500).json({ error: "Database Error" });
            }
            res.json({ success: true });
        }
    );
});

// 2. PROSES LOGIN
router.post("/login", (req, res) => {
    // Kamu bisa login pakai Email atau Username
    const { email, password } = req.body;
    
    // Query diubah agar mengambil data role juga
    db.get("SELECT * FROM users WHERE (email = ? OR username = ?) AND password = ?", [email, email, password], (err, user) => {
        if (err) return res.status(500).json({ error: "Database Error" });
        if (!user) return res.status(401).json({ error: "Email/Username atau password salah" });
        
        // --- BAGIAN PALING PENTING ---
        // Simpan ID, Email, dan ROLE ke session
        req.session.user = {
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role // Ini yang menentukan Versacy bebas limit
        };
        
        res.json({ success: true, role: user.role });
    });
});

// 3. PROSES LOGOUT
router.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/");
});

module.exports = router;
