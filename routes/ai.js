const express = require("express");
const axios = require("axios");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db");

const router = express.Router();

const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const upload = multer({ dest: uploadDir });

router.post("/process", upload.single("foto"), async (req, res) => {
  try {
    if(!req.session.user) return res.status(401).json({ error:"Login dulu" });
    if(!req.file) return res.status(400).json({ error:"Foto wajib diupload" });

    const jumlahSoal = req.body.jumlah || 5;
    const jenisSoal = req.body.jenis || "Pilihan Ganda";

    const prompt = `
Buat persis ${jumlahSoal} soal ${jenisSoal} dari rangkuman foto.
- Jangan sertakan jawaban ditengah soal.
- Jawaban Pilihan Ganda ditulis di halaman terakhir setelah semua soal PG.
- Jawaban Essay ditulis setelah jawaban PG di halaman terakhir.
Format:
===SOAL===
===JAWABAN===
`;

    const ai = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      { model:"llama-3.1-8b-instant", messages:[{ role:"user", content:prompt }] },
      { headers:{ Authorization:`Bearer ${process.env.GROQ_API_KEY}`, "Content-Type":"application/json" } }
    );

    const hasil = ai.data.choices[0].message.content;

    db.run(
      "INSERT INTO history (user_id, soal, jawaban) VALUES (?,?,?)",
      [req.session.user.id, hasil, hasil],
      function(err){
        if(err){
          console.error(err);
          return res.status(500).json({ error:"Gagal simpan history" });
        }
        res.json({ hasil, historyId: this.lastID });
      }
    );

  } catch(err){
    console.error("AI ERROR:", err.response?.data || err);
    res.status(500).json({ error:"Gagal memproses AI" });
  }
});

module.exports = router;
