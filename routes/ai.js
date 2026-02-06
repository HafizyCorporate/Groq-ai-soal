const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db");
const Groq = require("groq-sdk");

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const uploadDir = path.join(__dirname, "../uploads/");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Konfigurasi Multer untuk menerima maksimal 10 gambar
const upload = multer({ dest: uploadDir });

router.post("/process", upload.array("foto", 10), async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).json({ error: "Login dulu" });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: "Foto wajib ada" });

    // Payload awal berisi instruksi teks untuk AI
    const contentPayload = [
      { 
        type: "text", 
        text: `Tugas: Analisis semua gambar yang diberikan (${req.files.length} gambar). Rangkum informasinya dan buat ${req.body.jumlah} soal ${req.body.jenis}.
        
        Aturan Format Soal:
        1. JANGAN menuliskan "Soal PG:" atau "Soal Essay:" di depan nomor.
        2. Gunakan format penomoran langsung: "1) [Pertanyaan]".
        3. JANGAN ada rangkuman materi. Langsung ke daftar soal.
        4. Antar nomor soal berikan jarak 2 baris kosong.
        
        Aturan Referensi Gambar:
        1. Kumpulkan SEMUA link gambar Unsplash yang relevan di bagian paling akhir.
        2. Gunakan judul "--- DOWNLOAD REFERENSI GAMBAR ---".

        Aturan Jawaban:
        1. HANYA 1 jawaban benar, lainnya tidak nyambung (distractor).
        2. Taruh semua kunci setelah pemisah ===JAWABAN===.`
      }
    ];

    // Menambahkan setiap gambar ke dalam payload untuk diproses AI
    req.files.forEach(file => {
      const base64Image = fs.readFileSync(file.path, { encoding: 'base64' });
      contentPayload.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${base64Image}` }
      });
    });

    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: contentPayload }],
      model: "meta-llama/llama-4-scout-17b-16e-instruct", 
      temperature: 0.7,
    });

    const fullContent = completion.choices[0]?.message?.content || "";
    const parts = fullContent.split("===JAWABAN===");
    const teksSoal = parts[0].trim();
    const teksJawaban = parts[1] ? parts[1].trim() : "";

    db.run(
      "INSERT INTO history (user_id, soal, jawaban) VALUES (?,?,?)",
      [req.session.user.id, teksSoal, teksJawaban],
      function (err) {
        if (err) return res.status(500).json({ error: "Gagal simpan ke DB" });
        // Menghapus file sementara dari folder uploads
        req.files.forEach(file => { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); });
        res.json({
          success: true,
          soal: teksSoal,
          jawaban: teksJawaban,
          historyId: this.lastID,
        });
      }
    );
  } catch (err) {
    console.error("GROQ ERROR:", err);
    res.status(500).json({ error: "Gagal memproses AI." });
  }
});

module.exports = router;
