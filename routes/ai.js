const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();
const upload = multer({ dest: path.join(__dirname, "../uploads/") });

// POST /ai/generate
router.post("/generate", upload.array("photos"), async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) return res.status(400).json({ error: "Tidak ada foto diupload" });

    // Dummy AI generate soal dari foto
    let soal = "";
    files.forEach((file, idx) => {
      soal += `${idx+1}) Apa objek pada Foto ${idx+1}?\nA. Opsi 1\nB. Opsi 2\nC. Opsi 3\nD. Opsi 4\n\n`;
    });
    soal += "Jawaban:\n1) A\n2) B\n3) C\n"; // contoh jawaban

    const filename = `soal-${Date.now()}.txt`;
    fs.writeFileSync(path.join(__dirname, "../uploads", filename), soal);

    res.json({ filename });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal generate soal" });
  }
});

module.exports = router;
