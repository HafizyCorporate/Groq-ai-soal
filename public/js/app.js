document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("aiForm")
  const spinner = document.getElementById("spinner")

  const reviewSoal = document.getElementById("reviewSoal")
  const reviewJawaban = document.getElementById("reviewJawaban")

  form.addEventListener("submit", async (e) => {
    e.preventDefault()

    spinner.style.display = "block"
    reviewSoal.value = ""
    reviewJawaban.value = ""

    const formData = new FormData(form)

    try {
      const res = await fetch("/ai/process", {
        method: "POST",
        body: formData
      })

      const data = await res.json()

      if (data.success) {
        reviewSoal.value = data.soal
        reviewJawaban.value = data.jawaban
      } else {
        alert("Gagal memproses AI")
      }
    } catch (err) {
      alert("Terjadi kesalahan")
    } finally {
      spinner.style.display = "none"
    }
  })
})
