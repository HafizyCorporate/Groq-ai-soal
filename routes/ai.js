const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db"); // Pastikan path ke db.js benar
const { GoogleGenerativeAI } = require("@google/generative-ai");

const router = express.Router();

// 1. Inisialisasi Gemini 2.5 Flash
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Konfigurasi Penyimpanan Gambar Sementara
const uploadDir = path.join(__dirname, "../uploads/");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const upload = multer({ dest: uploadDir });

// Fungsi helper untuk mengubah file ke format yang dimengerti Gemini
function fileToGenerativePart(path, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(path)).toString("base64"),
      mimeType,
    },
  };
}

router.post("/process", upload.array("foto", 5), async (req, res) => {
  try {
    // 1. Validasi Sesi Login
    if (!req.session.user) {
      return res.status(401).json({ error: "Silakan login terlebih dahulu." });
    }

    const userId = req.session.user.id;
    const userRole = req.session.user.role; 

    // 2. Logika Limit Harian (Hanya untuk role 'user')
    if (userRole === 'user') {
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
          error: "Jatah harian habis. Silakan upgrade ke Premium!" 
        });
      }
    }

    // 3. Validasi Input Gambar
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "Mohon upload minimal 1 gambar materi." });
    }
    
    const jumlahDiminta = req.body.jumlah || 5;
    const jenisSoal = req.body.jenis || "PG";

    // 4. Siapkan Prompt dan Gambar untuk Gemini 2.5 Flash
    const prompt = `Kamu adalah AutoSoal AI buatan Te Az Ha. 
    Analisis materi dari gambar yang diberikan secara teliti.
    Buat TEPAT ${jumlahDiminta} soal dalam bentuk ${jenisSoal}.
    
    STRUKTUR OUTPUT WAJIB:
    1. Tulis daftar soal lengkap.
    2. Tulis pemisah ini: ###BATAS_AKHIR_SOAL###
    3. Tulis Kunci Jawaban di bawah pemisah tersebut.`;

    // Mengonversi file upload ke format part Gemini
    const imageParts = req.files.map(file => 
      fileToGenerativePart(file.path, file.mimetype)
    );

    // 5. Eksekusi Gemini 2.5 Flash
    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const fullContent = response.text();

    let teksSoal = "";
    let teksJawaban = "";

    // 6. Pemisahan Soal dan Jawaban
    if (fullContent.includes("###BATAS_AKHIR_SOAL###")) {
        const parts = fullContent.split("###BATAS_AKHIR_SOAL###");
        teksSoal = parts[0].trim();
        teksJawaban = parts[1].trim();
    } else {
        const fallbackParts = fullContent.split(/Kunci Jawaban:|Jawaban:/i);
        teksSoal = fallbackParts[0].trim();
        teksJawaban = fallbackParts[1] ? "Kunci Jawaban: " + fallbackParts[1].trim() : "Jawaban tersedia di dalam teks.";
    }

    // 7. Simpan ke Database History
    db.run(
      "INSERT INTO history (user_id, soal, jawaban, created_at) VALUES (?,?,?, CURRENT_TIMESTAMP)",
      [userId, teksSoal, teksJawaban],
      function (err) {
        // Hapus file sementara dari folder uploads agar hemat ruang
        req.files.forEach(file => {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        });

        if (err) {
          console.error(err);
          return res.status(500).json({ error: "Gagal menyimpan ke database." });
        }

        // 8. Respon Sukses
        res.json({
          success: true,
          soal: teksSoal,
          jawaban: teksJawaban,
          historyId: this.lastID,
        });
      }
    );

  } catch (err) {
    console.error("Gemini AI Error:", err);
    res.status(500).json({ error: "Terjadi kesalahan pada sistem Gemini 2.5 Flash." });
  }
});

module.exports = router;
