const express = require("express");
const axios = require("axios");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db");

const router = express.Router();

const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Mulai multer untuk multiple files
const upload = multer({ dest: uploadDir });

// Route proses AI
router.post("/process", upload.array("foto"), async (req, res) => {
  try {
    // Pastikan user login
    if (!req.session.user) return res.status(401).json({ error: "Login dulu" });

    // Pastikan ada file
    if (!req.files || req.files.length === 0)
      return res.status(400).json({ error: "Foto wajib diupload" });

    const jumlahSoal = req.body.jumlah || 10;
    const jenisSoal = req.body.jenis || "Pilihan Ganda";

    // Ambil semua path foto
    const fotoPaths = req.files.map(f => f.path);

    // Gabungkan semua nama file atau path jadi referensi prompt
    const fotoListText = fotoPaths.map((f, idx) => `Foto ${idx+1}: ${f}`).join("\n");

    // Prompt ke Groq AI
    const prompt = `
Buat persis ${jumlahSoal} soal ${jenisSoal} dari rangkuman semua foto yang diupload:
${fotoListText}

Aturan:
- Soal PG jangan sertakan jawaban di tengah
- Essay tulis nomor urut
- Jawaban PG dan Essay ditulis di akhir halaman
- Spasi antar soal: rapat ke pilihan, beri jarak setelah pilihan terakhir ke soal berikutnya
Format:
===SOAL===
===JAWABAN===
`;

    const aiResponse = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const hasil = aiResponse.data.choices[0].message.content;

    // Simpan ke DB history
    db.run(
      "INSERT INTO history (user_id, soal, jawaban) VALUES (?,?,?)",
      [req.session.user.id, hasil, hasil],
      function(err){
        if(err) console.error(err);
      }
    );

    // Buat placeholder Word file nama
    const wordFileName = `export-${Date.now()}.docx`;
    const wordFilePath = path.join(uploadDir, wordFileName);
    fs.writeFileSync(wordFilePath, ""); // nanti Word generator dipisah

    // Kirim hasil ke frontend
    res.json({ hasil, wordFile: `/uploads/${wordFileName}` });

  } catch(err){
    console.error("AI ERROR:", err.response?.data || err);
    res.status(500).json({ error: "Gagal memproses AI" });
  }
});

module.exports = router;
