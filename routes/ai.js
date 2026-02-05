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
    // Pastikan user login
    if (!req.session.user) return res.status(401).json({ error: "Login dulu" });
    // Pastikan foto ada
    if (!req.file) return res.status(400).json({ error: "Foto wajib diupload" });

    const jumlahSoal = parseInt(req.body.jumlah) || 5;
    const jenisSoal = req.body.jenis || "Pilihan Ganda";

    // PROMPT BARU: Memastikan jumlah soal sesuai input
    const prompt = `
Buat persis ${jumlahSoal} soal ${jenisSoal} dari rangkuman foto.
- Jika Pilihan Ganda, buat nomor, opsi A-D, jangan sertakan jawaban di tengah.
- Jika Essay, buat nomor urut.
- Jawaban Pilihan Ganda ditulis di bagian akhir semua soal.
- Jawaban Essay ditulis setelah jawaban PG.
- Pastikan jumlah soal tepat: ${jumlahSoal}.
Format:
===SOAL===
===JAWABAN===
`;

    // Panggil Groq AI
    const ai = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant", // model aktif & cepat
        messages: [{ role: "user", content: prompt }]
      },
      {
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }
      }
    );

    const hasil = ai.data.choices[0].message.content || "";

    // Pisahkan soal & jawaban agar tidak tercampur
    const parts = hasil.split("===JAWABAN===");
    const soalText = parts[0].replace("===SOAL===","").trim();
    const jawabanText = parts[1]?.trim() || "";

    // Simpan ke history DB
    db.run(
      "INSERT INTO history (user_id, soal, jawaban) VALUES (?,?,?)",
      [req.session.user.id, soalText, jawabanText],
      function(err){
        if(err) console.error(err);
        // Kirim hasil + historyId untuk Word export
        res.json({ 
          soal: soalText, 
          jawaban: jawabanText, 
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
