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

router.post("/process", upload.array("foto", 10), async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).json({ error: "Login dulu" });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: "Foto wajib ada" });

    const imagePath = req.files[0].path;
    const base64Image = fs.readFileSync(imagePath, { encoding: 'base64' });

    const jenisSoal = req.body.jenis; 
    const jumlahSoal = req.body.jumlah;

    const prompt = `Tugas: Buat soal berdasarkan gambar.
    
    Aturan Format Soal:
    1. Buat ${jumlahSoal} soal ${jenisSoal}.
    2. JANGAN menuliskan "Soal PG:" atau "Soal Essay:" di depan nomor.
    3. Gunakan format penomoran langsung: "1) [Pertanyaan]".
    4. JANGAN ada rangkuman materi. Langsung ke daftar soal.
    5. Antar nomor soal berikan jarak 2 baris kosong.
    
    Aturan Referensi Gambar:
    1. Cari link gambar yang relevan dari Unsplash.
    2. JANGAN taruh link gambar di bawah soal.
    3. Kumpulkan SEMUA link gambar di bagian paling akhir, di bawah Kunci Jawaban.
    4. Gunakan judul "--- DOWNLOAD REFERENSI GAMBAR ---".

    Aturan Jawaban:
    1. HANYA 1 jawaban benar, lainnya tidak nyambung (out of context).
    2. Taruh semua kunci setelah pemisah ===JAWABAN===.`;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "user", content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
          ]
        },
      ],
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
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
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
