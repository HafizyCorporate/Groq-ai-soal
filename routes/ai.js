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
        text: `Tugas: Analisis materi dari gambar yang diberikan. Buat ${req.body.jumlah} soal ${req.body.jenis}.
        
        KOMPOSISI SOAL:
        - 80% soal teks, 20% soal visual (contoh: "Gambar apakah ini?").

        ATURAN LINK GAMBAR (GOOGLE SEARCH):
        1. JANGAN gunakan Unsplash atau Picsum jika tidak suka.
        2. Gunakan format link pencarian langsung agar siswa bisa klik dan lihat hasilnya:
           https://www.google.com/search?q=[keyword]&tbm=isch
        3. Ganti [keyword] dengan subjek soal. Contoh jika soal monyet:
           https://www.google.com/search?q=gambar+monyet+lucu&tbm=isch
        
        ATURAN FORMAT:
        1. JANGAN tulis label "Soal PG:". Langsung nomor: "1) [Pertanyaan]".
        2. Berikan jarak 2 baris antar soal.
        
        ATURAN REFERENSI GAMBAR:
        1. Taruh link di halaman terakhir setelah Kunci Jawaban.
        2. WAJIB tuliskan nomor soalnya. Contoh: "Soal No 1: [Link Google]".
        3. Gunakan judul "--- DOWNLOAD REFERENSI GAMBAR ---".

        Aturan Jawaban:
        1. HANYA 1 jawaban benar. Pisahkan dengan ===JAWABAN===.`
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
          success: true, soal: teksSoal, jawaban: teksJawaban, historyId: this.lastID,
        });
      }
    );
  } catch (err) {
    console.error("GROQ ERROR:", err);
    res.status(500).json({ error: "Gagal memproses AI." });
  }
});

module.exports = router;
