const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db"); // Memastikan path ke db.js benar
const { GoogleGenerativeAI } = require("@google/generative-ai");

const router = express.Router();

// 1. Inisialisasi Gemini 2.5 Flash
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Konfigurasi Penyimpanan Gambar Sementara
const uploadDir = path.join(__dirname, "../uploads/");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Multer mendukung input "image" (dari dashboard) atau "foto" (multi-upload)
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

// Rute utama /ai/generate sesuai dengan fetch di dashboard.html
router.post("/generate", upload.single("image"), async (req, res) => {
  try {
    // 1. Validasi Sesi Login
    if (!req.session.user) {
      return res.status(401).json({ success: false, error: "Silakan login terlebih dahulu." });
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

      // Limit 5 soal per hari untuk user gratis (bisa kamu sesuaikan)
      if (checkLimit >= 5) {
        return res.status(403).json({ 
          success: false,
          error: "Jatah harian habis. Silakan upgrade ke Premium!" 
        });
      }
    }

    // 3. Ambil Input dari Dashboard
    const subject = req.body.subject || "Umum";
    const jumlahDiminta = req.body.count || 5;

    // 4. Siapkan Prompt untuk Gemini 2.5 Flash
    let prompt = `Kamu adalah AutoSoal AI. 
    Buatlah TEPAT ${jumlahDiminta} soal pilihan ganda tentang ${subject}.
    Jika ada gambar yang dilampirkan, analisis materi dari gambar tersebut untuk membuat soal.
    
    STRUKTUR OUTPUT WAJIB (FORMAT HTML):
    Tuliskan soal dengan tag <p> dan pilihan ganda dengan list <ul><li>.
    Berikan kunci jawaban di bagian paling bawah setelah teks: ###BATAS_AKHIR_SOAL###`;

    let parts = [prompt];

    // Jika ada file gambar (dari Kamera atau Upload)
    if (req.file) {
      const imagePart = fileToGenerativePart(req.file.path, req.file.mimetype);
      parts.push(imagePart);
    }

    // 5. Eksekusi Gemini 2.5 Flash
    const result = await model.generateContent(parts);
    const response = await result.response;
    const fullContent = response.text();

    let teksSoal = "";
    let teksJawaban = "";

    // 6. Pemisahan Soal dan Jawaban untuk disimpan ke DB
    if (fullContent.includes("###BATAS_AKHIR_SOAL###")) {
        const splitParts = fullContent.split("###BATAS_AKHIR_SOAL###");
        teksSoal = splitParts[0].trim();
        teksJawaban = splitParts[1].trim();
    } else {
        teksSoal = fullContent;
        teksJawaban = "Kunci jawaban disertakan dalam teks.";
    }

    // 7. Simpan ke Database History agar user bisa melihat riwayatnya nanti
    db.run(
      "INSERT INTO history (user_id, soal, jawaban, created_at) VALUES (?,?,?, CURRENT_TIMESTAMP)",
      [userId, teksSoal, teksJawaban],
      function (err) {
        // Hapus file fisik dari folder uploads agar hemat ruang
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        if (err) {
          console.error(err);
          return res.status(500).json({ success: false, error: "Gagal menyimpan ke database." });
        }

        // 8. Respon Sukses (Mengirimkan hasil gabungan untuk ditampilkan di dashboard)
        res.json({
          success: true,
          result: `${teksSoal} <br><hr><br> <strong>Kunci Jawaban:</strong> <br> ${teksJawaban}`,
          historyId: this.lastID,
        });
      }
    );

  } catch (err) {
    console.error("Gemini AI Error:", err);
    res.status(500).json({ success: false, error: "Terjadi kesalahan pada sistem Gemini AI." });
  }
});

module.exports = router;
