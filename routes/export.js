const express = require("express");
const fs = require("fs");
const path = require("path");
const { Document, Packer, Paragraph, TextRun, PageBreak } = require("docx");
const db = require("../db");

const router = express.Router();
const uploadDir = path.join(__dirname, "../uploads");

// Pastikan folder uploads ada
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Route generate Word dari history
router.get("/:historyId", async (req, res) => {
  try {
    const id = parseInt(req.params.historyId);
    if(!id) return res.status(400).send("History ID tidak valid");

    // Ambil data history
    db.get("SELECT * FROM history WHERE id = ?", [id], async (err, row) => {
      if(err) return res.status(500).send("DB error");
      if(!row) return res.status(404).send("Data tidak ditemukan");

      const doc = new Document();

      // Halaman pertama = Soal
      const soalParagraphs = row.soal.split("\n").map(line => new Paragraph({ text: line }));
      doc.addSection({ children: soalParagraphs });

      // Halaman berikutnya = Jawaban
      const jawabanParagraphs = [new Paragraph({ children: [new PageBreak()] })].concat(
        row.jawaban.split("\n").map(line => new Paragraph({ text: line }))
      );
      doc.addSection({ children: jawabanParagraphs });

      // Buat nama file
      const fileName = `export-${Date.now()}.docx`;
      const filePath = path.join(uploadDir, fileName);

      // Generate Word
      const buffer = await Packer.toBuffer(doc);
      fs.writeFileSync(filePath, buffer);

      // Kirim nama file ke frontend agar tombol export bisa pakai
      res.json({ wordFile: fileName });
    });

  } catch(err){
    console.error("Word export error:", err);
    res.status(500).send("Gagal generate Word");
  }
});

module.exports = router;
