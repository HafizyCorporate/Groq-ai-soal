const express = require("express");
const axios = require("axios");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db");

const router = express.Router();

// Setup multer untuk uploads
const uploadDir = path.join(__dirname, "../uploads/");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const upload = multer({ dest: uploadDir });

// Route POST /ai/process
router.post("/process", upload.single("foto"), async (req, res) => {
  try {
    // Pastikan user login
    if (!req.session.user) return res.status(401).json({ error: "Login dulu" });

    // Pastikan foto ada
    if (!req.file) return res.status(400).json({ error: "Foto wajib diupload" });

    // Prompt untuk AI
    const prompt = `
Buat ${req.body.jumlah} soal ${req.body.jenis} dari rangkuman foto.
Format:
===SOAL===
===JAWABAN===
`;

    // Panggil Groq AI
    const ai = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }]
      },
      { headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` } }
    );

    let rawHasil = ai.data.choices[0].message.content;

    // Pisahkan soal & jawaban dari AI
    let parts = rawHasil.split("===JAWABAN===");
    let soalText = parts[0].replace("===SOAL===","").trim();
    let jawabanText = parts[1]?.trim() || "";

    // FORMAT ulang supaya:
    // 1. Soal PG dulu, Essay setelah
    // 2. Semua jawaban di akhir, PG dulu, Essay setelah
    function formatSoalJawaban(soalText, jawabanText){
      let pgSoal=[], essaySoal=[], pgJaw=[], essayJaw=[];
      let lines = soalText.split("\n").map(l => l.trim()).filter(l=>l);
      let isEssay = false;
      for(let l of lines){
        if(l.toLowerCase().includes("essay")) isEssay=true;
        if(isEssay) essaySoal.push(l);
        else pgSoal.push(l);
      }
      let jawLines = jawabanText.split("\n").map(l=>l.trim()).filter(l=>l);
      isEssay=false;
      for(let l of jawLines){
        if(l.toLowerCase().includes("essay")) isEssay=true;
        if(isEssay) essayJaw.push(l);
        else pgJaw.push(l);
      }

      // Semua soal
      let finalSoal = pgSoal.concat(essaySoal).join("\n");
      // Semua jawaban
      let finalJaw = "";
      if(pgJaw.length>0) finalJaw += "Pilihan Ganda\n" + pgJaw.join("\n") + "\n";
      if(essayJaw.length>0) finalJaw += "Essay\n" + essayJaw.join("\n");

      return { finalSoal, finalJaw };
    }

    let { finalSoal, finalJaw } = formatSoalJawaban(soalText, jawabanText);

    // Simpan ke history DB
    db.run(
      "INSERT INTO history (user_id, soal, jawaban) VALUES (?,?,?)",
      [req.session.user.id, finalSoal, finalJaw],
      function(err){
        if(err){
          console.error(err);
          return res.status(500).json({ error:"Gagal menyimpan history" });
        }

        // Kirim ke frontend terpisah
        res.json({ 
          soal: finalSoal,
          jawaban: finalJaw,
          historyId: this.lastID
        });
      }
    );

  } catch(err){
    console.error("AI ERROR:", err.response?.data || err);
    res.status(500).json({ error:"Gagal memproses AI" });
  }
});

module.exports = router;
