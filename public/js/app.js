const cameraBtn = document.getElementById("cameraBtn");
const mediaBtn = document.getElementById("mediaBtn");
const fileInput = document.getElementById("fileInput");
const preview = document.getElementById("preview");
const generateBtn = document.getElementById("generateBtn");
const loading = document.getElementById("loading");
const soalOutput = document.getElementById("soalOutput");
const jawabanOutput = document.getElementById("jawabanOutput");
const exportWordBtn = document.getElementById("exportWordBtn");
const printBtn = document.getElementById("printBtn");

// Upload foto
cameraBtn.addEventListener("click", () => {
  fileInput.setAttribute("capture","environment");
  fileInput.click();
});
mediaBtn.addEventListener("click", () => {
  fileInput.removeAttribute("capture");
  fileInput.click();
});
fileInput.addEventListener("change", () => {
  preview.innerHTML = "";
  Array.from(fileInput.files).forEach(f => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(f);
    preview.appendChild(img);
  });
});

// Proses AI
generateBtn.addEventListener("click", async () => {
  const files = fileInput.files;
  if(files.length === 0){ alert("Pilih foto dulu"); return; }

  const jenisSoal = document.querySelector('input[name="jenisSoal"]:checked').value;
  const jumlahSoal = document.getElementById("jumlahSoal").value;

  const formData = new FormData();
  Array.from(files).forEach(f => formData.append("photos", f));
  formData.append("jenisSoal", jenisSoal);
  formData.append("jumlahSoal", jumlahSoal);

  loading.style.display="inline";
  const res = await fetch("/ai/generate", { method:"POST", body: formData });
  const data = await res.json();
  loading.style.display="none";

  if(data.filename){
    soalOutput.value = "Soal berhasil digenerate. Klik 'Cetak Word' untuk mendownload.";
    jawabanOutput.value = "Jawaban tersedia di Word export.";
    exportWordBtn.setAttribute("data-file", data.filename);
  }else{
    soalOutput.value = "Gagal generate soal";
    jawabanOutput.value = "";
  }
});

// Export Word
exportWordBtn.addEventListener("click", () => {
  const file = exportWordBtn.getAttribute("data-file");
  if(!file) return alert("Belum ada file untuk export");
  window.open(`/export/${file}`, "_blank");
});

// Print
printBtn.addEventListener("click", () => {
  window.print();
});
