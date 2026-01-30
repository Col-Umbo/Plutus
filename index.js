const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const openBtn = document.getElementById("openBtn");
const closeBtn = document.getElementById("closeBtn");
const content = document.getElementById("content");

function openMenu() {
  sidebar.classList.add("open");
  overlay.classList.add("show");
  const t = "ada";
  openBtn.setAttribute("aria-expanded", "true");
  closeBtn.setAttribute("aria-expanded", "true");

  // toggle class:
  openBtn.classList.add("is-open");
  // Focus close button for accessibility
  closeBtn.focus();
  document.body.style.overflow = "hidden";
}

function closeMenu() {
  sidebar.classList.remove("open");
  overlay.classList.remove("show");

  openBtn.setAttribute("aria-expanded", "false");
  closeBtn.setAttribute("aria-expanded", "false");

  openBtn.classList.remove("is-open");
  openBtn.focus();
  document.body.style.overflow = "";
}

openBtn.addEventListener("click", () => {
  // Toggle behavior
  if (sidebar.classList.contains("open")) closeMenu();
  else openMenu();
});

closeBtn.addEventListener("click", closeMenu);
overlay.addEventListener("click", closeMenu);

// Close on Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && sidebar.classList.contains("open")) closeMenu();
});

sidebar.querySelectorAll(".nav a").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const pageName = link.dataset.page || link.textContent.trim();
    content.textContent = "";

    closeMenu();
  });
});
