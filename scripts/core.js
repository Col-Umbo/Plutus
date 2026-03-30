// ==================== Utilities ====================
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// ==================== Views / Routing (Switch between tabs) ====================
const views = {
  home: $("#view-home"),
  transactions: $("#view-transactions"),
  budget: $("#view-budget"),
  categories: $("#view-categories"),
  goals: $("#view-goals"),
};

const dockButtons = $$(".dockBtn");

function setActiveView(key, { push = true } = {}) {
  if (!views[key]) key = "home";

  Object.entries(views).forEach(([k, el]) => {
    if (!el) return;
    el.classList.toggle("active", k === key);
  });

  dockButtons.forEach((btn) => {
    const isActive = btn.dataset.target === key;
    btn.classList.toggle("active", isActive);
    if (isActive) btn.setAttribute("aria-current", "page");
    else btn.removeAttribute("aria-current");
  });

  if (push) history.pushState({ key }, "", `#${key}`);
}

dockButtons.forEach((btn) => {
  btn.addEventListener("click", () => setActiveView(btn.dataset.target));
});

window.addEventListener("popstate", (e) => {
  const key = (e.state && e.state.key) || (location.hash || "#home").slice(1);
  setActiveView(key, { push: false });
});

const initial = (location.hash || "#home").slice(1);
history.replaceState({ key: initial }, "", `#${initial}`);
setActiveView(initial, { push: false });

// ==================== Theme toggle (Light/Dark) ====================
const themeToggleBtn = $("#themeToggleBtn");
const themeLabel = $("#themeLabel");
const THEME_KEY = "theme_preference"; // "light" | "dark"

function updateDockIcons() {
  const isLight = document.body.classList.contains("light");
  document.querySelectorAll(".dockIcon, .tableIcon").forEach((icon) => {
    const isLight = document.body.classList.contains("light");
    const newSrc = isLight ? icon.dataset.light : icon.dataset.dark;
    if (newSrc) icon.src = newSrc;
  });
}

function applyTheme(theme) {
  document.body.classList.toggle("light", theme === "light");
  document.documentElement.classList.toggle("light", theme === "light");
  // label shows what you'll switch to when clicked
  if (themeLabel) themeLabel.textContent = theme === "light" ? "Dark" : "Light";
  updateDockIcons();
}

function getInitialTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;

  const prefersLight = window.matchMedia?.(
    "(prefers-color-scheme: light)",
  )?.matches;
  return prefersLight ? "light" : "dark";
}

let currentTheme = getInitialTheme();
applyTheme(currentTheme);

themeToggleBtn?.addEventListener("click", () => {
  currentTheme = document.body.classList.contains("light") ? "dark" : "light";
  localStorage.setItem(THEME_KEY, currentTheme);
  applyTheme(currentTheme);
});

document.addEventListener("DOMContentLoaded", updateDockIcons);

// ==================== Password Overlay (guarded - not built yet) ====================
(function initPasswordOverlay() {
  const overlay = $("#overlay");
  const passwordBtn = $("#passwordBtn");
  if (!overlay || !passwordBtn) return;

  const open = () => overlay.classList.add("open");
  const close = () => overlay.classList.remove("open");

  passwordBtn.addEventListener("click", open);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("open")) close();
  });
})();
