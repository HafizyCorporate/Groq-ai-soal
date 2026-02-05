const express = require("express");
const axios = require("axios");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db");

const router = express.Router();

// Setup multer untuk uploads
const uploadDir = path.join(__dirname, "../uploads/");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const upload = multer({ dest: uploadDir });

// Route POST /ai/process
router.post("/process", upload.single("foto"), async (req, res) => {
  try {
    // Pastikan user login
    if (!req.session.user) return res.status(401).json({ error: "Login dulu" });

    // Pastikan foto ada
    if (!req.file) return res.status(400).json({ error: "Foto wajib diupload" });

    // Prompt untuk AI
    const prompt = `
Buat ${req.body.jumlah} soal ${req.body.jenis} dari rangkuman foto.
Format:
===SOAL===
===JAWABAN===
`;

    // Panggil Groq AI
    const ai = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant", // model aktif & cepat
        messages: [{ role: "user", content: prompt }]
      },
      { headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` } }
    );

    const hasil = ai.data.choices[0].message.content;

    // Simpan ke history DB
    db.run(
      "INSERT INTO history (user_id, soal, jawaban) VALUES (?,?,?)",
      [req.session.user.id, hasil, hasil],
      function(err) {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: "Gagal menyimpan history" });
        }
        // Kirim hasil & historyId ke frontend
        res.json({ hasil, historyId: this.lastID });
      }
    );

  } catch (err) {
    console.error("AI ERROR:", err.response?.data || err);
    res.status(500).json({ error: "Gagal memproses AI" });
  }
});

module.exports = router;
