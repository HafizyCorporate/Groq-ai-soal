const express = require("express")
const { Document, Packer, Paragraph, TextRun, PageBreak } = require("docx")
const db = require("../db")

const router = express.Router()

router.get("/word/:id", (req, res) => {
  db.get(
    "SELECT soal, jawaban FROM history WHERE id = ?",
    [req.params.id],
    async (err, row) => {
      if (!row) return res.sendStatus(404)

      const soalParagraphs = row.soal.split("\n").map(line =>
        new Paragraph({
          children: [new TextRun(line)],
          spacing: { after: 200 }
        })
      )

      const jawabanParagraphs = row.jawaban.split("\n").map(line =>
        new Paragraph({
          children: [new TextRun(line)],
          spacing: { after: 200 }
        })
      )

      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "LEMBAR SOAL", bold: true })
                ]
              }),
              ...soalParagraphs
            ]
          },
          {
            children: [
              new Paragraph({ children: [new PageBreak()] }),
              new Paragraph({
                children: [
                  new TextRun({ text: "LEMBAR JAWABAN", bold: true })
                ]
              }),
              ...jawabanParagraphs
            ]
          }
        ]
      })

      const buffer = await Packer.toBuffer(doc)

      res.setHeader(
        "Content-Disposition",
        "attachment; filename=soal-ujian.docx"
      )
      res.send(buffer)
    }
  )
})

module.exports = router
