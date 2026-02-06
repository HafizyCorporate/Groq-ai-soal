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

    // Menyesuaikan instruksi berdasarkan jenis soal yang dipilih user
    const jenisSoal = req.body.jenis; // 'PG' atau 'Essay'
    const jumlahSoal = req.body.jumlah;

    const prompt = `Tugas: Buat soal dari gambar yang diberikan.
    
    Aturan Format:
    1. Buat ${jumlahSoal} soal ${jenisSoal}. JANGAN membuat rangkuman materi.
    2. Jika Pilihan Ganda:
       - Berikan 1 baris kosong antara pertanyaan dan pilihan A.
       - Berikan 2 baris kosong antara nomor soal (jarak antar soal).
       - Format pilihan: A. [teks], B. [teks], dst.
    3. Jika Essay:
       - Berikan 1 baris kosong antar nomor soal (jarak antar soal).
    4. Kunci Jawaban:
       - JANGAN tulis jawaban di bawah soal langsung.
       - Tuliskan SEMUA kunci jawaban di bagian paling akhir setelah tanda ===JAWABAN===.
    
    Contoh Output Akhir:
    [Seluruh Soal]
    
    ===JAWABAN===
    Jawaban ${jenisSoal}:
    1. ...
    2. ...`;

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
