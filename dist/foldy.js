document.addEventListener("click", (e) => {
  const row = e.target.closest(".overview");
  if (row !== null) {
    row.nextElementSibling?.classList.toggle("show");
  }
});

console.log(document.querySelector("input[type=radio]"));
