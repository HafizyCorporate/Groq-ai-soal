const express = require("express")
const multer = require("multer")
const axios = require("axios")
const Tesseract = require("tesseract.js")
const auth = require("../middleware/auth")
const { buatWord } = require("../utils/word")

const router = express.Router()
const upload = multer({ dest: "uploads/" })

router.post("/process", auth, upload.single("foto"), async (req, res) => {
  const ocr = await Tesseract.recognize(req.file.path, "ind")
  const text = ocr.data.text

  const prompt = `
Ringkas dan buat ${req.body.jumlah} soal ${req.body.tipe}
Pisahkan:
===SOAL===
===JAWABAN===

${text}
`

  const ai = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model: "llama-3.1-70b-versatile",
      messages: [{ role: "user", content: prompt }]
    },
    {
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }
    }
  )

  res.json({ hasil: ai.data.choices[0].message.content })
})

router.post("/word", auth, async (req, res) => {
  const buffer = await buatWord(req.body.soal, req.body.jawaban)
  res.setHeader("Content-Disposition", "attachment; filename=soal.docx")
  res.send(buffer)
})

module.exports = router
