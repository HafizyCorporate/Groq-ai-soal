const express = require("express");
const fs = require("fs");
const path = require("path");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  ImageRun
} = require("docx");
const db = require("../db");

const router = express.Router();
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const logoPath = path.join(__dirname, "../public/logo.png");

router.get("/:historyId", async (req, res) => {
  try {
    const historyId = parseInt(req.params.historyId);
    if (!historyId) return res.status(400).send("History ID tidak valid");

    db.get("SELECT * FROM history WHERE id = ?", [historyId], async (err, row) => {
      if (err) return res.status(500).send("DB error");
      if (!row) return res.status(404).send("Data tidak ditemukan");

      const doc = new Document({
        creator: "AI Soal App",
        title: "Soal & Jawaban",
        sections: [{
          properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
          children: []
        }]
      });

      const paragraphs = [];

      // ---- Kop surat + logo ----
      if (fs.existsSync(logoPath)) {
        const logoImage = fs.readFileSync(logoPath);
        paragraphs.push(
          new Paragraph({
            children: [new ImageRun({ data: logoImage, transformation: { width: 80, height: 80 } })],
            alignment: AlignmentType.CENTER
          })
        );
      }

      paragraphs.push(
        new Paragraph({ children: [new TextRun({ text: "SEKOLAH ABC", bold: true, size: 28 })], alignment: AlignmentType.CENTER }),
        new Paragraph({ children: [new TextRun({ text: "Jl. Pendidikan No.123, Kota Contoh", italics: true, size: 20 })], alignment: AlignmentType.CENTER }),
        new Paragraph({ text: "" })
      );

      // ---- Soal ----
      if (row.soal) {
        paragraphs.push(new Paragraph({ text: "===SOAL===", heading: HeadingLevel.HEADING_2 }));

        // hapus duplikasi soal
        const uniqueSoal = Array.from(new Set(row.soal.split("\n").map(l => l.trim()).filter(l => l)));

        const pgLines = [];
        const essayLines = [];

        uniqueSoal.forEach(line => {
          if (/^\d+\)/.test(line)) essayLines.push(line);
          else pgLines.push(line);
        });

        // Pilihan Ganda
        if (pgLines.length) {
          paragraphs.push(new Paragraph({ text: "Pilihan Ganda:", bold: true }));

          let tempSoal = [];
          pgLines.forEach(line => {
            if (/^\d+\./.test(line)) {
              // jika sudah ada soal sebelumnya, beri spacing setelah D
              if (tempSoal.length) {
                paragraphs.push(...tempSoal);
                paragraphs.push(new Paragraph({ text: "", spacing: { after: 400 } })); // spasi antar soal
                tempSoal = [];
              }
              tempSoal.push(new Paragraph({
                children: [new TextRun({ text: line, font: "Times New Roman", size: 24 })],
                spacing: { after: 0 } // rapat ke pilihan
              }));
            } else {
              // pilihan A/B/C/D → rapat ke soal
              tempSoal.push(new Paragraph({
                children: [new TextRun({ text: line, font: "Times New Roman", size: 24 })],
                spacing: { after: 0 }
              }));
            }
          });
          if (tempSoal.length) paragraphs.push(...tempSoal); // soal terakhir
        }

        // Essay
        if (essayLines.length) {
          paragraphs.push(new Paragraph({ text: "Essay:", bold: true }));
          essayLines.forEach(line => paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text: line, font: "Times New Roman", size: 24 })],
              spacing: { after: 400 } // spasi antar essay soal
            })
          ));
        }
      }

      // ---- Jawaban ----
      if (row.jawaban) {
        paragraphs.push(new Paragraph({ text: "" }));
        paragraphs.push(new Paragraph({ text: "===JAWABAN===", heading: HeadingLevel.HEADING_2 }));

        const uniqueJawaban = Array.from(new Set(row.jawaban.split("\n").map(l => l.trim()).filter(l => l)));
        const pgJawaban = [];
        const essayJawaban = [];

        uniqueJawaban.forEach(line => {
          if (/^\d+\)/.test(line)) essayJawaban.push(line);
          else pgJawaban.push(line);
        });

        // Jawaban PG
        if (pgJawaban.length) {
          paragraphs.push(new Paragraph({ text: "Pilihan Ganda:", bold: true }));
          pgJawaban.forEach(line => paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text: line, font: "Times New Roman", size: 22 })],
              spacing: { after: 400 } // spasi antar jawaban PG
            })
          ));
        }

        // Jawaban Essay
        if (essayJawaban.length) {
          paragraphs.push(new Paragraph({ text: "Essay:", bold: true }));
          essayJawaban.forEach(line => paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text: line, font: "Times New Roman", size: 22 })],
              spacing: { after: 400 } // spasi antar jawaban essay
            })
          ));
        }
      }

      // ---- Add semua paragraf ke section tunggal ----
      doc.addSection({ children: paragraphs });

      const fileName = `export-${Date.now()}.docx`;
      const filePath = path.join(uploadDir, fileName);

      const buffer = await Packer.toBuffer(doc);
      fs.writeFileSync(filePath, buffer);

      res.json({ wordFile: `/uploads/${fileName}` });
    });

  } catch (err) {
    console.error("Word export error:", err);
    res.status(500).send("Gagal generate Word");
  }
});

module.exports = router;
