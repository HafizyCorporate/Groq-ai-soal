const express = require("express")
const axios = require("axios")
const multer = require("multer")
const fs = require("fs")
const path = require("path")
const db = require("../db")

const router = express.Router()

// pastikan folder uploads ada
const uploadDir = path.join(__dirname, "../uploads")
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir)

// multer upload
const upload = multer({ dest: uploadDir })

router.post("/process", upload.single("foto"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Foto tidak ditemukan" })
    }

    if (!req.session.user) {
      return res.status(401).json({ error: "Belum login" })
    }

    const { jenis, jumlah } = req.body

    const prompt = `
Buat ${jumlah} soal ${jenis}

FORMAT WAJIB:
===SOAL===
1. Pertanyaan
A. ...
B. ...
C. ...
D. ...

===JAWABAN===
1. A
2. B
`

    const ai = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    )

    const content = ai.data.choices[0].message.content

    const soal = content.split("===JAWABAN===")[0]
      .replace("===SOAL===", "")
      .trim()

    const jawaban = content.split("===JAWABAN===")[1]?.trim() || ""

    db.run(
      "INSERT INTO history (user_id, soal, jawaban) VALUES (?,?,?)",
      [req.session.user.id, soal, jawaban]
    )

    res.json({
      soal,
      jawaban,
      file: req.file.filename
    })

  } catch (err) {
    console.error("AI ERROR:", err.response?.data || err.message)
    res.status(500).json({ error: "Gagal memproses AI" })
  }
})

module.exports = router
