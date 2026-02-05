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
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: "Foto wajib ada" });

    // Ambil gambar pertama untuk dibaca AI Vision
    const imagePath = req.files[0].path;
    const base64Image = fs.readFileSync(imagePath, { encoding: 'base64' });

    const prompt = `Tolong rangkum materi dari gambar ini dan buatkan ${req.body.jumlah} soal ${req.body.jenis}. 
    ATURAN: 
    - JANGAN tulis "===SOAL===" di bagian atas.
    - Pisahkan antara soal dan jawaban HANYA dengan kata kunci ===JAWABAN===
    - Berikan rangkuman singkat di awal sebelum soal.`;

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.2-11b-vision-preview", // Model Vision agar bisa baca gambar
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

    const fullText = response.data.choices[0].message.content;
    const parts = fullText.split("===JAWABAN===");
    const teksSoal = parts[0].trim();
    const teksJawaban = parts[1] ? parts[1].trim() : "";

    // Simpan terpisah ke DB
    db.run(
      "INSERT INTO history (user_id, soal, jawaban) VALUES (?,?,?)",
      [req.session.user.id, teksSoal, teksJawaban],
      function(err) {
        if (err) return res.status(500).json({ error: "Gagal simpan DB" });
        res.json({ success: true, soal: teksSoal, jawaban: teksJawaban, historyId: this.lastID });
      }
    );

    // Hapus file setelah diproses agar hemat memori (cegah SIGTERM)
    req.files.forEach(file => fs.unlinkSync(file.path));

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal memproses AI" });
  }
});

module.exports = router;
