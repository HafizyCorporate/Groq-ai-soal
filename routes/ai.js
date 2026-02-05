const express = require("express");
const axios = require("axios");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db");
const router = express.Router();

const upload = multer({ dest: path.join(__dirname, "../uploads/") });

router.post("/process", upload.array("foto", 10), async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).json({ error: "Login dulu" });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: "Foto wajib diupload" });

    // Ambil gambar pertama untuk Vision (bisa dikembangkan untuk loop semua gambar)
    const base64Image = fs.readFileSync(req.files[0].path, { encoding: 'base64' });

    const prompt = `Rangkum isi materi dari gambar ini dan buatkan ${req.body.jumlah} soal ${req.body.jenis}. 
    PENTING: Jangan tulis "===SOAL===" di awal. Pisahkan soal dan jawaban dengan satu kata kunci ===JAWABAN=== saja.`;

    const ai = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.2-11b-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
            ]
          }
        ]
      },
      { headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` } }
    );

    const hasil = ai.data.choices[0].message.content;
    const parts = hasil.split("===JAWABAN===");
    const teksSoal = parts[0].trim();
    const teksJawaban = parts[1] ? parts[1].trim() : "";

    db.run(
      "INSERT INTO history (user_id, soal, jawaban) VALUES (?,?,?)",
      [req.session.user.id, teksSoal, teksJawaban],
      function(err) {
        res.json({ success: true, soal: teksSoal, jawaban: teksJawaban, historyId: this.lastID });
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Gagal AI" });
  }
});

module.exports = router;
