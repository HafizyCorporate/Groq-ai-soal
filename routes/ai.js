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

router.post("/process", upload.array("foto"), async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).json({ error: "Login dulu" });
    if (!req.files || req.files.length === 0)
      return res.status(400).json({ error: "Foto wajib diupload" });

    const jumlahSoal = req.body.jumlah || 10;
    const jenisSoal = req.body.jenis || "Pilihan Ganda";

    const fotoListText = req.files.map((f, idx) => `Foto ${idx+1}: ${f.path}`).join("\n");

    const prompt = `
Buat persis ${jumlahSoal} soal ${jenisSoal} dari semua foto berikut:
${fotoListText}

Aturan:
- PG jangan sertakan jawaban di tengah
- Essay tulis nomor urut
- Jawaban PG dan Essay ditulis di akhir halaman
- Spasi antar soal rapat ke pilihan, beri jarak setelah pilihan terakhir ke soal berikutnya
Format:
Soal dan Jawaban bersih, jangan sertakan ===SOAL=== atau ===JAWABAN===
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

    let hasil = aiResponse.data.choices[0].message.content || "";

    // hapus tag jika ada
    hasil = hasil.replace(/===SOAL===/g,"").replace(/===JAWABAN===/g,"").trim();

    // Simpan ke DB history
    db.run(
      "INSERT INTO history (user_id, soal, jawaban) VALUES (?,?,?)",
      [req.session.user.id, hasil, hasil],
      err => { if(err) console.error(err); }
    );

    const wordFileName = `export-${Date.now()}.docx`;
    const wordFilePath = path.join(uploadDir, wordFileName);
    fs.writeFileSync(wordFilePath, ""); // placeholder, nanti export.js buat Word

    res.json({ hasil, wordFile: `/uploads/${wordFileName}` });

  } catch(err) {
    console.error(err);
    res.status(500).json({ error: "Gagal memproses AI" });
  }
});

module.exports = router;
