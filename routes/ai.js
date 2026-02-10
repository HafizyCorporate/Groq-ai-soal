const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const router = express.Router();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// UPDATE: Menggunakan model Gemini 3 Flash Preview untuk kecepatan maksimal
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" }); 

const uploadDir = path.join(__dirname, "../uploads/");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const upload = multer({ dest: uploadDir });

function fileToGenerativePart(path, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(path)).toString("base64"),
      mimeType,
    },
  };
}

router.post("/generate", upload.array("images[]", 10), async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ success: false, error: "Silakan login terlebih dahulu." });
    }

    const userId = req.session.user.id;

    const user = await new Promise((resolve) => {
      db.get("SELECT tokens, role FROM users WHERE id = ?", [userId], (err, row) => resolve(row));
    });

    if (!user || user.tokens <= 0) {
      if (req.files) {
        req.files.forEach(file => { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); });
      }
      return res.status(403).json({ 
        success: false, 
        error: "Token habis! Sisa token Anda: 0. Silakan hubungi admin untuk isi ulang." 
      });
    }

    const subject = req.body.subject || "Umum";
    const jumlahDiminta = req.body.count || 5;
    const level = req.body.level || "Umum"; 
    const type = req.body.type || "Pilihan Ganda"; 

    // --- UPDATE PROMPT: STRUKTUR SOAL LEBIH TEGAS & JELAS ---
    let prompt = `Anda adalah pakar pembuat soal ujian profesional. 
    Buatlah soal dengan detail sebagai berikut:
    - Mata Pelajaran: ${subject}
    - Jenjang Pendidikan: ${level}
    - Tipe Soal: ${type}
    - Jumlah Soal: TEPAT ${jumlahDiminta} butir.

    ATURAN KHUSUS STRUKTUR SOAL:
    1. FORMAT STIMULUS: Jika menggunakan gaya bercerita (storytelling), pisahkan cerita dengan pertanyaan. 
       - Tampilkan cerita/paragraf pengantar terlebih dahulu.
       - Berikan pertanyaan yang JELAS di baris baru setelah cerita selesai. 
       - JANGAN menaruh pertanyaan di tengah-tengah kalimat cerita atau menggantung di dalam cerita.
    2. GAYA BAHASA: Untuk jenjang SD, gunakan bahasa yang menarik dan akrab namun tetap formal dalam penulisan soal. Cukup 1-2 baris cerita.
    3. KOMPOSISI: 80% teks cerita/pernyataan, dan 20% berbasis gambar (instruksi: "Perhatikan gambar berikut!").
    4. REFERENSI GAMBAR: Di bagian paling bawah (setelah Kunci Jawaban), buat daftar "REFERENSI GAMBAR". Format: "Soal No X: [Link pencarian Google Images]".

    ATURAN PENULISAN UMUM:
    1. Gunakan Bahasa Indonesia yang sopan dan baku sesuai jenjang ${level}.
    2. Jika Tipe Soal adalah Pilihan Ganda:
       - SD/SMP: pilihan A, B, C, D.
       - SMA: pilihan A, B, C, D, E.
    3. Format Output: Gunakan HTML (<h3> untuk judul, <p> untuk soal, <ul><li> untuk pilihan).
    
    Wajib sertakan teks berikut di antara Soal dan Kunci Jawaban: ###BATAS_AKHIR_SOAL###
    Sertakan Kunci Jawaban dan Pembahasan singkat di bagian paling bawah.`;

    let parts = [prompt];

    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        parts.push(fileToGenerativePart(file.path, file.mimetype));
      });
      prompt += `\n\nAnalisis materi dari ${req.files.length} gambar yang dilampirkan untuk membuat soal tersebut.`;
      parts[0] = prompt;
    }

    const result = await model.generateContent(parts);
    const response = await result.response;
    const fullContent = response.text();

    let teksSoal = "";
    let teksJawaban = "";

    if (fullContent.includes("###BATAS_AKHIR_SOAL###")) {
        const splitParts = fullContent.split("###BATAS_AKHIR_SOAL###");
        teksSoal = splitParts[0].trim();
        teksJawaban = splitParts[1].trim(); 
    } else {
        teksSoal = fullContent;
        teksJawaban = "Kunci jawaban dan referensi gambar terlampir di dalam teks soal.";
    }

    db.run(
      "UPDATE users SET tokens = tokens - 1 WHERE id = ?", 
      [userId],
      function(errUpdate) {
        if (errUpdate) console.error("Gagal potong token:", errUpdate);

        db.run(
          "INSERT INTO history (user_id, soal, jawaban, subject, level, created_at) VALUES (?,?,?,?,?, CURRENT_TIMESTAMP)",
          [userId, teksSoal, teksJawaban, subject, level],
          function (err) {
            if (req.files) {
              req.files.forEach(file => { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); });
            }

            if (err) {
              return res.status(500).json({ success: false, error: "Gagal menyimpan riwayat soal." });
            }

            res.json({
              success: true,
              result: `
                <div class="soal-header mb-6">
                    <h3 class="text-xl font-bold text-blue-600">${type} - ${subject}</h3>
                    <p class="text-sm text-gray-500">Tingkat: ${level} | Sisa Token Anda: ${user.tokens - 1}</p>
                </div>
                ${teksSoal} 
                <br><hr class="my-6 border-dashed"><br> 
                <div class="bg-gray-50 p-4 rounded-xl">
                    <strong class="text-green-600">Kunci Jawaban, Pembahasan & Referensi Gambar:</strong><br> 
                    ${teksJawaban}
                </div>`,
              historyId: this.lastID,
            });
          }
        );
      }
    );

  } catch (err) {
    console.error("Gemini AI Error:", err);
    if (req.files) {
      req.files.forEach(file => { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); });
    }
    res.status(500).json({ success: false, error: "Terjadi kesalahan pada sistem AI kami." });
  }
});

// Route history tetap sama...
router.get("/history", (req, res) => {
  if (!req.session.user) return res.status(401).json({ success: false });
  const userId = req.session.user.id;
  db.all("SELECT id, soal, subject, level, created_at FROM history WHERE user_id = ? ORDER BY created_at DESC", [userId], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, rows });
  });
});

router.get("/history/:id", (req, res) => {
  if (!req.session.user) return res.status(401).json({ success: false });
  const historyId = req.params.id;
  const userId = req.session.user.id;
  db.get("SELECT * FROM history WHERE id = ? AND user_id = ?", [historyId, userId], (err, row) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    if (!row) return res.status(404).json({ success: false, error: "Data tidak ditemukan." });
    res.json({ success: true, row });
  });
});

module.exports = router;
