const express = require("express")
const axios = require("axios")
const multer = require("multer")
const db = require("../db")

const router = express.Router()
const upload = multer({ dest: "uploads/" })

router.post("/process", upload.single("foto"), async (req, res) => {
  try {
    const prompt = `
Buat ${req.body.jumlah} soal ${req.body.jenis}

ATURAN OUTPUT (WAJIB):
===SOAL===
- Tulis soal pilihan ganda terlebih dahulu
- Setelah itu soal essay

===JAWABAN===
- Kunci jawaban pilihan ganda (contoh: 1. A)
- Setelah itu jawaban essay
`

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "Kamu adalah AI pembuat soal ujian sekolah." },
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
      "INSERT INTO history (user_id, soal, jawaban) VALUES (?,?,?)",
      [req.session.user.id, soal, jawaban]
    )

    res.json({
      success: true,
      soal,
      jawaban
    })
  } catch (err) {
    console.error("GROQ ERROR:", err.response?.data || err.message)
    res.status(500).json({ success: false })
  }
})

module.exports = router
