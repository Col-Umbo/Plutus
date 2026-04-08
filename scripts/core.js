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
const passwordBtn = document.getElementById("passwordBtn");
const overlay = document.getElementById("passwordOverlay");
const title = document.getElementById("passwordTitle");
const subtitle = document.getElementById("passwordSubtitle");

const setupFields = document.getElementById("passwordSetFields");
const disableFields = document.getElementById("passwordDisableFields");
const unlockFields = document.getElementById("passwordUnlockFields");

const passwordInput = document.getElementById("passwordInput");
const passwordConfirmInput = document.getElementById("passwordConfirmInput");
const passwordDisableInput = document.getElementById("passwordDisableInput");
const passwordUnlockInput = document.getElementById("passwordUnlockInput");

const setupActions = document.getElementById("passwordSetupActions");
const disableActions = document.getElementById("passwordDisableActions");
const unlockActions = document.getElementById("passwordUnlockActions");

const setupSubmitBtn = document.getElementById("passwordSubmit");
const setupCancelBtn = document.getElementById("passwordCancel");
const disableBtn = document.getElementById("passwordDisableBtn");
const disableCancelBtn = document.getElementById("passwordDisableCancel");
const unlockBtn = document.getElementById("passwordUnlockBtn");

const passwordError = document.getElementById("passwordError");
const passwordSuccess = document.getElementById("passwordSuccess");

let passwordOverlayMode = "setup"; // setup | disable | unlock
let appLocked = false;

function clearPasswordMessages() {
  passwordError.textContent = "";
  passwordSuccess.textContent = "";
  passwordError.classList.add("hidden");
  passwordSuccess.classList.add("hidden");
}

function clearPasswordInputs() {
  [passwordInput, passwordConfirmInput, passwordDisableInput, passwordUnlockInput].forEach((el) => {
    if (el) el.value = "";
  });
}

function showPasswordError(message) {
  passwordError.textContent = message;
  passwordError.classList.remove("hidden");
  passwordSuccess.classList.add("hidden");
}

function showPasswordSuccess(message) {
  passwordSuccess.textContent = message;
  passwordSuccess.classList.remove("hidden");
  passwordError.classList.add("hidden");
}

function focusPasswordField() {
  const fieldMap = {
    setup: passwordInput,
    disable: passwordDisableInput,
    unlock: passwordUnlockInput,
  };
  const field = fieldMap[passwordOverlayMode];
  if (field) setTimeout(() => field.focus(), 0);
}

function setPasswordMode(mode) {
  passwordOverlayMode = mode;
  clearPasswordMessages();
  clearPasswordInputs();

  setupFields.classList.toggle("hidden", mode !== "setup");
  disableFields.classList.toggle("hidden", mode !== "disable");
  unlockFields.classList.toggle("hidden", mode !== "unlock");

  setupActions.classList.toggle("hidden", mode !== "setup");
  disableActions.classList.toggle("hidden", mode !== "disable");
  unlockActions.classList.toggle("hidden", mode !== "unlock");

  if (mode === "setup") {
    title.textContent = "Set Password Lock";
    subtitle.textContent = "Create a password to require a lock screen when the application starts.";
  } else if (mode === "disable") {
    title.textContent = "Disable Password Lock";
    subtitle.textContent = "Enter the saved password to turn off the startup password lock.";
  } else {
    title.textContent = "Password Lock";
    subtitle.textContent = "Enter your password to continue to Plutus.";
  }

  focusPasswordField();
}

function openPasswordOverlay(mode) {
  setPasswordMode(mode);
  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden", "false");
}

function closePasswordOverlay(force = false) {
  if (appLocked && !force) return;
  overlay.classList.remove("open");
  overlay.setAttribute("aria-hidden", "true");
  clearPasswordMessages();
  clearPasswordInputs();
}

async function handlePasswordButtonClick() {
  if (!window.handler) return;
  const hasPassword = await window.handler.has_password();
  openPasswordOverlay(hasPassword ? "disable" : "setup");
}

async function handleSetupSubmit() {
  const password = passwordInput.value.trim();
  const confirmPassword = passwordConfirmInput.value.trim();

  if (!password || !confirmPassword) {
    showPasswordError("Please fill in both password fields.");
    return;
  }

  if (password !== confirmPassword) {
    showPasswordError("Passwords do not match.");
    return;
  }

  await window.handler.set_password(password);
  closePasswordOverlay(true);
}

async function handleDisableSubmit() {
  const password = passwordDisableInput.value.trim();

  if (!password) {
    showPasswordError("Please enter the saved password.");
    return;
  }

  const valid = await window.handler.verify_password(password);
  if (!valid) {
    showPasswordError("Incorrect password.");
    return;
  }

  const disabled = await window.handler.disable_password_lock();
  if (!disabled) {
    showPasswordError("Could not disable password lock. Please try again.");
    return;
  }

  closePasswordOverlay(true);
}

async function handleUnlockSubmit() {
  const password = passwordUnlockInput.value.trim();

  if (!password) {
    showPasswordError("Please enter your password.");
    return;
  }

  const valid = await window.handler.verify_password(password);
  if (!valid) {
    showPasswordError("Incorrect password.");
    return;
  }

  appLocked = false;
  closePasswordOverlay(true);
}

passwordBtn?.addEventListener("click", handlePasswordButtonClick);
setupSubmitBtn?.addEventListener("click", handleSetupSubmit);
setupCancelBtn?.addEventListener("click", () => closePasswordOverlay());
disableBtn?.addEventListener("click", handleDisableSubmit);
disableCancelBtn?.addEventListener("click", () => closePasswordOverlay());
unlockBtn?.addEventListener("click", handleUnlockSubmit);

overlay?.addEventListener("click", (e) => {
  if (e.target === overlay && !appLocked) {
    closePasswordOverlay();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && overlay?.classList.contains("open") && !appLocked) {
    closePasswordOverlay();
  }

  if (e.key === "Enter" && overlay?.classList.contains("open")) {
    if (passwordOverlayMode === "setup") handleSetupSubmit();
    else if (passwordOverlayMode === "disable") handleDisableSubmit();
    else if (passwordOverlayMode === "unlock") handleUnlockSubmit();
  }
});

window.addEventListener("load", async () => {
  const waitForHandler = () =>
    new Promise((resolve) => {
      if (window.handler) {
        resolve(window.handler);
        return;
      }
      const timer = setInterval(() => {
        if (window.handler) {
          clearInterval(timer);
          resolve(window.handler);
        }
      }, 50);
    });

  await waitForHandler();
  const hasPassword = await window.handler.has_password();
  if (hasPassword) {
    appLocked = true;
    openPasswordOverlay("unlock");
  }
});