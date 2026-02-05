const express = require("express")
const { Document, Packer, Paragraph } = require("docx")
const router = express.Router()

router.post("/word", async (req, res) => {
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph("SOAL"),
        ...req.body.soal.split("\n").map(t => new Paragraph(t)),
        new Paragraph(""),
        new Paragraph("JAWABAN"),
        ...req.body.jawaban.split("\n").map(t => new Paragraph(t))
      ]
    }]
  })

  const buffer = await Packer.toBuffer(doc)
  res.setHeader("Content-Disposition", "attachment; filename=hasil-ai.docx")
  res.send(buffer)
})

module.exports = router
