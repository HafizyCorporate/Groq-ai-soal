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
                    properties: {
                        page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } }
                    },
                    children: [
                        // --- KOP SURAT ---
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [ new TextRun({ text: "INSTANSI PENDIDIKAN AUTO SOAL AI", bold: true, size: 24 }) ],
                            spacing: { after: 0 }
                        }),
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [ new TextRun({ text: "UJIAN BERBASIS KECERDASAN BUATAN", bold: true, size: 18 }) ],
                            spacing: { after: 0 }
                        }),
                        new Paragraph({ 
                            alignment: AlignmentType.CENTER, 
                            text: "__________________________________________________________________________",
                            spacing: { after: 200 }
                        }),

                        // --- DAFTAR SOAL (Pembersihan Label) ---
                        ...soalLines.map(line => {
                            // Hapus paksa label jika AI masih menuliskannya
                            const cleanLine = line.replace(/Soal PG:|Soal Essay:/gi, "").trim();
                            if (!cleanLine) return new Paragraph({ spacing: { after: 100 } });

                            return new Paragraph({
                                children: [ new TextRun({ text: cleanLine, size: 22 }) ],
                                spacing: { after: 80 },
                                keepNext: cleanLine.includes(')') || cleanLine.match(/^\d+/) ? true : false,
                                keepLines: true
                            });
                        }),

                        // --- HALAMAN BARU UNTUK JAWABAN & REFERENSI ---
                        new Paragraph({ children: [new PageBreak()] }), 
                        new Paragraph({
                            children: [new TextRun({ text: "KUNCI JAWABAN", bold: true, size: 24, underline: {} })],
                            spacing: { after: 200 }
                        }),
                        ...jawabanLines.map(line => {
                            // Deteksi judul referensi gambar untuk memberi jarak ekstra
                            const isRef = line.includes("REFERENSI GAMBAR");
                            return new Paragraph({
                                children: [ new TextRun({ text: line, size: 22, bold: isRef }) ],
                                spacing: { before: isRef ? 400 : 0, after: 80 }
                            });
                        }),
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
