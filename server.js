const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 8080;

// 1. Middleware Dasar
app.use(express.json()); // Membaca data JSON dari fetch frontend
app.use(express.urlencoded({ extended: true }));

// 2. Setup Folder Uploads (Otomatis dibuat jika belum ada)
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// 3. Konfigurasi Session (Penting agar login tersimpan di browser)
app.use(session({
    secret: "kunci-rahasia-autosoal-2024",
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000, // Aktif selama 24 jam
        secure: false // Set true jika menggunakan HTTPS
    }
}));

// 4. Akses Folder Statis
app.use(express.static("public"));
app.use("/uploads", express.static(uploadDir));

// 5. Menghubungkan ke File API (Routes)
app.use("/auth", require("./routes/auth"));
app.use("/ai", require("./routes/ai"));
app.use("/export", require("./routes/export"));

// 6. Rute Navigasi Halaman (Halaman Utama/Login)
app.get("/", (req, res) => {
    // Jika user sudah login, langsung lempar ke dashboard
    if (req.session.user) return res.redirect("/dashboard");
    res.sendFile(path.join(__dirname, "views/login.html"));
});

// Halaman Register
app.get("/register", (req, res) => {
    if (req.session.user) return res.redirect("/dashboard");
    res.sendFile(path.join(__dirname, "views/register.html"));
});

// Halaman Dashboard (Hanya bisa diakses jika sudah Login)
app.get("/dashboard", (req, res) => {
    if (!req.session.user) {
        // Jika belum login, paksa balik ke halaman depan
        return res.redirect("/");
    }
    res.sendFile(path.join(__dirname, "views/dashboard.html"));
});

// 7. Jalankan Server
app.listen(PORT, () => {
    console.log(`
=========================================
🚀 Server Berhasil Dijalankan!
📱 Akses di: http://localhost:${PORT}
📂 Folder Uploads: Aktif
=========================================
    `);
});
