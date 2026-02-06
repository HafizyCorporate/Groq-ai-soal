const express = require("express");
const router = express.Router();
const db = require("../db");
const { Document, Packer, Paragraph, TextRun, AlignmentType, Break } = require("docx");

router.get("/word/:id", (req, res) => {
    const historyId = req.params.id;

    // 1. Ambil data dari database berdasarkan ID
    db.get("SELECT * FROM history WHERE id = ?", [historyId], async (err, data) => {
        if (err || !data) {
            console.error("DB Error:", err);
            return res.status(404).send("Data soal tidak ditemukan di database.");
        }

        try {
            // 2. Pecah teks soal menjadi baris-baris agar format terjaga
            const soalLines = data.soal.split('\n');
            const jawabanLines = data.jawaban.split('\n');

            // 3. Susun struktur dokumen Word
            const doc = new Document({
                sections: [{
                    properties: {},
                    children: [
                        // --- KOP SURAT ---
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({ text: "YAYASAN PENDIDIKAN AUTO SOAL AI", bold: true, size: 28 }),
                                new Break(),
                                new TextRun({ text: "UJIAN SATUAN PENDIDIKAN BERBASIS TEKNOLOGI", bold: true, size: 22 }),
                                new Break(),
                                new TextRun({ text: "Tahun Ajaran 2025/2026", size: 18 }),
                            ],
                        }),
                        new Paragraph({ text: "__________________________________________________________", alignment: AlignmentType.CENTER }),
                        new Paragraph({ text: "", spacing: { after: 300 } }),

                        // --- DAFTAR SOAL ---
                        ...soalLines.map(line => new Paragraph({
                            children: [ new TextRun({ text: line, size: 22 }) ],
                            spacing: { after: 120 },
                            keepNext: true, // Mencegah soal terpotong halaman
                            keepLines: true
                        })),

                        // --- HALAMAN BARU UNTUK KUNCI ---
                        new Paragraph({ children: [new Break({ type: "page" })] }),
                        new Paragraph({
                            children: [new TextRun({ text: "KUNCI JAWABAN", bold: true, size: 24, underline: {} })],
                            spacing: { after: 200 }
                        }),
                        ...jawabanLines.map(line => new Paragraph({
                            children: [ new TextRun({ text: line, size: 22 }) ],
                            spacing: { after: 100 }
                        })),
                    ],
                }],
            });

            // 4. Generate file dan kirim ke browser
            const buffer = await Packer.toBuffer(doc);
            
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
            res.setHeader("Content-Disposition", `attachment; filename=Soal_Ujian_${historyId}.docx`);
            res.send(buffer);

        } catch (error) {
            console.error("Export Error:", error);
            res.status(500).send("Gagal membuat file Word.");
        }
    });
});

module.exports = router;
