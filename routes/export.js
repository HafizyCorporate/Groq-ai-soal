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

        const soalLines = Array.from(new Set(row.soal.split("\n"))); // hapus duplikasi
        const pgLines = [];
        const essayLines = [];

        soalLines.forEach(line => {
          const trimmed = line.trim();
          if (!trimmed) return;
          if (/^\d+\)/.test(trimmed)) essayLines.push(trimmed);
          else pgLines.push(trimmed);
        });

        // Pilihan Ganda
        if (pgLines.length) {
          paragraphs.push(new Paragraph({ text: "Pilihan Ganda:", bold: true }));
          let currentSoal = null;
          pgLines.forEach(line => {
            if (/^\d+\./.test(line)) {
              // Baris soal → beri spacing 400 (renggang ke soal berikutnya)
              currentSoal = new Paragraph({
                children: [new TextRun({ text: line, font: "Times New Roman", size: 24 })],
                spacing: { after: 400 }
              });
              paragraphs.push(currentSoal);
            } else {
              // Baris pilihan A/B/C/D → rapat ke soal
              paragraphs.push(new Paragraph({
                children: [new TextRun({ text: line, font: "Times New Roman", size: 24 })],
                spacing: { after: 0 }
              }));
            }
          });
        }

        // Essay
        if (essayLines.length) {
          paragraphs.push(new Paragraph({ text: "Essay:", bold: true }));
          essayLines.forEach(line => paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text: line, font: "Times New Roman", size: 24 })],
              spacing: { after: 400 } // renggang antar essay soal
            })
          ));
        }
      }

      // ---- Jawaban ----
      if (row.jawaban) {
        paragraphs.push(new Paragraph({ text: "" }));
        paragraphs.push(new Paragraph({ text: "===JAWABAN===", heading: HeadingLevel.HEADING_2 }));

        const jawabanLines = row.jawaban.split("\n");
        const pgJawaban = [];
        const essayJawaban = [];

        jawabanLines.forEach(line => {
          const trimmed = line.trim();
          if (!trimmed) return;
          if (/^\d+\)/.test(trimmed)) essayJawaban.push(trimmed);
          else pgJawaban.push(trimmed);
        });

        // Jawaban PG
        if (pgJawaban.length) {
          paragraphs.push(new Paragraph({ text: "Pilihan Ganda:", bold: true }));
          pgJawaban.forEach(line => paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text: line, font: "Times New Roman", size: 22 })],
              spacing: { after: 400 } // renggang antar jawaban
            })
          ));
        }

        // Jawaban Essay
        if (essayJawaban.length) {
          paragraphs.push(new Paragraph({ text: "Essay:", bold: true }));
          essayJawaban.forEach(line => paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text: line, font: "Times New Roman", size: 22 })],
              spacing: { after: 400 }
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
