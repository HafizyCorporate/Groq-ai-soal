const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");
const SibApiV3Sdk = require('@getbrevo/brevo');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// ==========================================
// 1. KONFIGURASI AI (GEMINI 2.5 FLASH)
// ==========================================
// Menggunakan model terbaru sesuai pilihan di Google AI Studio
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

// ==========================================
// 4. ROUTES API (Auth, AI, Export)
// ==========================================
app.use("/auth", require("./routes/auth"));
app.use("/ai", require("./routes/ai"));
app.use("/export", require("./routes/export"));

// ==========================================
// 5. RUTE NAVIGASI HALAMAN (VIEWS)
// ==========================================

// Halaman Login Utama
app.get("/", (req, res) => {
    if (req.session.user) return res.redirect("/dashboard");
    res.sendFile(path.join(__dirname, "views/login.html"));
});

// Halaman Register
app.get("/register", (req, res) => {
    if (req.session.user) return res.redirect("/dashboard");
    res.sendFile(path.join(__dirname, "views/register.html"));
});

// FIX: Rute Forget Password agar tidak error Cannot GET /forget
app.get("/forget", (req, res) => {
    res.sendFile(path.join(__dirname, "views/forget.html"));
});

// Halaman Dashboard
app.get("/dashboard", (req, res) => {
    if (!req.session.user) return res.redirect("/");
    res.sendFile(path.join(__dirname, "views/dashboard.html"));
});

// ==========================================
// 6. LOGIKA FORGOT PASSWORD (BREVO API)
// ==========================================
app.post("/auth/forgot-password", async (req, res) => {
    const { email } = req.body;
    
    let sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = "Pemulihan Akun - JAWABAN AI";
    sendSmtpEmail.htmlContent = `
        <div style="font-family: sans-serif; padding: 30px; border: 1px solid #f0f0f0; border-radius: 20px; max-width: 500px; margin: auto;">
            <h1 style="color: #1a1a1a; font-style: italic; letter-spacing: -1px;">
                JAWABAN <span style="color: #2563eb;">AI</span>
            </h1>
            <p>Halo,</p>
            <p>Kami menerima permintaan untuk mereset password akun kamu di sistem JAWABAN AI.</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://${req.get('host')}/reset-password?email=${email}" 
                   style="background: #0d1117; color: white; padding: 15px 25px; text-decoration: none; border-radius: 12px; font-weight: bold; display: inline-block;">
                   RESET PASSWORD SEKARANG
                </a>
            </div>
            <p style="font-size: 11px; color: #999;">Abaikan email ini jika kamu tidak merasa melakukan permintaan reset.</p>
        </div>`;
    sendSmtpEmail.sender = { "name": "Jawaban AI", "email": "noreply@jawabanai.com" };
    sendSmtpEmail.to = [{ "email": email }];

    try {
        await apiInstance.sendTransacEmail(sendSmtpEmail);
        res.json({ success: true, message: "Email pemulihan terkirim!" });
    } catch (error) {
        console.error("Brevo Error:", error);
        res.status(500).json({ success: false, error: "Gagal mengirim email." });
    }
});

// ==========================================
// 7. JALANKAN SERVER
// ==========================================
app.listen(PORT, () => {
    console.log(`
=============================================
🚀 JAWABAN AI SERVER IS RUNNING
📱 PORT      : ${PORT}
📧 EMAIL     : Brevo API (Active)
🤖 AI MODEL  : Gemini 2.5 Flash (Active)
🔗 RUTE      : /forget (Ready)
=============================================
    `);
});
