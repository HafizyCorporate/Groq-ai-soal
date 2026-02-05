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

    // Ambil gambar pertama untuk diproses Vision
    const base64Image = fs.readFileSync(req.files[0].path, { encoding: 'base64' });

    const prompt = `Rangkum materi dari gambar ini dan buatkan ${req.body.jumlah} soal ${req.body.jenis}. 
    ATURAN: Jangan tulis "===SOAL===" di awal. Pisahkan soal dan jawaban dengan pembatas ===JAWABAN=== saja.`;

    const response = await axios.post(
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

    const fullText = response.data.choices[0].message.content;
    const [teksSoal, teksJawaban] = fullText.split("===JAWABAN===").map(t => t?.trim() || "");

    // Simpan terpisah ke DB agar export tidak dobel
    db.run(
      "INSERT INTO history (user_id, soal, jawaban) VALUES (?,?,?)",
      [req.session.user.id, teksSoal, teksJawaban],
      function(err) {
        if (err) return res.status(500).json({ error: "Gagal simpan DB" });
        res.json({ success: true, soal: teksSoal, jawaban: teksJawaban, historyId: this.lastID });
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Gagal memproses AI" });
  }
});

module.exports = router;
