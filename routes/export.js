const express = require("express");
const path = require("path");
const fs = require("fs");
const { Document, Packer, Paragraph, TextRun, PageBreak } = require("docx");

const router = express.Router();
const uploadDir = path.join(__dirname, "../uploads");

router.get("/:filename", async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(uploadDir, filename);

    if (!fs.existsSync(filePath))
      return res.status(404).send("File tidak ditemukan");

    const data = fs.readFileSync(filePath, "utf-8");

    const jawabanIndex = data.indexOf("Jawaban:");
    let soalText = jawabanIndex >= 0 ? data.slice(0, jawabanIndex) : data;
    let jawabanText = jawabanIndex >= 0 ? data.slice(jawabanIndex).trim() : "";

    const soalLines = Array.from(new Set(
      soalText.split("\n").map(l => l.trim()).filter(l => l !== "")
    ));

    const doc = new Document();

    soalLines.forEach(line => {
      doc.addSection({
        children: [
          new Paragraph({
            children: [new TextRun(line)],
            spacing: { after: 300 }, // jarak antar soal
          }),
        ],
      });
    });

    if (jawabanText) {
      doc.addSection({ children: [new PageBreak()] });

      const jawabanLines = Array.from(new Set(
        jawabanText.split("\n").map(l => l.trim()).filter(l => l !== "")
      ));

      jawabanLines.forEach(jLine => {
        doc.addSection({
          children: [new Paragraph({ children: [new TextRun(jLine)], spacing: { after: 300 } })],
        });
      });
    }

    const buffer = await Packer.toBuffer(doc);

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Soal-${Date.now()}.docx`
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.send(buffer);

  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal generate Word");
  }
});

module.exports = router;
