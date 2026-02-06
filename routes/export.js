const express = require("express");
const router = express.Router();
const db = require("../db");
// Gunakan komponen dasar yang paling stabil
const { Document, Packer, Paragraph, TextRun, AlignmentType, PageBreak } = require("docx");

router.get("/word/:id", (req, res) => {
    const historyId = req.params.id;

    db.get("SELECT * FROM history WHERE id = ?", [historyId], async (err, data) => {
        if (err || !data) return res.status(404).send("Data tidak ditemukan.");

        try {
            // Bersihkan teks soal dari baris kosong berlebih di awal
            const soalLines = (data.soal || "").trim().split('\n');
            const jawabanLines = (data.jawaban || "").trim().split('\n');

            const doc = new Document({
                sections: [{
                    properties: {
                        // Memperkecil margin halaman agar muat lebih banyak
                        page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } }
                    },
                    children: [
                        // --- KOP SURAT (Dibuat lebih rapat) ---
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({ text: "INSTANSI PENDIDIKAN AUTO SOAL AI", bold: true, size: 24 }),
                            ],
                            spacing: { after: 0 }
                        }),
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({ text: "UJIAN BERBASIS KECERDASAN BUATAN", bold: true, size: 18 }),
                            ],
                            spacing: { after: 0 }
                        }),
                        new Paragraph({ 
                            alignment: AlignmentType.CENTER, 
                            text: "__________________________________________________________________________",
                            spacing: { after: 200 } // Jarak garis ke soal dikecilkan
                        }),

                        // --- ISI SOAL ---
                        ...soalLines.map((line, index) => {
                            // Jika baris kosong, buat paragraf kecil saja
                            if (!line.trim()) return new Paragraph({ spacing: { after: 100 } });

                            return new Paragraph({
                                children: [ new TextRun({ text: line, size: 22 }) ],
                                spacing: { after: 80 },
                                // keepNext hanya untuk baris soal, jangan untuk semua agar tidak pindah halaman sekaligus
                                keepNext: line.includes('?') || line.match(/^\d+\./) ? true : false,
                                keepLines: true
                            });
                        }),

                        // --- HALAMAN BARU UNTUK KUNCI ---
                        new Paragraph({ children: [new PageBreak()] }), 
                        new Paragraph({
                            children: [new TextRun({ text: "KUNCI JAWABAN", bold: true, size: 24, underline: {} })],
                            spacing: { after: 200 }
                        }),
                        ...jawabanLines.map(line => new Paragraph({
                            children: [ new TextRun({ text: line, size: 22 }) ],
                            spacing: { after: 80 }
                        })),
                    ],
                }],
            });

            const buffer = await Packer.toBuffer(doc);
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
            res.setHeader("Content-Disposition", `attachment; filename=Soal_Ujian_AI.docx`);
            res.send(buffer);

        } catch (error) {
            res.status(500).send("Gagal membuat file: " + error.message);
        }
    });
});

module.exports = router;
