const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 8080;

// 1. Middleware Dasar
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Pastikan folder uploads ada (agar tidak error saat simpan gambar/Word)
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// 3. Konfigurasi Session (Optimasi untuk Railway)
app.use(session({
    secret: "secret-key-groq-ai", // Ganti bebas
    resave: false,
    saveUninitialized: false, // Membantu mengurangi penggunaan memori
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000, // 1 Hari
        secure: false // Set true jika menggunakan HTTPS
    }
}));

// 4. Folder Statis (CSS, JS Frontend, dan Hasil Download)
app.use(express.static("public"));
app.use("/uploads", express.static(uploadDir));

// 5. Hubungkan Routes
app.use("/auth", require("./routes/auth"));
app.use("/ai", require("./routes/ai"));
app.use("/export", require("./routes/export"));

// 6. Routing Halaman Utama
// Login
app.get("/", (req, res) => {
    if (req.session.user) return res.redirect("/dashboard");
    res.sendFile(path.join(__dirname, "views/login.html"));
});

// Register
app.get("/register", (req, res) => {
    res.sendFile(path.join(__dirname, "views/register.html"));
});

// Dashboard (Proteksi Login)
app.get("/dashboard", (req, res) => {
    if (!req.session.user) return res.redirect("/");
    res.sendFile(path.join(__dirname, "views/dashboard.html"));
});

// 7. Jalankan Server
app.listen(PORT, () => {
    console.log(`
🚀 SERVER RUNNING!
📱 URL: http://localhost:${PORT}
📁 Upload Dir: ${uploadDir}
    `);
});
