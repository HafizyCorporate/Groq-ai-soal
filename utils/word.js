const { Document, Packer, Paragraph } = require("docx")

exports.buatWord = async (soal, jawaban) => {
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph("SOAL"),
        ...soal.split("\n").map(s => new Paragraph(s)),
        new Paragraph(""),
        new Paragraph("JAWABAN"),
        ...jawaban.split("\n").map(j => new Paragraph(j))
      ]
    }]
  })
  return await Packer.toBuffer(doc)
}
