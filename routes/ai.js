const express = require("express")
const axios = require("axios")
const multer = require("multer")
const fs = require("fs")
const db = require("../db")

const router = express.Router()

const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 }
})

router.post("/process", upload.single("foto"), async (req, res) => {
  try {
    let fotoBase64 = null

    if (req.file) {
      const buffer = fs.readFileSync(req.file.path)
      fotoBase64 = buffer.toString("base64")
      fs.unlinkSync(req.file.path) // bersihin file temp
    }

    const prompt = `
Buat ${req.body.jumlah} soal ${req.body.jenis}

ATURAN OUTPUT:
===SOAL===
(pilihan ganda lalu essay)

===JAWABAN===
(kunci pilihan ganda lalu jawaban essay)
`

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "Kamu adalah AI pembuat soal ujian." },
          { role: "user", content: prompt }
        ],
        temperature: 0.3
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 60000
      }
    )

    const raw = response.data.choices[0].message.content

    const soal =
      raw.split("===SOAL===")[1]?.split("===JAWABAN===")[0]?.trim() || ""

    const jawaban =
      raw.split("===JAWABAN===")[1]?.trim() || ""

    db.run(
      "INSERT INTO history (user_id, soal, jawaban, foto) VALUES (?,?,?,?)",
      [req.session.user.id, soal, jawaban, fotoBase64]
    )

    res.json({
      success: true,
      soal,
      jawaban
    })
  } catch (err) {
    console.error("AI ERROR:", err.message)
    res.status(500).json({ success: false })
  }
})

module.exports = router
