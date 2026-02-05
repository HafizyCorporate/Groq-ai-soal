const express = require("express");
const fs = require("fs");
const path = require("path");
const { Document, Packer, Paragraph, TextRun, PageBreak } = require("docx");
const db = require("../db");

const router = express.Router();
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

router.get("/word/:id", async (req, res) => {
  const historyId = req.params.id;

  db.get("SELECT soal, jawaban FROM history WHERE id = ?", [historyId], async (err, row) => {
    if(err){ console.error(err); return res.status(500).send("Gagal ambil history"); }
    if(!row) return res.status(404).send("History tidak ditemukan");

    try {
      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({ text: "SOAL", bold:true }),
            ...row.soal.split("\n").map(line => new Paragraph({ children:[ new TextRun(line) ] })),
            new Paragraph({ text:"", pageBreakBefore:true }),
            new Paragraph({ text: "JAWABAN", bold:true }),
            ...row.jawaban.split("\n").map(line => new Paragraph({ children:[ new TextRun(line) ] }))
          ]
        }]
      });

      const buffer = await Packer.toBuffer(doc);
      const fileName = `export-${historyId}.docx`;
      const filePath = path.join(uploadDir, fileName);
      fs.writeFileSync(filePath, buffer);

      res.download(filePath, fileName, err => { if(err) console.error(err); });

    } catch(e) {
      console.error("Gagal generate Word:", e);
      res.status(500).send("Gagal generate Word");
    }
  });
});

module.exports = router;
