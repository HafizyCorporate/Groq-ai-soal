const express = require("express");
const axios = require("axios");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db");

const router = express.Router();

// Setup folder uploads
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const upload = multer({ dest: uploadDir });

// Route proses AI
router.post("/process", upload.single("foto"), async (req, res) => {
  try {
    // Pastikan user login
    if (!req.session.user) return res.status(401).json({ error: "Login dulu" });

    // Pastikan foto ada
    if (!req.file) return res.status(400).json({ error: "Foto wajib diupload" });

    const jumlahSoal = parseInt(req.body.jumlah) || 5;
    const jenisSoal = req.body.jenis || "Pilihan Ganda";

    // PROMPT BARU: Soal PG dulu, soal Essay setelah PG, jawaban di halaman terakhir
    const prompt = `
Buat persis ${jumlahSoal} soal ${jenisSoal} dari rangkuman foto.
- Semua soal Pilihan Ganda ditulis dulu secara berurutan.
- Setelah soal PG selesai, tulis soal Essay (jika ada).
- Jawaban Pilihan Ganda ditaruh di halaman terakhir.
- Jawaban Essay ditaruh setelah jawaban PG di halaman terakhir.
- Jangan sertakan jawaban di tengah soal.
- Format harus jelas agar bisa dipisahkan menjadi:
  ===SOAL=== (untuk dashboard / halaman Word awal)
  ===JAWABAN=== (untuk dashboard / halaman Word terakhir)
- Pastikan jumlah soal sesuai input: ${jumlahSoal}.
Format:
===SOAL===
===JAWABAN===
`;

    // Panggil Groq AI
    const ai = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }]
      },
      {
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }
      }
    );

    const hasil = ai.data.choices[0].message.content || "";

    // Pisahkan soal & jawaban
    const parts = hasil.split("===JAWABAN===");
    const soalText = parts[0].replace("===SOAL===","").trim();
    const jawabanText = parts[1]?.trim() || "";

    // Simpan ke history DB
    db.run(
      "INSERT INTO history (user_id, soal, jawaban) VALUES (?,?,?)",
      [req.session.user.id, soalText, jawabanText],
      function(err){
        if(err) console.error(err);

        // Simpan nama file Word sementara
        const wordFileName = `export-${Date.now()}.docx`;
        fs.writeFileSync(path.join(uploadDir, wordFileName), ""); // placeholder untuk Word export

        // Kirim hasil ke frontend
        res.json({ 
          soal: soalText, 
          jawaban: jawabanText, 
          wordFile: wordFileName,
          historyId: this.lastID
        });
      }
    );

  } catch (err) {
    console.error("AI ERROR:", err.response?.data || err);
    res.status(500).json({ error: "Gagal memproses AI" });
  }
});

module.exports = router;
