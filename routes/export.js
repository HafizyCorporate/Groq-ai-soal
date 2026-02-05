const express = require("express");
const fs = require("fs");
const path = require("path");
const { Document, Packer, Paragraph, TextRun } = require("docx");
const db = require("../db");

const router = express.Router();

// Export Word berdasarkan historyId
router.get("/word/:id", async (req, res) => {
  const historyId = req.params.id;

  db.get("SELECT soal, jawaban FROM history WHERE id = ?", [historyId], async (err, row) => {
    if(err){
      console.error(err);
      return res.status(500).send("Gagal mengambil history");
    }
    if(!row){
      return res.status(404).send("History tidak ditemukan");
    }

    // Bagi soal & jawaban
    const [soalText, jawabanText] = [row.soal, row.jawaban];

    // Bikin dokumen Word
    const doc = new Document();

    // Tambahkan semua soal
    const soalParagraphs = soalText.split("\n").map(line => 
      new Paragraph({ children:[ new TextRun(line) ] })
    );
    doc.addSection({ children: soalParagraphs });

    // Tambahkan jarak sebelum jawaban
    doc.addSection({ children: [new Paragraph("")] });

    // Tambahkan jawaban
    const jawabanParagraphs = jawabanText.split("\n").map(line =>
      new Paragraph({ children:[ new TextRun(line) ] })
    );
    doc.addSection({ children: jawabanParagraphs });

    const packer = new Packer();
    const buffer = await packer.toBuffer(doc);

    // Nama file Word
    const fileName = `export-${historyId}.docx`;
    const filePath = path.join(__dirname, "../uploads/", fileName);

    fs.writeFileSync(filePath, buffer);

    res.download(filePath, fileName, err => {
      if(err) console.error(err);
      // Opsi: hapus file sementara setelah download
      // fs.unlinkSync(filePath);
    });
  });
});

module.exports = router;
