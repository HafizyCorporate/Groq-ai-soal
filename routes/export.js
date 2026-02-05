const express = require("express");
const path = require("path");
const fs = require("fs");
const { Document, Packer, Paragraph, TextRun, ImageRun, PageBreak } = require("docx");

const router = express.Router();
const uploadDir = path.join(__dirname,"../uploads");

router.get("/:filename", async (req,res)=>{
  try {
    const filename = req.params.filename;
    const filePath = path.join(uploadDir, filename);
    if(!fs.existsSync(filePath)) return res.status(404).send("File tidak ditemukan");

    // Ambil data soal dari file atau DB
    const data = fs.readFileSync(filePath,"utf-8");

    const doc = new Document();

    // Split berdasarkan soal, asumsi setiap soal mulai dengan nomor
    const soalRegex = /^\d+\.\s.*$/gm;
    const soalMatches = data.match(soalRegex) || [];

    soalMatches.forEach((s,i)=>{
      // Cek apakah ada path gambar di baris sebelum soal
      const lines = s.split("\n");
      lines.forEach(line=>{
        if(line.startsWith("http") && (line.endsWith(".jpg") || line.endsWith(".png"))){
          const imgPath = path.join(uploadDir,path.basename(line));
          if(fs.existsSync(imgPath)){
            const imgBuffer = fs.readFileSync(imgPath);
            doc.addSection({ children:[ new Paragraph({ children:[ new ImageRun({ data: imgBuffer, transformation:{ width:200, height:150 } }) ] }) ] });
          }
        } else {
          doc.addSection({ children:[ new Paragraph({ children:[ new TextRun(line) ] }) ] });
        }
      });

      // Beri spasi antar soal
      if(i<soalMatches.length-1) doc.addSection({ children:[ new Paragraph({ text:"\n" }) ] });
    });

    // Tambah PageBreak untuk jawaban
    doc.addSection({ children:[ new PageBreak() ] });

    // Ambil jawaban dari akhir file
    const jawabanIndex = data.indexOf("Jawaban:");
    if(jawabanIndex>=0){
      const jawabanText = data.slice(jawabanIndex).trim();
      doc.addSection({ children:[ new Paragraph({ children:[ new TextRun({ text:jawabanText, bold:true }) ] }) ] });
    }

    const buffer = await Packer.toBuffer(doc);
    res.setHeader("Content-Disposition",`attachment; filename=Soal-${Date.now()}.docx`);
    res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.send(buffer);

  } catch(err){
    console.error(err);
    res.status(500).send("Gagal generate Word");
  }
});

module.exports = router;
