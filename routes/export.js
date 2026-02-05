const express = require("express");
const fs = require("fs");
const path = require("path");
const { Document, Packer, Paragraph, TextRun } = require("docx");
const db = require("../db");

const router = express.Router();

router.get("/word/:historyId", async (req, res) => {
  const id = req.params.historyId;
  db.get("SELECT * FROM history WHERE id=?", [id], async (err, row) => {
    if(err || !row) return res.status(404).send("Data tidak ditemukan");

    const doc = new Document();

    // Pisah soal & jawaban
    const [soalPart, jawabanPart] = row.soal.split("===JAWABAN===");
    const soalParagraphs = soalPart.split("\n").filter(l=>l.trim()).map(l => new Paragraph({ children:[new TextRun(l)] }));
    const jawabanParagraphs = jawabanPart.split("\n").filter(l=>l.trim()).map(l => new Paragraph({ children:[new TextRun(l)] }));

    doc.addSection({ children: soalParagraphs });
    doc.addSection({ children: [new Paragraph({ text:"", pageBreakBefore:true }), ...jawabanParagraphs] });

    const buffer = await Packer.toBuffer(doc);
    const wordPath = path.join(__dirname, "../uploads", `export-${row.id}.docx`);
    fs.writeFileSync(wordPath, buffer);

    res.download(wordPath, `Soal-${row.id}.docx`, err=>{
      if(err) console.error(err);
    });
  });
});

module.exports = router;
