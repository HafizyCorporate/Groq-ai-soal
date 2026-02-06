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

const upload = multer({ dest: uploadDir });

router.post("/process", upload.array("foto", 5), async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).json({ error: "Login dulu" });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: "Foto wajib ada" });
    if (req.files.length > 5) return res.status(400).json({ error: "Maksimal 5 gambar saja" });

    const contentPayload = [
      { 
        type: "text", 
        text: `Tugas: Analisis semua gambar yang diberikan (${req.files.length} gambar). Buat ${req.body.jumlah} soal ${req.body.jenis}.
        
        KOMPOSISI SOAL:
        - 80% soal berbasis teks (berdasarkan materi).
        - 20% soal berbasis pengamatan gambar (visual). Contoh: "Hewan apakah yang ada pada gambar?" atau "Benda apa yang ditunjukkan tanda panah?".

        Aturan Format Soal:
        1. JANGAN menuliskan "Soal PG:" atau "Soal Essay:" di depan nomor.
        2. Gunakan format penomoran langsung: "1) [Pertanyaan]".
        3. JANGAN ada rangkuman materi. Langsung ke daftar soal.
        4. Antar nomor soal berikan jarak 2 baris kosong.
        
        Aturan Referensi Gambar:
        1. Cari link gambar Unsplash yang BENAR-BENAR RELEVAN dengan soal visual tersebut (Contoh: Soal monyet harus link gambar monyet).
        2. Letakkan SEMUA link gambar di bagian paling akhir setelah Kunci Jawaban.
        3. WAJIB tuliskan nomor soal untuk setiap link. Contoh: "Soal No 1: [Link Unsplash]".
        4. Gunakan judul "--- DOWNLOAD REFERENSI GAMBAR ---".

        Aturan Jawaban:
        1. HANYA 1 jawaban benar.
        2. Taruh semua kunci setelah pemisah ===JAWABAN===.`
      }
    ];

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
