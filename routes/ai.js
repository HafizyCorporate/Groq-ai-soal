const express = require("express");
const axios = require("axios");
const multer = require("multer");
const path = require("path");
const db = require("../db");
const router = express.Router();

const upload = multer({ dest: path.join(__dirname, "../uploads/") });

router.post("/process", upload.array("foto", 10), async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).json({ error: "Login dulu" });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: "Foto wajib diupload" });

    const { jumlah, jenis } = req.body;

    // Prompt diperketat agar tidak ada kata "===SOAL===" di awal
    const prompt = `
Tolong rangkum materi dari gambar yang saya kirim dan buatkan ${jumlah} soal ${jenis}.
Gunakan format pemisah yang ketat seperti di bawah ini:

[Isi Soal Disini]

===JAWABAN===

[Isi Jawaban Disini]

Catatan: Jangan tambahkan teks apa pun sebelum soal atau setelah jawaban.
`;

    const response = await axios.post(
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

    const fullText = response.data.choices[0].message.content;
    const parts = fullText.split("===JAWABAN===");
    
    const soalFix = parts[0].trim();
    const jawabanFix = parts[1] ? parts[1].trim() : "";

    db.run(
      "INSERT INTO history (user_id, soal, jawaban) VALUES (?,?,?)",
      [req.session.user.id, soalFix, jawabanFix],
      function(err) {
        if(err) return res.status(500).json({ error: "DB Error" });
        res.json({ 
          success: true,
          soal: soalFix, 
          jawaban: jawabanFix,
          historyId: this.lastID 
        });
      }
    );

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal memproses AI" });
  }
});

module.exports = router;
