const express = require("express");
const fs = require("fs");
const path = require("path");
const { Document, Packer, Paragraph, TextRun } = require("docx");
const db = require("../db");
const router = express.Router();

router.get("/:historyId", async (req, res) => {
  const historyId = req.params.historyId;

  db.get("SELECT * FROM history WHERE id = ?", [historyId], async (err, row) => {
    if(!row) return res.status(404).send("Data tidak ditemukan");

    const children = [];

    // Bagian Soal
    children.push(new Paragraph({ 
      children: [new TextRun({ text: "DAFTAR SOAL", bold: true, size: 28 })] 
    }));
    
    row.soal.split("\n").forEach(line => {
      children.push(new Paragraph({ text: line }));
    });

    // Jarak antar Soal dan Jawaban
    children.push(new Paragraph({ text: "" }));
    children.push(new Paragraph({ text: "" }));

    // Bagian Jawaban
    children.push(new Paragraph({ 
      children: [new TextRun({ text: "KUNCI JAWABAN", bold: true, size: 28 })] 
    }));

    row.jawaban.split("\n").forEach(line => {
      children.push(new Paragraph({ text: line }));
    });

    const doc = new Document({
      sections: [{ children: children }]
    });

    const fileName = `Export-${Date.now()}.docx`;
    const filePath = path.join(__dirname, "../uploads", fileName);

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(filePath, buffer);

    res.json({ wordFile: `/uploads/${fileName}` });
  });
});

module.exports = router;
