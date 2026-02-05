const express = require("express")
const axios = require("axios")
const multer = require("multer")
const db = require("../db")

const router = express.Router()
const upload = multer({ dest: "uploads/" })

router.post("/process", upload.single("foto"), async (req, res) => {
  const prompt = `
Buat ${req.body.jumlah} soal ${req.body.jenis}
===SOAL===
===JAWABAN===
`

  const ai = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model: "llama-3.1-70b-versatile",
      messages: [{ role: "user", content: prompt }]
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`
      }
    }
  )

  const hasil = ai.data.choices[0].message.content

  db.run(
    "INSERT INTO history (user_id, soal, jawaban) VALUES (?,?,?)",
    [req.session.user.id, hasil, hasil]
  )

  res.json({ hasil })
})

module.exports = router
