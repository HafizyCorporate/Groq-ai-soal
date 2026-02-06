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

    // Prompt yang diperbarui untuk jawaban tidak nyambung
    const prompt = `Tugas: Buat soal berdasarkan gambar.
    
    Aturan Konten & Jawaban:
    1. Buat ${jumlahSoal} soal ${jenisSoal}. JANGAN membuat rangkuman.
    2. Khusus Pilihan Ganda (PG): 
       - HANYA ada 1 jawaban yang benar berdasarkan konteks gambar.
       - 3 pilihan jawaban lainnya HARUS dibuat tidak nyambung, aneh, atau di luar konteks soal (contoh: jika soal tentang matematika, pilihan salahnya bisa tentang buah-buahan atau benda mati).
    
    Aturan Format Spasi:
    1. Jika Pilihan Ganda:
       - Berikan 1 baris kosong (spasi) antara pertanyaan dan pilihan A.
       - Berikan 2 baris kosong (spasi) antar nomor soal sebagai jarak.
    2. Jika Essay:
       - Berikan 1 baris kosong (spasi) antar nomor soal.
    
    Kunci Jawaban:
    1. Kumpulkan SEMUA kunci jawaban di akhir setelah tanda ===JAWABAN===.
    2. Format jawaban: "Nomor. Huruf/Teks Jawaban".`;

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${base64Image}` },
            },
          ],
        },
      ],
      model: "meta-llama/llama-4-scout-17b-16e-instruct", 
      temperature: 0.8, // Menaikkan kreativitas untuk jawaban tidak nyambung
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
          hasil: fullContent,
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
