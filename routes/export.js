const express = require("express");
const fs = require("fs");
const path = require("path");
const { Document, Packer, Paragraph, TextRun } = require("docx");
const db = require("../db");
const router = express.Router();

router.get("/:historyId", async (req, res) => {
  db.get("SELECT * FROM history WHERE id = ?", [req.params.historyId], async (err, row) => {
    if (!row) return res.status(404).send("Data tidak ditemukan");

    const children = [];
    
    // Judul Soal
    children.push(new Paragraph({ children: [new TextRun({ text: "DAFTAR SOAL", bold: true, size: 28 })] }));
    row.soal.split("\n").forEach(line => children.push(new Paragraph({ text: line })));

    // Jarak
    children.push(new Paragraph({ text: "" }));

    // Judul Jawaban
    children.push(new Paragraph({ children: [new TextRun({ text: "KUNCI JAWABAN", bold: true, size: 28 })] }));
    row.jawaban.split("\n").forEach(line => children.push(new Paragraph({ text: line })));

    const doc = new Document({ sections: [{ children }] });
    const fileName = `Export-${Date.now()}.docx`;
    const filePath = path.join(__dirname, "../uploads", fileName);

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(filePath, buffer);
    res.json({ wordFile: `/uploads/${fileName}` });
  });
});

module.exports = router;
