const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const openBtn = document.getElementById("openBtn");
const closeBtn = document.getElementById("closeBtn");

import clearDiv from "./functions/clearDiv.js";

import homePage from "./page/homePage.js";
import logEntry from "./page/logEntry.js";
import budgetPage from "./page/budget.js";
import whatIfPage from "./page/whatIf.js";
import goalPage from "./page/goal.js";

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

    // NEW ****************************************************** DELETE WHENEVER
    clearDiv.unrender();
    if (pageName === "Home") {
      homePage.render();
    } else if (pageName === "LogEntry") {
      logEntry.render();
    } else if (pageName === "Budget") {
      budgetPage.render();
    } else if (pageName === "WhatIf") {
      whatIfPage.render();
    } else if (pageName === "Goals") {
      goalPage.render();
    }

    closeMenu();
  });
});
