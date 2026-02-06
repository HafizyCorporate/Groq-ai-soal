const express = require("express");
const router = express.Router();
const db = require("../db");
const { Document, Packer, Paragraph, TextRun, AlignmentType, Break } = require("docx");

router.get("/word/:id", (req, res) => {
    const historyId = req.params.id;

    db.get("SELECT * FROM history WHERE id = ?", [historyId], (err, data) => {
        if (err || !data) return res.status(404).send("Data tidak ditemukan");

        // Pisahkan soal berdasarkan nomor agar bisa kita atur per blok
        const soalLines = data.soal.split(/\n/); 

        const doc = new Document({
            sections: [{
                children: [
                    // --- KOP SURAT ---
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({ text: "YAYASAN PENDIDIKAN AUTO SOAL", bold: true, size: 28 }),
                            new Break(),
                            new TextRun({ text: "UJIAN AKHIR SEMESTER BERBASIS AI", bold: true, size: 24 }),
                            new Break(),
                            new TextRun({ text: "Tahun Ajaran 2025/2026", size: 20 }),
                        ],
                    }),
                    new Paragraph({ text: "__________________________________________________________", alignment: AlignmentType.CENTER }),
                    new Paragraph({ text: "", spacing: { after: 400 } }),

                    // --- ISI SOAL ---
                    ...soalLines.map(line => {
                        return new Paragraph({
                            children: [ new TextRun({ text: line, size: 24 }) ],
                            // KUNCINYA: keepNext & keepLines mencegah soal terpisah dari pilihan jawaban
                            keepNext: true,
                            keepLines: true,
                            spacing: { after: 100 }
                        });
                    }),

                    // --- HALAMAN BARU KUNCI JAWABAN ---
                    new Paragraph({ children: [new Break({ type: "page" })] }),
                    new Paragraph({
                        children: [new TextRun({ text: "KUNCI JAWABAN", bold: true, size: 28, underline: {} })],
                        spacing: { after: 200 }
                    }),
                    new Paragraph({
                        children: [new TextRun({ text: data.jawaban, size: 24 })],
                    }),
                ],
            }],
        });

        Packer.toBuffer(doc).then((buffer) => {
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
            res.setHeader("Content-Disposition", `attachment; filename=Soal_Ujian.docx`);
            res.send(buffer);
        });
    });
});

module.exports = router;
