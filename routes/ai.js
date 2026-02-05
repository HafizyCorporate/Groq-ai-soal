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

Pisahkan dengan format:
===SOAL===
===JAWABAN===
`

    const ai = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama3-8b-8192",
        messages: [
          { role: "system", content: "Kamu adalah asisten pembuat soal pendidikan." },
          { role: "user", content: prompt }
        ],
        temperature: 0.2
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    )

    const hasil = ai.data.choices[0].message.content

    db.run(
      "INSERT INTO history (user_id, soal, jawaban) VALUES (?,?,?)",
      [req.session.user.id, hasil, hasil]
    )

    res.json({ success: true, hasil })

  } catch (err) {
    console.error("GROQ ERROR:", err.response?.data || err.message)
    res.status(500).json({
      success: false,
      message: "Gagal memproses AI"
    })
  }
})

module.exports = router
