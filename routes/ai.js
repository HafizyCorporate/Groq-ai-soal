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
    
    const jumlahDiminta = req.body.jumlah || 5;

    const contentPayload = [
      { 
        type: "text", 
        text: `Tugas: Analisis materi dari gambar. Buat TEPAT ${jumlahDiminta} soal ${req.body.jenis}. 
        PENTING: Anda harus menyelesaikan semua nomor sampai nomor ${jumlahDiminta}. Jangan berhenti di tengah jalan.

        KOMPOSISI: 80% teks, 20% visual (soal gambar).

        ATURAN PENULISAN SOAL:
        1. Gunakan format nomor langsung: "1) [Pertanyaan]". JANGAN pakai label "Soal PG:".
        2. Berikan jarak 2 baris kosong antar nomor soal agar rapi.
        3. Link Google Image harus spesifik: https://www.google.com/search?q=[keyword]&tbm=isch (Ganti keyword sesuai subjek soal).
        
        STRUKTUR OUTPUT (WAJIB PATUH):
        [Tulis semua daftar soal di sini sampai nomor terakhir]
        
        ###BATAS_AKHIR_SOAL###

        --- KUNCI JAWABAN ---
        [Tulis semua kunci jawaban di sini]

        --- DOWNLOAD REFERENSI GAMBAR ---
        [Tulis link Google Image di sini, sertakan nomor soalnya: "Soal No X: [Link]"]`
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
      temperature: 0.5, // Suhu rendah agar AI sangat patuh pada format
    });

    const fullContent = completion.choices[0]?.message?.content || "";
    
    // Memisahkan soal dan jawaban berdasarkan pembatas unik
    const parts = fullContent.split("###BATAS_AKHIR_SOAL###");
    const teksSoal = parts[0].trim();
    const teksJawaban = parts[1] ? parts[1].trim() : "Gagal memisahkan jawaban.";

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
