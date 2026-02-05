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

    // Pisahkan jawaban dan soal
    const jawabanIndex = data.indexOf("Jawaban:");
    let soalText = jawabanIndex >= 0 ? data.slice(0, jawabanIndex) : data;
    let jawabanText = jawabanIndex >= 0 ? data.slice(jawabanIndex).trim() : "";

    // Hilangkan double soal & jawaban
    const soalLines = Array.from(new Set(
      soalText.split("\n").map(l => l.trim()).filter(l => l !== "")
    ));

    const doc = new Document();

    // Tambah soal ke Word
    soalLines.forEach(line => {
      doc.addSection({
        children: [
          new Paragraph({
            children: [new TextRun(line)],
            spacing: { after: 200 }, // spasi antar soal
          }),
        ],
      });
    });

    // PageBreak sebelum jawaban
    if (jawabanText) {
      doc.addSection({ children: [new PageBreak()] });

      const jawabanLines = Array.from(new Set(
        jawabanText.split("\n").map(l => l.trim()).filter(l => l !== "")
      ));

      jawabanLines.forEach(jLine => {
        doc.addSection({
          children: [new Paragraph({ children: [new TextRun(jLine)], spacing: { after: 200 } })],
        });
      });
    }

    // Referensi gambar di bawah jawaban
    const refMatches = data.match(/https?:\/\/\S+\.(jpg|png)/g) || [];
    if (refMatches.length > 0) {
      const refParas = Array.from(new Set(refMatches)).map(url => {
        const matchSoal = url.match(/Soal\s*(\d+)/i);
        const nomor = matchSoal ? matchSoal[1] : "?";
        return new Paragraph({ children: [new TextRun(`Soal ${nomor} – Referensi Gambar: ${url}`)] });
      });
      doc.addSection({ children: refParas });
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
