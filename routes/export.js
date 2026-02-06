const express = require("express");
const router = express.Router();
const db = require("../db");
// Kita hanya panggil komponen inti yang pasti ada di semua versi
const { Document, Packer, Paragraph, TextRun, AlignmentType, PageBreak } = require("docx");

router.get("/word/:id", (req, res) => {
    const historyId = req.params.id;

    db.get("SELECT * FROM history WHERE id = ?", [historyId], async (err, data) => {
        if (err || !data) {
            console.error("Database Error:", err);
            return res.status(404).send("Data tidak ditemukan.");
        }

        try {
            const soalLines = (data.soal || "").split('\n');
            const jawabanLines = (data.jawaban || "").split('\n');

            const doc = new Document({
                sections: [{
                    children: [
                        // --- KOP SURAT ---
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({ text: "INSTANSI PENDIDIKAN AUTO SOAL AI", bold: true, size: 28 }),
                            ],
                        }),
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({ text: "UJIAN BERBASIS KECERDASAN BUATAN", bold: true, size: 22 }),
                            ],
                        }),
                        new Paragraph({ 
                            alignment: AlignmentType.CENTER, 
                            text: "__________________________________________________________" 
                        }),
                        new Paragraph({ text: "" }), // Spasi kosong

                        // --- ISI SOAL ---
                        ...soalLines.map(line => new Paragraph({
                            children: [ new TextRun({ text: line, size: 24 }) ],
                            spacing: { after: 120 },
                            keepNext: true, // Mencegah soal terpotong
                            keepLines: true
                        })),

                        // --- HALAMAN BARU ---
                        new Paragraph({ children: [new PageBreak()] }), 

                        // --- KUNCI JAWABAN ---
                        new Paragraph({
                            children: [new TextRun({ text: "KUNCI JAWABAN", bold: true, size: 26, underline: {} })],
                            spacing: { after: 200 }
                        }),
                        ...jawabanLines.map(line => new Paragraph({
                            children: [ new TextRun({ text: line, size: 24 }) ],
                            spacing: { after: 100 }
                        })),
                    ],
                }],
            });

            const buffer = await Packer.toBuffer(doc);
            
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
            res.setHeader("Content-Disposition", `attachment; filename=Soal_Ujian_AI.docx`);
            res.send(buffer);

        } catch (error) {
            console.error("DOCX ERROR:", error);
            res.status(500).send("Gagal membuat file Word: " + error.message);
        }
    });
});

module.exports = router;
