const express = require("express");
const router = express.Router();
const db = require("../db");
const { Document, Packer, Paragraph, TextRun, AlignmentType, PageBreak } = require("docx");

router.get("/word/:id", (req, res) => {
    const historyId = req.params.id;

    db.get("SELECT * FROM history WHERE id = ?", [historyId], async (err, data) => {
        if (err || !data) return res.status(404).send("Data tidak ditemukan.");

        try {
            const soalLines = (data.soal || "").trim().split('\n');
            const jawabanLines = (data.jawaban || "").trim().split('\n');

            const doc = new Document({
                sections: [{
                    properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [ new TextRun({ text: "INSTANSI PENDIDIKAN AUTO SOAL AI", bold: true, size: 24 }) ],
                        }),
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [ new TextRun({ text: "UJIAN BERBASIS KECERDASAN BUATAN", bold: true, size: 18 }) ],
                        }),
                        new Paragraph({ alignment: AlignmentType.CENTER, text: "__________________________________________________________________________" }),

                        ...soalLines.map(line => {
                            const cleanLine = line.replace(/Soal PG:|Soal Essay:/gi, "").trim();
                            if (!cleanLine) return new Paragraph({ spacing: { after: 100 } });
                            return new Paragraph({
                                children: [ new TextRun({ text: cleanLine, size: 22 }) ],
                                spacing: { after: 80 },
                                keepNext: cleanLine.includes(')') || cleanLine.match(/^\d+/) ? true : false,
                                keepLines: true
                            });
                        }),

                        new Paragraph({ children: [new PageBreak()] }), 
                        new Paragraph({
                            children: [new TextRun({ text: "KUNCI JAWABAN", bold: true, size: 24, underline: {} })],
                            spacing: { after: 200 }
                        }),
                        ...jawabanLines.map(line => {
                            const isRefHeader = line.includes("REFERENSI GAMBAR");
                            const isLink = line.toLowerCase().includes("google.com") || line.toLowerCase().includes("soal no");
                            return new Paragraph({
                                children: [ new TextRun({ text: line, size: 22, bold: isRefHeader, color: isLink ? "0000FF" : "000000" }) ],
                                spacing: { before: isRefHeader ? 400 : 0, after: 80 }
                            });
                        }),
                    ],
                }],
            });

            const buffer = await Packer.toBuffer(doc);
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
            res.setHeader("Content-Disposition", `attachment; filename=Soal_Ujian_AI.docx`);
            res.send(buffer);
        } catch (error) { res.status(500).send("Gagal: " + error.message); }
    });
});

module.exports = router;
