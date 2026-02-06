const express = require("express");
const axios = require("axios");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db");

const router = express.Router();

// Setup folder uploads
const uploadDir = path.join(__dirname, "../uploads/");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// PENTING: Gunakan .array() agar cocok dengan tampilan "Maks 10 file" di screenshotmu
const upload = multer({ dest: uploadDir });

router.post("/process", upload.array("foto", 10), async (req, res) => {
  try {
    // 1. Cek Login & File
    if (!req.session.user) return res.status(401).json({ error: "Login dulu" });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: "Foto wajib diupload" });

    // 2. Siapkan Gambar untuk AI (Convert ke Base64)
    // Kita ambil gambar pertama saja sebagai acuan utama
    const imagePath = req.files[0].path;
    const base64Image = fs.readFileSync(imagePath, { encoding: 'base64' });

    // 3. Buat Prompt
    const prompt = `
    Tugas: Rangkum materi dari gambar ini, lalu buatkan ${req.body.jumlah} soal tipe ${req.body.jenis}.
    
    ATURAN PENTING:
    - Jangan tulis "===SOAL===" di baris pertama.
    - Pisahkan bagian Soal dan Kunci Jawaban HANYA dengan kata kunci ===JAWABAN===.
    - Jangan ada teks pembuka seperti "Tentu, ini soalnya...". Langsung ke materi/soal.
    `;

    // 4. Kirim ke Groq (Pakai Model VISION)
    const aiResponse = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.2-11b-vision-preview", // Model yang bisa lihat gambar
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { 
                type: "image_url", 
                image_url: { url: `data:image/jpeg;base64,${base64Image}` } 
              }
            ]
          }
        ],
        temperature: 0.5,
        max_tokens: 1500
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`, // Pastikan API Key di Railway benar
          "Content-Type": "application/json"
        }
      }
    );

    // 5. Olah Hasil AI
    const content = aiResponse.data.choices[0].message.content;
    const parts = content.split("===JAWABAN===");
    const teksSoal = parts[0] ? parts[0].trim() : "Gagal membuat soal.";
    const teksJawaban = parts[1] ? parts[1].trim() : "";

    // 6. Simpan ke Database (Pisah Soal & Jawaban agar Export Word Rapi)
    db.run(
      "INSERT INTO history (user_id, soal, jawaban) VALUES (?,?,?)",
      [req.session.user.id, teksSoal, teksJawaban],
      function(err) {
        if (err) {
          console.error("Database Error:", err);
          return res.status(500).json({ error: "Gagal simpan DB" });
        }

        // Hapus file sementara agar server tidak penuh (Penyebab Crash/SIGTERM)
        req.files.forEach(f => {
          if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
        });

        // Kirim sukses ke Frontend
        // Perhatikan: Frontendmu pakai 'data.hasil' untuk split, kita sesuaikan output jsonnya
        res.json({ 
          success: true,
          hasil: teksSoal + "\n\n===JAWABAN===\n" + teksJawaban, // Gabung biar frontend lama tetap jalan
          historyId: this.lastID 
        });
      }
    );

  } catch (err) {
    console.error("AI ERROR DETAIL:", err.response?.data || err.message);
    res.status(500).json({ error: "Gagal memproses AI. Cek log server." });
  }
});

module.exports = router;
