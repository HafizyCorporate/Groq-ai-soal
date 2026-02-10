const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");
const SibApiV3Sdk = require('@getbrevo/brevo');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Penyimpanan OTP sementara di memori server
const otpStorage = {}; 

// ==========================================
// 1. KONFIGURASI AI (GEMINI 2.5 FLASH)
// ==========================================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const modelAI = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash" 
});

// ==========================================
// 2. KONFIGURASI EMAIL (BREVO API)
// ==========================================
let apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
let apiKey = apiInstance.authentications['apiKey'];
apiKey.apiKey = process.env.BREVO_API_KEY;

// ==========================================
// 3. MIDDLEWARE & STORAGE
// ==========================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

app.use(session({
    secret: process.env.SESSION_SECRET || "ai-jawaban-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000, 
        secure: false 
    }
}));

app.use(express.static("public"));
app.use("/uploads", express.static(uploadDir));

// --- MIDDLEWARE PERLINDUNGAN ADMIN ---
const isAdmin = (req, res, next) => {
    const ADMIN_EMAIL = "monetsoleh@gmail.com"; 

    if (req.session.user && req.session.user.email === ADMIN_EMAIL) {
        next();
    } else {
        res.status(403).json({ 
            success: false, 
            message: "Akses Ditolak: Anda bukan Admin yang berwenang." 
        });
    }
};

// ==========================================
// 4. ROUTES API (Auth, AI, Export)
// ==========================================
app.use("/auth", require("./routes/auth"));
app.use("/ai", require("./routes/ai"));
app.use("/export", require("./routes/export"));

// --- FITUR ADMIN: TAMBAH TOKEN (DILINDUNGI MIDDLEWARE) ---
app.post("/admin/add-token", isAdmin, async (req, res) => {
    const { email, tokens } = req.body;
    const db = require("./db"); 

    if (!email || !tokens) {
        return res.status(400).json({ success: false, message: "Data tidak lengkap." });
    }

    try {
        const query = `
            UPDATE users 
            SET tokens = COALESCE(tokens, 0) + ? 
            WHERE email ILIKE ?
        `;
        
        db.run(query, [parseInt(tokens), email.trim()], (err) => {
            if (err) throw err;
            res.json({ success: true, message: `Berhasil menambahkan token.` });
        });
    } catch (error) {
        console.error("Admin Token Error:", error);
        res.status(500).json({ success: false, message: "Gagal memperbarui token." });
    }
});

// ==========================================
// 5. RUTE NAVIGASI HALAMAN (VIEWS)
// ==========================================

app.get("/", (req, res) => {
    if (req.session.user) return res.redirect("/dashboard");
    res.sendFile(path.join(__dirname, "views/login.html"));
});

app.get("/register", (req, res) => {
    if (req.session.user) return res.redirect("/dashboard");
    res.sendFile(path.join(__dirname, "views/register.html"));
});

app.get("/forget", (req, res) => {
    res.sendFile(path.join(__dirname, "views/forget.html"));
});

app.get("/dashboard", (req, res) => {
    if (!req.session.user) return res.redirect("/");
    res.sendFile(path.join(__dirname, "views/dashboard.html"));
});

app.get("/ai/history_page", (req, res) => {
    if (!req.session.user) return res.redirect("/");
    res.sendFile(path.join(__dirname, "views/history.html"));
});

// ==========================================
// 6. LOGIKA FORGOT PASSWORD (DIPERBAIKI UNTUK DB.JS)
// ==========================================
app.post("/auth/forgot-password", async (req, res) => {
    const { email } = req.body;
    const db = require("./db"); 

    // MENGGUNAKAN db.get agar sesuai dengan db.js
    db.get("SELECT email FROM users WHERE LOWER(email) = LOWER(?)", [email], async (err, user) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ success: false, error: "Database error." });
        }

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: "Email tidak terdaftar. Silakan daftar akun baru terlebih dahulu." 
            });
        }

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        otpStorage[email] = {
            code: otpCode,
            expires: Date.now() + 600000 
        };

        let sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
        sendSmtpEmail.subject = "Kode Verifikasi Keamanan - SOAL AI";
        sendSmtpEmail.htmlContent = `
            <div style="font-family: sans-serif; padding: 30px; border: 1px solid #f0f0f0; border-radius: 20px; max-width: 400px; margin: auto; text-align: center;">
                <h1 style="color: #1a1a1a; font-style: italic; letter-spacing: -1px;">
                    SOAL <span style="color: #2563eb;">AI</span>
                </h1>
                <p style="color: #666; font-size: 14px;">Halo,</p>
                <p style="color: #666; font-size: 14px;">Gunakan kode verifikasi di bawah ini untuk merubah password akun kamu:</p>
                <div style="background: #eff4ff; padding: 20px; border-radius: 15px; margin: 25px 0;">
                    <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #2563eb;">${otpCode}</span>
                </div>
                <p style="font-size: 11px; color: #999;">Kode ini bersifat rahasia dan akan kedaluwarsa dalam 10 menit.</p>
            </div>`;
        
        sendSmtpEmail.sender = { "name": "Soal AI", "email": "azhardax94@gmail.com" };
        sendSmtpEmail.to = [{ "email": email }];

        try {
            await apiInstance.sendTransacEmail(sendSmtpEmail);
            res.json({ success: true, message: "Kode OTP telah dikirim ke email kamu!" });
        } catch (error) {
            console.error("Brevo Error:", error);
            res.status(500).json({ success: false, error: "Gagal mengirim email verifikasi." });
        }
    });
});

// ==========================================
// 7. RUTE VERIFIKASI OTP (DIPERBAIKI UNTUK DB.JS)
// ==========================================
app.post("/auth/reset-password", async (req, res) => {
    const { email, otp, newPassword } = req.body;
    const db = require("./db"); 

    const record = otpStorage[email];

    if (!record || record.code !== otp) {
        return res.status(400).json({ success: false, error: "Kode OTP salah." });
    }

    if (Date.now() > record.expires) {
        delete otpStorage[email];
        return res.status(400).json({ success: false, error: "Kode OTP sudah kedaluwarsa." });
    }

    try {
        // MENGGUNAKAN db.run sesuai fungsi di db.js
        db.run("UPDATE users SET password = ? WHERE LOWER(email) = LOWER(?)", [newPassword, email], (err) => {
            if (err) {
                return res.status(500).json({ success: false, error: "Gagal memperbarui password." });
            }
            delete otpStorage[email]; 
            res.json({ success: true, message: "Password berhasil dirubah!" });
        });
    } catch (error) {
        res.status(500).json({ success: false, error: "Terjadi kesalahan sistem." });
    }
});

// ==========================================
// 8. JALANKAN SERVER
// ==========================================
app.listen(PORT, () => {
    console.log(`
=============================================
🚀 SOAL AI SERVER IS RUNNING
📱 PORT      : ${PORT}
📧 EMAIL     : Brevo API (OTP System Active)
🤖 AI MODEL  : Gemini 2.5 Flash (Active)
🔗 RUTE      : /forget (Ready)
🔗 HISTORY   : /ai/history_page (Ready)
🔗 ADMIN     : /admin/add-token (Protected - Ready)
=============================================
    `);
});
