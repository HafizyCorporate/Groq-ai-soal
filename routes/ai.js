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

    const userId = req.session.user.id;
    const userRole = req.session.user.role; 

    // --- LOGIKA LIMIT 1X SEHARI (KECUALI ADMIN VERSACY) ---
    if (userRole !== 'admin') {
      const today = new Date().toISOString().split('T')[0];
      const checkLimit = await new Promise((resolve) => {
        db.get(
          "SELECT COUNT(*) as total FROM history WHERE user_id = ? AND date(created_at) = ?", 
          [userId, today], 
          (err, row) => resolve(row ? row.total : 0)
        );
      });

      if (checkLimit >= 1) {
        return res.status(403).json({ 
          error: "Jatah harian Anda habis (Maksimal 1x sehari). Hubungi Admin untuk upgrade ke Premium!" 
        });
      }
    }

    if (!req.files || req.files.length === 0) return res.status(400).json({ error: "Foto wajib ada" });
    
    const jumlahDiminta = req.body.jumlah || 5;

    const contentPayload = [
      { 
        type: "text", 
        text: `Tugas: Analisis materi dari gambar. Buat TEPAT ${jumlahDiminta} soal ${req.body.jenis}.

        STRUKTUR OUTPUT WAJIB:
        1. Tulis daftar soal terlebih dahulu.
        2. Gunakan pemisah ###BATAS_AKHIR_SOAL### tepat setelah soal terakhir.
        3. Tulis Kunci Jawaban dan Link Referensi Gambar di bawah pemisah tersebut.

        ATURAN PENULISAN:
        - Soal: "1) [Pertanyaan]"
        - Link Google Image: "https://www.google.com/search?q=[keyword]&tbm=isch"

        CONTOH FORMAT AKHIR:
        [Daftar Soal...]
        ###BATAS_AKHIR_SOAL###
        --- KUNCI JAWABAN ---
        [Isi Jawaban...]
        --- DOWNLOAD REFERENSI GAMBAR ---
        [Isi Link...]`
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
      temperature: 0.5,
    });

    const fullContent = completion.choices[0]?.message?.content || "";
    
    // Logika Pemisahan yang Disempurnakan
    let teksSoal = "";
    let teksJawaban = "";

    if (fullContent.includes("###BATAS_AKHIR_SOAL###")) {
        const parts = fullContent.split("###BATAS_AKHIR_SOAL###");
        teksSoal = parts[0].trim();
        teksJawaban = parts[1].trim();
    } else {
        // Fallback jika AI tidak menyertakan tanda pagar
        const fallbackParts = fullContent.split(/--- KUNCI JAWABAN ---|Kunci Jawaban:/i);
        teksSoal = fallbackParts[0].trim();
        teksJawaban = fallbackParts[1] ? "--- KUNCI JAWABAN --- " + fallbackParts[1].trim() : "Gagal memisahkan jawaban secara otomatis.";
    }

    db.run(
      "INSERT INTO history (user_id, soal, jawaban, created_at) VALUES (?,?,?, CURRENT_TIMESTAMP)",
      [userId, teksSoal, teksJawaban],
      function (err) {
        if (err) return res.status(500).json({ error: "Gagal simpan ke DB" });
        req.files.forEach(file => { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); });
        res.json({
          success: true,
          soal: teksSoal,
          jawaban: teksJawaban, // Data ini yang akan tampil di kolom hitam
          historyId: this.lastID,
        });
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Gagal memproses AI." });
  }
});

module.exports = router;
