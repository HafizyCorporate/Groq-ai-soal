const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db");
const Groq = require("groq-sdk");

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Konfigurasi Penyimpanan Gambar
const uploadDir = path.join(__dirname, "../uploads/");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const upload = multer({ dest: uploadDir });

router.post("/process", upload.array("foto", 5), async (req, res) => {
  try {
    // 1. Validasi Sesi Login
    if (!req.session.user) {
      return res.status(401).json({ error: "Silakan login terlebih dahulu." });
    }

    const userId = req.session.user.id;
    const userRole = req.session.user.role; 

    // 2. Logika Limit (Hanya untuk role 'user')
    // Admin dan Premium bebas limit
    if (userRole === 'user') {
      const today = new Date().toISOString().split('T')[0];
      const checkLimit = await new Promise((resolve) => {
        db.get(
          "SELECT COUNT(*) as total FROM history WHERE user_id = ? AND date(created_at) = ?", 
          [userId, today], 
          (err, row) => resolve(row ? row.total : 0)
        );
      });

      // Jika sudah 1x, kirim status 403 (Forbidden) untuk memicu Modal di Dashboard
      if (checkLimit >= 1) {
        return res.status(403).json({ 
          error: "Jatah harian habis. Silakan upgrade ke Premium!" 
        });
      }
    }

    // 3. Validasi Input
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "Mohon upload minimal 1 gambar materi." });
    }
    
    const jumlahDiminta = req.body.jumlah || 5;
    const jenisSoal = req.body.jenis || "PG";

    // 4. Menyusun Payload untuk Groq AI
    const contentPayload = [
      { 
        type: "text", 
        text: `Tugas: Analisis materi dari gambar yang diberikan. 
               Buat TEPAT ${jumlahDiminta} soal dalam bentuk ${jenisSoal}.
               
               STRUKTUR OUTPUT WAJIB:
               1. Tulis daftar soal lengkap.
               2. Tulis pemisah ini: ###BATAS_AKHIR_SOAL###
               3. Tulis Kunci Jawaban di bawah pemisah tersebut.`
      }
    ];

    // Mengonversi Gambar ke Base64 agar bisa dibaca AI
    req.files.forEach(file => {
      const base64Image = fs.readFileSync(file.path, { encoding: 'base64' });
      contentPayload.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${base64Image}` }
      });
    });

    // 5. Memanggil API Groq
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: contentPayload }],
      model: "llama-3.2-11b-vision-preview", // Pastikan model vision aktif
      temperature: 0.5,
    });

    const fullContent = completion.choices[0]?.message?.content || "";
    let teksSoal = "";
    let teksJawaban = "";

    // 6. Memisahkan Soal dan Jawaban berdasarkan separator
    if (fullContent.includes("###BATAS_AKHIR_SOAL###")) {
        const parts = fullContent.split("###BATAS_AKHIR_SOAL###");
        teksSoal = parts[0].trim();
        teksJawaban = parts[1].trim();
    } else {
        // Fallback jika AI tidak mengikuti format separator
        const fallbackParts = fullContent.split(/Kunci Jawaban:|Jawaban:/i);
        teksSoal = fallbackParts[0].trim();
        teksJawaban = fallbackParts[1] ? "Kunci Jawaban: " + fallbackParts[1].trim() : "Kunci jawaban disertakan di dalam teks.";
    }

    // 7. Simpan ke Database History
    db.run(
      "INSERT INTO history (user_id, soal, jawaban, created_at) VALUES (?,?,?, CURRENT_TIMESTAMP)",
      [userId, teksSoal, teksJawaban],
      function (err) {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: "Gagal menyimpan riwayat ke database." });
        }

        // Hapus file sementara di folder uploads setelah diproses
        req.files.forEach(file => {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        });

        // 8. Kirim Respon Sukses ke Dashboard
        res.json({
          success: true,
          soal: teksSoal,
          jawaban: teksJawaban,
          historyId: this.lastID,
        });
      }
    );

  } catch (err) {
    console.error("AI Error:", err);
    res.status(500).json({ error: "Terjadi kesalahan pada sistem AI." });
  }
});

module.exports = router;
