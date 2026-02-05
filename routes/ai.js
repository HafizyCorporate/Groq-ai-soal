const express = require("express");
const axios = require("axios");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db");

const router = express.Router();
const uploadDir = path.join(__dirname,"../uploads");
if(!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const upload = multer({ dest: uploadDir });

router.post("/process", upload.array("foto"), async (req,res)=>{
  try {
    if(!req.session.user) return res.status(401).json({error:"Login dulu"});
    if(!req.files || req.files.length===0) return res.status(400).json({error:"Foto wajib diupload"});

    const jumlah = req.body.jumlah || 10;
    const jenis = req.body.jenis || "Pilihan Ganda";

    const fotoList = req.files.map((f,i)=>`Foto ${i+1}: ${f.path}`).join("\n");

    const prompt = `
Buat ${jumlah} soal ${jenis} dari semua foto berikut:
${fotoList}

Aturan:
- Soal bergambar: tampilkan gambar di atas soal
- Pilihan PG rapat ke soal
- Jawaban di akhir halaman
- Jangan sertakan ===SOAL=== atau ===JAWABAN===
`;

    const aiResp = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      { model:"llama-3.1-8b-instant", messages:[{role:"user",content:prompt}] },
      { headers:{ Authorization:`Bearer ${process.env.GROQ_API_KEY}`, "Content-Type":"application/json"} }
    );

    let hasil = aiResp.data.choices[0].message.content || "";
    hasil = hasil.replace(/===SOAL===/g,"").replace(/===JAWABAN===/g,"").trim();

    const wordFileName = `export-${Date.now()}.docx`;
    const wordFilePath = path.join(uploadDir, wordFileName);
    fs.writeFileSync(wordFilePath,""); // nanti export.js handle Word

    db.run(
      "INSERT INTO history (user_id, soal, jawaban) VALUES (?,?,?)",
      [req.session.user.id, hasil, hasil],
      err=>{ if(err) console.error(err); }
    );

    res.json({hasil, jawaban:"", wordFile:`/uploads/${wordFileName}`});
  } catch(err){ console.error(err); res.status(500).json({error:"Gagal memproses AI"});}
});

module.exports = router;
