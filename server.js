const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 8080;

// 1. Middleware Dasar
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Pastikan folder uploads ada (Untuk simpan gambar & file Word)
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// 3. Konfigurasi Session (Agar tidak error MODULE_NOT_FOUND)
app.use(session({
    secret: "ai-soal-rahasia-banget", 
    resave: false,
    saveUninitialized: false, 
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000, // Aktif 24 Jam
        secure: false // Set true jika kamu pakai HTTPS
    }
}));

// 4. Folder Statis
app.use(express.static("public"));
app.use("/uploads", express.static(uploadDir));

// 5. Daftarkan Routes Utama
app.use("/auth", require("./routes/auth"));
app.use("/ai", require("./routes/ai"));
app.use("/export", require("./routes/export"));

// 6. Routing Halaman
app.get("/", (req, res) => {
    if (req.session.user) return res.redirect("/dashboard");
    res.sendFile(path.join(__dirname, "views/login.html"));
});

app.get("/register", (req, res) => {
    res.sendFile(path.join(__dirname, "views/register.html"));
});

app.get("/dashboard", (req, res) => {
    if (!req.session.user) return res.redirect("/");
    res.sendFile(path.join(__dirname, "views/dashboard.html"));
});

// 7. Jalankan Server
app.listen(PORT, () => {
    console.log(`
🚀 SERVER AKTIF!
📱 URL: http://localhost:${PORT}
📁 Folder Upload: ${uploadDir}
    `);
});
