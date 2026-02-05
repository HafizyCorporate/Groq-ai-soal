const express = require("express");
const axios = require("axios");
const multer = require("multer");
const path = require("path");
const db = require("../db");
const fs = require("fs");

const router = express.Router();

// Setup multer untuk uploads
const upload = multer({ dest: path.join(__dirname, "../uploads/") });

// Route proses AI
router.post("/process", upload.single("foto"), async (req, res) => {
  try {
    // Cek session
    if (!req.session.user) return res.status(401).json({ error: "Login dulu" });

    // Pastikan file ada
    if (!req.file) return res.status(400).json({ error: "Foto wajib diupload" });

    // Prompt untuk AI
    const prompt = `
Buat ${req.body.jumlah} soal ${req.body.jenis} dari rangkuman foto.
Format:
===SOAL===
===JAWABAN===
`;

    // Panggil Groq AI (model aktif)
    const ai = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-7b",  // **ganti model lama dengan yang aktif**
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
      }
    );

    // Simpan nama file Word sementara untuk export
    const wordFileName = `export-${Date.now()}.docx`;
    fs.writeFileSync(path.join(__dirname, "../uploads", wordFileName), ""); // dummy, nanti backend export Word ganti

    // Kirim hasil ke frontend
    res.json({ hasil, wordFile: wordFileName });
  } catch (err) {
    console.error("AI ERROR:", err.response?.data || err);
    res.status(500).json({ error: "Gagal memproses AI" });
  }
});

module.exports = router;
