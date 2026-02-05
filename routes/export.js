const express = require("express");
const fs = require("fs");
const path = require("path");
const { Document, Packer, Paragraph, PageBreak } = require("docx");
const db = require("../db");

const router = express.Router();
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

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
      });

      // Halaman pertama = Soal
      const soalParagraphs = (row.soal||"").split("\n").map(l => new Paragraph({ text:l }));
      doc.addSection({ children: soalParagraphs });

      // Halaman terakhir = Jawaban
      const jawabanParagraphs = [new Paragraph({ children:[new PageBreak()] })]
        .concat((row.jawaban||"").split("\n").map(l => new Paragraph({ text:l })));
      doc.addSection({ children: jawabanParagraphs });

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
