document.addEventListener("click", (e) => {
  if (e.target.classList.contains("faq")) {
    document.getElementById(`${e.target.id}-modal`).showModal();
  }
});
