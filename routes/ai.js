const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db"); // Memastikan path ke db.js benar
const { GoogleGenerativeAI } = require("@google/generative-ai");

const router = express.Router();

// 1. Inisialisasi Gemini (Gunakan model flash terbaru yang tersedia)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Konfigurasi Penyimpanan Gambar Sementara
const uploadDir = path.join(__dirname, "../uploads/");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const upload = multer({ dest: uploadDir });

// Helper format gambar untuk Gemini
function fileToGenerativePart(path, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(path)).toString("base64"),
      mimeType,
    },
  };
}

// Rute utama /ai/generate
router.post("/generate", upload.single("image"), async (req, res) => {
  try {
    // 1. Validasi Sesi Login
    if (!req.session.user) {
      return res.status(401).json({ success: false, error: "Silakan login terlebih dahulu." });
    }

    const userId = req.session.user.id;
    const userRole = req.session.user.role; 

    // 2. Logika Limit Harian (Tetap dipertahankan sesuai kode lama Anda)
    if (userRole === 'user') {
      const today = new Date().toISOString().split('T')[0];
      const checkLimit = await new Promise((resolve) => {
        db.get(
          "SELECT COUNT(*) as total FROM history WHERE user_id = ? AND date(created_at) = ?", 
          [userId, today], 
          (err, row) => resolve(row ? row.total : 0)
        );
      });

      if (checkLimit >= 5) {
        return res.status(403).json({ 
          success: false,
          error: "Jatah harian Anda telah habis (Maks. 5 kali). Silakan upgrade ke Premium untuk akses tak terbatas!" 
        });
      }
    }

    // 3. Ambil Input Baru dari Dashboard
    const subject = req.body.subject || "Umum";
    const jumlahDiminta = req.body.count || 5;
    const level = req.body.level || "Umum"; // SD/SMP/SMA
    const type = req.body.type || "Pilihan Ganda"; // PG/Essay

    // 4. Siapkan Prompt yang Sopan & Profesional
    let prompt = `Anda adalah pakar pembuat soal ujian profesional. 
    Buatlah soal dengan detail sebagai berikut:
    - Mata Pelajaran: ${subject}
    - Jenjang Pendidikan: ${level}
    - Tipe Soal: ${type}
    - Jumlah Soal: TEPAT ${jumlahDiminta} butir.

    ATURAN PENULISAN:
    1. Gunakan Bahasa Indonesia yang sopan, baku, dan sesuai jenjang ${level}.
    2. Jika Tipe Soal adalah Pilihan Ganda:
       - Untuk SD/SMP: berikan pilihan A, B, C, D.
       - Untuk SMA: berikan pilihan A, B, C, D, E.
    3. Jika Tipe Soal adalah Essay: Buatlah pertanyaan yang membutuhkan jawaban uraian mendalam.
    4. Format Output: Gunakan HTML (<h3> untuk judul, <p> untuk soal, <ul><li> untuk pilihan).
    
    Wajib sertakan teks berikut di antara Soal dan Kunci Jawaban: ###BATAS_AKHIR_SOAL###
    Sertakan Kunci Jawaban dan Pembahasan singkat di bagian paling bawah.`;

    let parts = [prompt];

    // Jika ada file gambar (OCR mode)
    if (req.file) {
      const imagePart = fileToGenerativePart(req.file.path, req.file.mimetype);
      parts.push(imagePart);
      prompt += `\n\nAnalisis materi dari gambar yang dilampirkan untuk membuat soal tersebut.`;
    }

    // 5. Eksekusi Gemini
    const result = await model.generateContent(parts);
    const response = await result.response;
    const fullContent = response.text();

    let teksSoal = "";
    let teksJawaban = "";

    // 6. Pemisahan Soal dan Jawaban
    if (fullContent.includes("###BATAS_AKHIR_SOAL###")) {
        const splitParts = fullContent.split("###BATAS_AKHIR_SOAL###");
        teksSoal = splitParts[0].trim();
        teksJawaban = splitParts[1].trim();
    } else {
        teksSoal = fullContent;
        teksJawaban = "Kunci jawaban terlampir di dalam teks soal.";
    }

    // 7. Simpan ke Database
    db.run(
      "INSERT INTO history (user_id, soal, jawaban, created_at) VALUES (?,?,?, CURRENT_TIMESTAMP)",
      [userId, teksSoal, teksJawaban],
      function (err) {
        // Hapus file fisik segera setelah diproses
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        if (err) {
          console.error(err);
          return res.status(500).json({ success: false, error: "Gagal menyimpan riwayat soal ke database." });
        }

        // 8. Respon Sukses
        // Mengirimkan hasil yang rapi untuk ditampilkan di 'outputContent' dashboard
        res.json({
          success: true,
          result: `
            <div class="soal-header mb-6">
                <h3 class="text-xl font-bold text-blue-600">${type} - ${subject}</h3>
                <p class="text-sm text-gray-500">Tingkat: ${level} | Jumlah: ${jumlahDiminta} Soal</p>
            </div>
            ${teksSoal} 
            <br><hr class="my-6 border-dashed"><br> 
            <div class="bg-gray-50 p-4 rounded-xl">
                <strong class="text-green-600">Kunci Jawaban & Pembahasan:</strong><br> 
                ${teksJawaban}
            </div>`,
          historyId: this.lastID,
        });
      }
    );

  } catch (err) {
    console.error("Gemini AI Error:", err);
    // Hapus file jika terjadi error agar tidak menumpuk
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, error: "Terjadi kesalahan pada sistem AI kami. Mohon coba lagi." });
  }
});

// --- TAMBAHAN FITUR HISTORY PER AKUN ---

// 1. Ambil List History (Hanya milik user yang login)
router.get("/history", (req, res) => {
  if (!req.session.user) return res.status(401).json({ success: false });

  const userId = req.session.user.id;
  db.all(
    "SELECT id, soal, created_at FROM history WHERE user_id = ? ORDER BY created_at DESC",
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, rows });
    }
  );
});

// 2. Ambil Detail History Berdasarkan ID (Hanya jika milik user yang login)
router.get("/history/:id", (req, res) => {
  if (!req.session.user) return res.status(401).json({ success: false });

  const historyId = req.params.id;
  const userId = req.session.user.id;

  db.get(
    "SELECT * FROM history WHERE id = ? AND user_id = ?",
    [historyId, userId],
    (err, row) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      if (!row) return res.status(404).json({ success: false, error: "Data tidak ditemukan." });
      res.json({ success: true, row });
    }
  );
});

module.exports = router;
