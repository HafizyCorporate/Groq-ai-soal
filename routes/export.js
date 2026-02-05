const express = require("express");
const fs = require("fs");
const path = require("path");
const { Document, Packer, Paragraph, TextRun, PageBreak } = require("docx");
const db = require("../db");

const router = express.Router();

const uploadDir = path.join(__dirname, "../uploads/");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Route export Word berdasarkan history id
router.get("/word/:historyId", async (req, res) => {
  const id = req.params.historyId;

  db.get("SELECT * FROM history WHERE id=?", [id], async (err, row) => {
    if (err || !row) return res.status(404).send("Data tidak ditemukan");

    try {
      const doc = new Document();

      // Pisah soal & jawaban
      const [soalPart, jawabanPart] = row.soal.split("===JAWABAN===");

      // Buat paragraf soal
      const soalParagraphs = soalPart
        .split("\n")
        .filter(l => l.trim())
        .map(l => new Paragraph({ children: [new TextRun(l)] }));

      // Buat paragraf jawaban
      const jawabanParagraphs = jawabanPart
        .split("\n")
        .filter(l => l.trim())
        .map(l => new Paragraph({ children: [new TextRun(l)] }));

      // Tambahkan section soal
      doc.addSection({ children: soalParagraphs });

      // Tambahkan section jawaban di halaman baru
      doc.addSection({
        properties: { page: { breakBefore: true } },
        children: [new Paragraph({ text: "Jawaban", spacing: { after: 200 } }), ...jawabanParagraphs]
      });

      // Generate buffer Word
      const buffer = await Packer.toBuffer(doc);

      // Nama file
      const wordFileName = `Soal-${row.id}.docx`;
      const wordPath = path.join(uploadDir, wordFileName);

      // Simpan file di uploads
      fs.writeFileSync(wordPath, buffer);

      // Kirim ke browser
      res.download(wordPath, wordFileName, err => {
        if (err) console.error(err);
      });
    } catch (e) {
      console.error("Export Word ERROR:", e);
      res.status(500).send("Gagal export Word");
    }
  });
});

module.exports = router;
