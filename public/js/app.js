document.getElementById("form").onsubmit = async e => {
  e.preventDefault()
  const form = new FormData(e.target)

  const res = await fetch("/ai/process", {
    method: "POST",
    body: form
  })

  const data = await res.json()
  const [soal, jawaban] = data.hasil.split("===JAWABAN===")

  document.getElementById("soal").value =
    soal.replace("===SOAL===", "").trim()
  document.getElementById("jawaban").value = jawaban.trim()
}

async function exportWord() {
  const soal = document.getElementById("soal").value
  const jawaban = document.getElementById("jawaban").value

  const res = await fetch("/ai/word", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ soal, jawaban })
  })

  const blob = await res.blob()
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = "soal.docx"
  a.click()
}
