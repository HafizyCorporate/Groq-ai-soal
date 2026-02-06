const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db");
// Menggunakan SDK Resmi Groq
const Groq = require("groq-sdk");

const router = express.Router();

// Pastikan GROQ_API_KEY sudah diisi di Environment Variables Railway
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const uploadDir = path.join(__dirname, "../uploads/");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const upload = multer({ dest: uploadDir });

router.post("/process", upload.array("foto", 10), async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).json({ error: "Login dulu" });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: "Foto wajib ada" });

    // 1. Konversi gambar ke Base64 agar bisa dibaca AI Vision
    const imagePath = req.files[0].path;
    const base64Image = fs.readFileSync(imagePath, { encoding: 'base64' });

    const prompt = `Rangkum materi dari gambar ini dan buatkan ${req.body.jumlah} soal ${req.body.jenis}.
    PENTING: Pisahkan soal dan jawaban HANYA dengan kata kunci ===JAWABAN===. Jangan tulis ===SOAL=== di awal.`;

    // 2. Jalankan Chat Completion menggunakan Groq SDK
    // Kita gunakan model Vision terbaru yang aktif: llama-3.2-11b-vision-preview
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      model: "llama-3.2-11b-vision-preview", 
      temperature: 0.7,
    });

    const fullContent = completion.choices[0]?.message?.content || "";
    const parts = fullContent.split("===JAWABAN===");
    const teksSoal = parts[0].trim();
    const teksJawaban = parts[1] ? parts[1].trim() : "";

    // 3. Simpan ke Database
    db.run(
      "INSERT INTO history (user_id, soal, jawaban) VALUES (?,?,?)",
      [req.session.user.id, teksSoal, teksJawaban],
      function (err) {
        if (err) return res.status(500).json({ error: "Gagal simpan DB" });

        // Hapus file sementara agar storage Railway tidak penuh
        req.files.forEach((f) => {
          if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
        });

        res.json({
          success: true,
          hasil: teksSoal + "\n===JAWABAN===\n" + teksJawaban,
          soal: teksSoal,
          jawaban: teksJawaban,
          historyId: this.lastID,
        });
      }
    );
  } catch (err) {
    console.error("GROQ SDK ERROR:", err);
    res.status(500).json({ error: "Gagal memproses AI. Cek model vision di Groq Cloud." });
  }
});

module.exports = router;
