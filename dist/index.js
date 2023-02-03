document.addEventListener("click", (e) => {
  if (e.target.classList.contains("faq")) {
    document.getElementById(`${e.target.id}-modal`).showModal();
  } else {
    const row = e.target.closest(".overview");
    if (row !== null) {
      row.nextElementSibling?.classList.toggle("show");
    }
  }
});
