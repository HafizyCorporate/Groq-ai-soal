const express = require("express");
const fs = require("fs");
const path = require("path");
const { Document, Packer, Paragraph } = require("docx");
const db = require("../db");

const router = express.Router();
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Export Word
router.get("/:historyId", async (req, res) => {
  try {
    const historyId = parseInt(req.params.historyId);
    if (!historyId) return res.status(400).send("History ID tidak valid");

    db.get("SELECT * FROM history WHERE id = ?", [historyId], async (err, row) => {
      if(err) return res.status(500).send("DB error");
      if(!row) return res.status(404).send("Data tidak ditemukan");

      const doc = new Document({
        creator: "AI Soal App",
        title: "Soal & Jawaban",
        sections: [{ children: [] }] // wajib ada
      });

      // Soal + jawaban di satu halaman
      const paragraphs = [];

      if(row.soal){
        paragraphs.push(new Paragraph({ text: "===SOAL===" }));
        row.soal.split("\n").forEach(line => {
          paragraphs.push(new Paragraph({ text: line }));
        });
      }

      if(row.jawaban){
        paragraphs.push(new Paragraph({ text: "===JAWABAN===" }));
        row.jawaban.split("\n").forEach(line => {
          paragraphs.push(new Paragraph({ text: line }));
        });
      }

      doc.addSection({ children: paragraphs });

      const fileName = `export-${Date.now()}.docx`;
      const filePath = path.join(uploadDir, fileName);

      const buffer = await Packer.toBuffer(doc);
      fs.writeFileSync(filePath, buffer);

      res.json({ wordFile: `/uploads/${fileName}` });
    });

  } catch(err){
    console.error("Word export error:", err);
    res.status(500).send("Gagal generate Word");
  }
});

module.exports = router;
