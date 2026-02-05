const express = require("express");
const axios = require("axios");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db");

const router = express.Router();

// Setup folder uploads jika belum ada
const uploadDir = path.join(__dirname, "../uploads/");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Konfigurasi Multer untuk menerima banyak file (maks 10)
const upload = multer({ dest: uploadDir });

router.post("/process", upload.array("foto", 10), async (req, res) => {
  try {
    // 1. Validasi Login & Input
    if (!req.session.user) {
      return res.status(401).json({ error: "Silakan login terlebih dahulu" });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "Harap unggah minimal satu foto atau media" });
    }

    const { jumlah, jenis } = req.body;

    // 2. Ambil gambar pertama dan konversi ke Base64 (Untuk Groq Vision)
    // Catatan: Model Vision saat ini memproses gambar utama yang dikirim
    const primaryImagePath = req.files[0].path;
    const base64Image = fs.readFileSync(primaryImagePath, { encoding: 'base64' });

    // 3. Prompt Instruksi (Rangkum & Buat Soal)
    const prompt = `
Anda adalah asisten pendidikan. Tugas Anda:
1. Bacalah gambar yang dilampirkan dan buatlah RANGKUMAN materinya.
2. Berdasarkan rangkuman tersebut, buatkan ${jumlah} soal dalam format ${jenis}.

ATURAN FORMAT:
- JANGAN menuliskan kata "===SOAL===" di awal jawaban.
- Pisahkan antara soal dan kunci jawaban HANYA dengan kata kunci ===JAWABAN=== di bagian paling bawah.

CONTOH OUTPUT:
[Rangkuman Materi...]
1. Apa itu fotosintesis?
...
===JAWABAN===
1. Jawaban A
`;

    // 4. Request ke Groq API menggunakan model Vision
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.2-11b-vision-preview", // WAJIB Vision agar bisa membaca gambar
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { 
                type: "image_url", 
                image_url: { url: `data:image/jpeg;base64,${base64Image}` } 
              }
            ]
          }
        ],
        temperature: 0.7
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    // 5. Parsing Hasil AI (Split Soal & Jawaban)
    const fullContent = response.data.choices[0].message.content;
    const parts = fullContent.split("===JAWABAN===");
    
    const teksSoal = parts[0] ? parts[0].trim() : "Gagal memproses soal.";
    const teksJawaban = parts[1] ? parts[1].trim() : "Kunci jawaban tidak tersedia.";

    // 6. Simpan ke Database (Kolom terpisah agar export tidak dobel)
    db.run(
      "INSERT INTO history (user_id, soal, jawaban) VALUES (?,?,?)",
      [req.session.user.id, teksSoal, teksJawaban],
      function(err) {
        if (err) {
          console.error("DB Error:", err.message);
          return res.status(500).json({ error: "Gagal menyimpan ke riwayat" });
        }

        // 7. Hapus file sementara dari server untuk menghemat memori
        req.files.forEach(file => {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        });

        // Kirim respon sukses ke frontend
        res.json({
          success: true,
          soal: teksSoal,
          jawaban: teksJawaban,
          historyId: this.lastID
        });
      }
    );

  } catch (err) {
    console.error("AI Error:", err.response?.data || err.message);
    res.status(500).json({ error: "Terjadi kesalahan pada proses AI" });
  }
});

module.exports = router;
