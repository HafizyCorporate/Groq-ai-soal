const express = require("express");
const axios = require("axios");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db");

const router = express.Router();
const uploadDir = path.join(__dirname, "../uploads/");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const upload = multer({ dest: uploadDir });

router.post("/process", upload.array("foto", 10), async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).json({ error: "Login dulu" });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: "Foto wajib diupload" });

    // Baca gambar pertama ke Base64
    const imagePath = req.files[0].path;
    const base64Image = fs.readFileSync(imagePath, { encoding: 'base64' });

    const prompt = `Rangkum materi dari gambar ini dan buatkan ${req.body.jumlah} soal ${req.body.jenis}.
    PENTING: Pisahkan soal dan jawaban HANYA dengan kata kunci ===JAWABAN===. Jangan ada kata ===SOAL=== di awal.`;

    const aiResponse = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.2-90b-vision-preview", // Model Vision Terbaru & Aktif
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

    const fullContent = aiResponse.data.choices[0].message.content;
    const parts = fullContent.split("===JAWABAN===");
    const teksSoal = parts[0].trim();
    const teksJawaban = parts[1] ? parts[1].trim() : "";

    db.run(
      "INSERT INTO history (user_id, soal, jawaban) VALUES (?,?,?)",
      [req.session.user.id, teksSoal, teksJawaban],
      function(err) {
        if (err) return res.status(500).json({ error: "Gagal simpan DB" });
        
        // Hapus file sementara agar Railway tidak penuh
        req.files.forEach(f => { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); });

        res.json({ 
          success: true,
          hasil: teksSoal + "\n===JAWABAN===\n" + teksJawaban, 
          soal: teksSoal,
          jawaban: teksJawaban,
          historyId: this.lastID 
        });
      }
    );
  } catch (err) {
    console.error("AI ERROR:", err.response?.data || err.message);
    res.status(500).json({ error: "Gagal memproses AI" });
  }
});

module.exports = router;
