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
  ImageRun,
  Footer,
  PageNumber,
  PageNumberFormat,
  SectionType
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
      if(err) return res.status(500).send("DB error");
      if(!row) return res.status(404).send("Data tidak ditemukan");

      const doc = new Document({
        creator: "AI Soal App",
        title: "Soal & Jawaban",
        sections: [{
          properties: {
            page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } // 1 inch margin
          },
          headers: {},
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: "Halaman ", bold: true }),
                    new PageNumber(),
                    new TextRun({ text: " dari ", bold: true }),
                    new PageNumber({ format: PageNumberFormat.DECIMAL })
                  ],
                  alignment: AlignmentType.CENTER
                })
              ]
            })
          },
          children: []
        }]
      });

      const paragraphs = [];

      // ---- Kop surat + logo ----
      if(fs.existsSync(logoPath)){
        const logoImage = fs.readFileSync(logoPath);
        paragraphs.push(
          new Paragraph({
            children: [ new ImageRun({ data: logoImage, transformation: { width: 80, height: 80 } }) ],
            alignment: AlignmentType.CENTER
          })
        );
      }

      paragraphs.push(
        new Paragraph({ children: [ new TextRun({ text: "SEKOLAH ABC", bold: true, size: 28 }) ], alignment: AlignmentType.CENTER }),
        new Paragraph({ children: [ new TextRun({ text: "Jl. Pendidikan No.123, Kota Contoh", italics: true, size: 20 }) ], alignment: AlignmentType.CENTER }),
        new Paragraph({ text: "" })
      );

      // ---- Soal ----
      if(row.soal){
        paragraphs.push(new Paragraph({ text: "===SOAL===", heading: HeadingLevel.HEADING_2 }));

        const soalLines = Array.from(new Set(row.soal.split("\n"))); // hapus duplikat
        const pgLines = [];
        const essayLines = [];

        soalLines.forEach(line => {
          const trimmed = line.trim();
          if(trimmed === "") return;
          if(/^\d+\)/.test(trimmed)) essayLines.push(trimmed);
          else pgLines.push(trimmed);
        });

        if(pgLines.length){
          paragraphs.push(new Paragraph({ text: "Pilihan Ganda:", bold: true }));
          pgLines.forEach(line => paragraphs.push(new Paragraph({
            children: [ new TextRun({ text: line, font: "Times New Roman", size: 24 }) ],
            spacing: { line: 360 } // 1.5 spasi
          })));
        }

        if(essayLines.length){
          paragraphs.push(new Paragraph({ text: "Essay:", bold: true }));
          essayLines.forEach(line => paragraphs.push(new Paragraph({
            children: [ new TextRun({ text: line, font: "Times New Roman", size: 24 }) ],
            spacing: { line: 360 } 
          })));
        }
      }

      // ---- Jawaban ----
      if(row.jawaban){
        paragraphs.push(new Paragraph({ text: "" }));
        paragraphs.push(new Paragraph({ text: "===JAWABAN===", heading: HeadingLevel.HEADING_2 }));

        const jawabanLines = row.jawaban.split("\n");
        const pgJawaban = [];
        const essayJawaban = [];

        jawabanLines.forEach(line => {
          const trimmed = line.trim();
          if(trimmed === "") return;
          if(/^\d+\)/.test(trimmed)) essayJawaban.push(trimmed);
          else pgJawaban.push(trimmed);
        });

        if(pgJawaban.length){
          paragraphs.push(new Paragraph({ text: "Pilihan Ganda:", bold: true }));
          pgJawaban.forEach(line => paragraphs.push(new Paragraph({
            children: [ new TextRun({ text: line, font: "Times New Roman", size: 22 }) ],
            spacing: { line: 330 } // 1.5 spasi
          })));
        }

        if(essayJawaban.length){
          paragraphs.push(new Paragraph({ text: "Essay:", bold: true }));
          essayJawaban.forEach(line => paragraphs.push(new Paragraph({
            children: [ new TextRun({ text: line, font: "Times New Roman", size: 22 }) ],
            spacing: { line: 330 }
          })));
        }
      }

      doc.addSection({ children: paragraphs, type: SectionType.NEXT_PAGE });

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
