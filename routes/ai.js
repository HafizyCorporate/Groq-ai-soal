const express = require("express");
const axios = require("axios");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db");

const router = express.Router();
const uploadDir = path.join(__dirname, "../uploads/");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Gunakan array agar tidak crash saat terima banyak file
const upload = multer({ dest: uploadDir });

router.post("/process", upload.array("foto", 10), async (req, res) => {
  try {
    // 1. Validasi
    if (!req.session.user) return res.status(401).json({ error: "Login dulu" });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: "Foto wajib diupload" });

    console.log("Memulai proses AI untuk user:", req.session.user.email); // Log untuk debug

    // 2. Baca Gambar (Ambil file pertama)
    const imagePath = req.files[0].path;
    const base64Image = fs.readFileSync(imagePath, { encoding: 'base64' });

    // 3. Prompt Khusus
    const prompt = `Rangkum materi dari gambar ini dan buatkan ${req.body.jumlah} soal ${req.body.jenis}.
    PENTING:
    - Jangan tulis "===SOAL===" di awal.
    - Pisahkan soal dan jawaban HANYA dengan kata kunci ===JAWABAN===.`;

    // 4. Kirim ke Groq
    const aiResponse = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.2-11b-vision-preview", // Model Vision
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

    // 5. Olah Hasil
    const fullContent = aiResponse.data.choices[0].message.content;
    const parts = fullContent.split("===JAWABAN===");
    const teksSoal = parts[0].trim();
    const teksJawaban = parts[1] ? parts[1].trim() : "";

    // 6. Simpan DB
    db.run(
      "INSERT INTO history (user_id, soal, jawaban) VALUES (?,?,?)",
      [req.session.user.id, teksSoal, teksJawaban],
      function(err) {
        if (err) {
          console.error("DB Error:", err);
          return res.status(500).json({ error: "Gagal simpan DB" });
        }

        // Hapus file agar memori aman
        req.files.forEach(f => { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); });

        // === HYBRID RESPONSE ===
        // Mengirim 'hasil' (untuk frontend lama) DAN 'soal/jawaban' (untuk frontend baru)
        res.json({ 
          success: true,
          hasil: teksSoal + "\n===JAWABAN===\n" + teksJawaban, // Ini biar frontend lamamu jalan
          soal: teksSoal,
          jawaban: teksJawaban,
          historyId: this.lastID 
        });
      }
    );

  } catch (err) {
    // Log error detail ke Railway console
    console.error("AI CRITICAL ERROR:", err.response?.data || err.message);
    res.status(500).json({ error: "Gagal memproses AI. Cek Log Railway." });
  }
});

module.exports = router;
