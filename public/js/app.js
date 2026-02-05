const form = document.getElementById("form")
const loading = document.getElementById("loading")
const btn = document.getElementById("btnProses")
const soal = document.getElementById("soal")
const jawaban = document.getElementById("jawaban")

form.addEventListener("submit", async e => {
  e.preventDefault()

  loading.classList.remove("hidden")
  btn.disabled = true
  btn.innerText = "⏳ Memproses..."

  try {
    const res = await fetch("/ai/process", {
      method: "POST",
      body: new FormData(form)
    })

    const data = await res.json()
    const split = data.hasil.split("===JAWABAN===")

    soal.value = split[0].replace("===SOAL===", "").trim()
    jawaban.value = split[1] ? split[1].trim() : ""
  } catch {
    alert("Gagal memproses AI")
  }

  loading.classList.add("hidden")
  btn.disabled = false
  btn.innerText = "🚀 Proses ke AI"
})

function exportWord() {
  fetch("/export/word", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      soal: soal.value,
      jawaban: jawaban.value
    })
  })
    .then(res => res.blob())
    .then(blob => {
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = "hasil-ai.docx"
      a.click()
    })
}
