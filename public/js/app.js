form.onsubmit = async e => {
  e.preventDefault()
  loading.classList.remove("hidden")
  btnProses.disabled = true

  const res = await fetch("/ai/process", {
    method:"POST",
    body:new FormData(form)
  })
  const data = await res.json()

  const split = data.hasil.split("===JAWABAN===")
  soal.value = split[0]
  jawaban.value = split[1]

  loading.classList.add("hidden")
  btnProses.disabled = false
}

function exportWord(){
  fetch("/export/word",{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({ soal:soal.value, jawaban:jawaban.value })
  }).then(r=>r.blob()).then(b=>{
    const a=document.createElement("a")
    a.href=URL.createObjectURL(b)
    a.download="hasil.docx"
    a.click()
  })
}
