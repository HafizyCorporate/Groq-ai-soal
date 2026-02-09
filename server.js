const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");
const SibApiV3Sdk = require('@getbrevo/brevo'); // Import Brevo

const app = express();
const PORT = process.env.PORT || 8080;

// 1. Middleware Dasar
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// 2. Setup Folder Uploads
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// 3. Konfigurasi Session
app.use(session({
    secret: "kunci-rahasia-autosoal-2024",
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000, 
        secure: false 
    }
}));

// 4. Akses Folder Statis
app.use(express.static("public"));
app.use("/uploads", express.static(uploadDir));

// --- KONFIGURASI BREVO API ---
let apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
let apiKey = apiInstance.authentications['apiKey'];
apiKey.apiKey = 'XKEYSIP-MASUKKAN-API-KEY-BREVO-KAMU-DISINI'; // <--- GANTI INI

// 5. Menghubungkan ke File API (Routes)
app.use("/auth", require("./routes/auth"));
app.use("/ai", require("./routes/ai"));
app.use("/export", require("./routes/export"));

// 6. Rute Navigasi Halaman
app.get("/", (req, res) => {
    if (req.session.user) return res.redirect("/dashboard");
    res.sendFile(path.join(__dirname, "views/login.html"));
});

app.get("/register", (req, res) => {
    if (req.session.user) return res.redirect("/dashboard");
    res.sendFile(path.join(__dirname, "views/register.html"));
});

// TAMBAHAN: Rute untuk halaman Lupa Password
app.get("/forget", (req, res) => {
    res.sendFile(path.join(__dirname, "views/forget.html"));
});

// TAMBAHAN: Endpoint API untuk kirim email reset password via Brevo
app.post("/auth/forgot-password", async (req, res) => {
    const { email } = req.body;
    
    let sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = "Pemulihan Akun - JAWABAN AI";
    sendSmtpEmail.htmlContent = `
        <div style="font-family: sans-serif; padding: 20px;">
            <h2>Permintaan Reset Password</h2>
            <p>Halo, kami menerima permintaan reset password untuk akun kamu.</p>
            <p>Silakan klik link di bawah untuk mengatur ulang password:</p>
            <a href="http://localhost:${PORT}/reset-password?email=${email}" 
               style="background: #0d1117; color: white; padding: 10px 20px; text-decoration: none; border-radius: 10px;">
               Reset Password Sekarang
            </a>
        </div>`;
    sendSmtpEmail.sender = { "name": "Jawaban AI", "email": "admin@autosoal.com" }; // Ganti dengan email terverifikasi di Brevo
    sendSmtpEmail.to = [{ "email": email }];

    try {
        await apiInstance.sendTransacEmail(sendSmtpEmail);
        res.json({ success: true, message: "Email pemulihan terkirim!" });
    } catch (error) {
        console.error("Brevo Error:", error);
        res.status(500).json({ success: false, error: "Gagal mengirim email" });
    }
});

app.get("/dashboard", (req, res) => {
    if (!req.session.user) return res.redirect("/");
    res.sendFile(path.join(__dirname, "views/dashboard.html"));
});

// 7. Jalankan Server
app.listen(PORT, () => {
    console.log(`
=========================================
🚀 Server Berhasil Dijalankan!
📱 Akses di: http://localhost:${PORT}
🔗 Rute Forget: http://localhost:${PORT}/forget
=========================================
    `);
});
