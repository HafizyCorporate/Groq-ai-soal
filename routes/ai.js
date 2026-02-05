const express = require("express");
const axios = require("axios");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db");

const router = express.Router();

// Setup multer untuk uploads
const uploadDir = path.join(__dirname, "../uploads/");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const upload = multer({ dest: uploadDir });

// Route proses AI
router.post("/process", upload.single("foto"), async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).json({ error: "Login dulu" });
    if (!req.file) return res.status(400).json({ error: "Foto wajib diupload" });

    const jumlahSoal = req.body.jumlah;
    const jenisSoal = req.body.jenis;

    const prompt = `
Buat persis ${jumlahSoal} soal ${jenisSoal} dari rangkuman foto.
- Jawaban pilihan ganda ditulis di akhir halaman
- Jawaban essay ditulis setelah jawaban PG di halaman akhir
Format:
===SOAL===
===JAWABAN===
`;

    const ai = await axios.post(
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

    const hasil = ai.data.choices[0].message.content;

    // Simpan ke history DB
    db.run(
      "INSERT INTO history (user_id, soal, jawaban) VALUES (?,?,?)",
      [req.session.user.id, hasil, hasil],
      function(err) {
        if(err){
          console.error(err);
        }
        // Kirim hasil ke frontend beserta historyId
        res.json({ 
          hasil, 
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
