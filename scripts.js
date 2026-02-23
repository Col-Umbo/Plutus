// =============== Utilities ===============
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));




// =============== Back-end Stuff  ===============
function backendAvailable() {
  return !!(window.handler && typeof window.handler.get_expenses === "function");
}

function handlerReady() {
  return new Promise((resolve) => {
    if (backendAvailable()) return resolve(window.handler);
    const t = setInterval(() => {
      if (backendAvailable()) {
        clearInterval(t);
        resolve(window.handler);
      }
    }, 25);
  });
}

// Convert date format for backend
function isoToBackendDate(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-");
  if (!y || !m || !d) return "";
  return `${d}-${m}-${y.slice(2)}`;
}

function backendDateToIso(dmy) {
  if (!dmy) return "";
  const parts = String(dmy).split("-");
  if (parts.length !== 3) return "";
  const [d, m, y2] = parts;
  const yyyy = y2.length === 2 ? `20${y2}` : y2;
  return `${yyyy}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// Promisified Qt WebChannel calls that use callbacks
function callBackend(method, ...args) {
  return handlerReady().then(
    (h) =>
      new Promise((resolve) => {
        h[method](...args, resolve);
      })
  );
}

// Shared caches so Transactions and Categories stay in sync
window.__plutusDbCache = window.__plutusDbCache || {
  categories: { income: [], expense: [] },
  transactions: [],
};

async function refreshCategoriesFromDb() {
  if (!backendAvailable()) return window.__plutusDbCache.categories;

  const expenseRaw = await callBackend("get_expense_categories");
  const incomeRaw = await callBackend("get_income_categories");

  let expense = [];
  let income = [];
  try {
    expense = JSON.parse(expenseRaw || "[]").map((c) => ({ name: c.name, color: c.color, amount: c.amount }));
    income = JSON.parse(incomeRaw || "[]").map((c) => ({ name: c.name, color: c.color, amount: c.amount }));
  } catch {
    expense = [];
    income = [];
  }

  window.__plutusDbCache.categories = { income, expense };
  return window.__plutusDbCache.categories;
}

async function refreshTransactionsFromDb() {
  if (!backendAvailable()) return window.__plutusDbCache.transactions;

  const expensesRaw = await callBackend("get_expenses", "ALL");
  const incomeRaw = await callBackend("get_income", "ALL");

  let expenses = [];
  let income = [];
  try {
    expenses = JSON.parse(expensesRaw || "[]").map((t) => ({
      id: String(t.id),
      createdAt: Date.now(),
      type: "expense",
      amount: Number(t.amount || 0).toFixed(2),
      date: backendDateToIso(t.date),
      category: String(t.categoryName || t.category || "Uncategorized"),
      name: String(t.name || "Transaction"),
      repeats: Boolean(t.recurring),
      repeatEvery: String(t.frequency || ""),
      _backendId: t.id,
    }));
    income = JSON.parse(incomeRaw || "[]").map((t) => ({
      id: String(t.id),
      createdAt: Date.now(),
      type: "income",
      amount: Number(t.amount || 0).toFixed(2),
      date: backendDateToIso(t.date),
      category: String(t.categoryName || t.category || "Uncategorized"),
      name: String(t.name || "Transaction"),
      repeats: Boolean(t.recurring),
      repeatEvery: String(t.frequency || ""),
      _backendId: t.id,
    }));
  } catch {
    expenses = [];
    income = [];
  }

  window.__plutusDbCache.transactions = [...expenses, ...income];
  return window.__plutusDbCache.transactions;
}



// =============== Views / Routing (Switch between tabs) ===============
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



// =============== Theme toggle (Light/Dark) ===============
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
  // label shows what you'll switch to when clicked
  if (themeLabel) themeLabel.textContent = theme === "light" ? "Dark" : "Light";
  updateDockIcons();
}

function getInitialTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;

  const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)")?.matches;
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



// =============== Password Overlay (guarded - not built yet) ===============
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



// =============== Transactions Page ===============
(function initTransactions() {
  // If transactions view isn't in DOM, do nothing
  const openAddModalBtn = $("#openAddModal");
  const modalBackdrop = $("#modalBackdrop");
  const txForm = $("#txForm");
  if (!openAddModalBtn || !modalBackdrop || !txForm) return;

  const STORAGE_TX = "plutus_transactions_v1";
  const STORAGE_BUDGET = "categorized_budget_v1"; // Budget page stores categories here

  // DOM
  const incomeTotalEl = $("#incomeTotal");
  const expenseTotalEl = $("#expenseTotal");
  const txListEl = $("#txList");
  const emptyStateEl = $("#emptyState");

  const closeModalBtn = $("#closeModal");
  const cancelBtn = $("#cancelBtn");

  const txType = $("#txType");
  const txAmount = $("#txAmount");
  const txDate = $("#txDate");
  const txCategory = $("#txCategory");
  const txName = $("#txName");
  const txRepeats = $("#txRepeats");
  const repeatEveryWrap = $("#repeatEveryWrap");
  const repeatEvery = $("#repeatEvery");

  const searchInput = $("#searchInput");
  const pills = $$(".pill");

  let currentFilter = "all"; // all | income | expense

  // DB-backed caches (shared across pages)
  const dbCache = window.__plutusDbCache;
  let txCache = dbCache.transactions;
  let catCache = dbCache.categories;

  const DEFAULT_CATEGORIES = {
    income: ["Paycheck", "Side Hustle", "Refund", "Gift"],
    expense: ["Groceries", "Bills", "Subscriptions", "Entertainment", "Gas", "General Needs"],
  };

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    if (backendAvailable()) return;
    localStorage.setItem(key, JSON.stringify(value));
  }

  function money(n) {
    const v = Number(n || 0);
    return v.toLocaleString(undefined, { style: "currency", currency: "USD" });
  }

  function formatDate(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function uid() {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeType(raw) {
    const t = String(raw ?? "").toLowerCase().trim();
    if (t === "income") return "income";
    // accept "expense", "expenses", "exp"
    if (t === "expense" || t === "expenses" || t === "exp") return "expense";
    return "expense"; // default
  }

  function normalizeTx(tx) {
    // tolerate older/other property names too
    const type = normalizeType(tx?.type ?? tx?.txType ?? tx?.kind);

    return {
      id: tx?.id ?? uid(),
      createdAt: Number(tx?.createdAt ?? Date.now()),
      type,
      amount: Number(tx?.amount ?? tx?.amt ?? 0).toFixed(2),
      date: String(tx?.date ?? ""),
      category: String(tx?.category ?? tx?.cat ?? "Uncategorized"),
      name: String(tx?.name ?? tx?.txName ?? tx?.title ?? "Transaction"),
      repeats: Boolean(tx?.repeats),
      repeatEvery: String(tx?.repeatEvery ?? ""),
    };
  }


  // Save and load transactions
  function loadTransactions() {
    // If backend is available, use the in-memory DB cache
    if (backendAvailable()) return Array.isArray(txCache) ? txCache : [];

    const raw = readJSON(STORAGE_TX, []);
    if (!Array.isArray(raw)) return [];

    // normalize everything so filters/search (should) always work
    const normalized = raw.map(normalizeTx);

    // write back normalized data once to “fix” old entries
    writeJSON(STORAGE_TX, normalized);

    return normalized;
  }

  function saveTransactions(list) {
    if (backendAvailable()) {
      txCache = Array.isArray(list) ? list : [];
      dbCache.transactions = txCache;
      return;
    }
    writeJSON(STORAGE_TX, list);
  }

  // Create categories in the transaction modal dropdown
  function populateCategories() {
    if (!txCategory) return;

    const type = txType.value; // income | expense
    txCategory.innerHTML = "";

    // Backend mode: use DB categories cache
    if (backendAvailable()) {
      const list = (catCache && catCache[type]) ? catCache[type] : [];
      const names = list.length ? list.map((c) => c.name) : (DEFAULT_CATEGORIES[type] || []);

      for (const name of names) {
        if (!name) continue;
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        txCategory.appendChild(opt);
      }
      return;
    }

    // Fallback (for browser-only): read categories from localStorage budget state
    const budget = readJSON(STORAGE_BUDGET, null);
    const fallback = DEFAULT_CATEGORIES[type] || [];
    const rawList = budget?.[type] ?? fallback;

    for (const item of rawList) {
      const name = typeof item === "string" ? item : item?.name;
      if (!name) continue;

      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      txCategory.appendChild(opt);
    }
  }

  // Compute totals for expenses and income sections in Transactions page
  function computeTotals(transactions) {
    let income = 0;
    let expense = 0;
    for (const t of transactions) {
      const amt = Number(t.amount || 0);
      if (t.type === "income") income += amt;
      else expense += amt;
    }
    return { income, expense };
  }

  // Filter scripts
  function matchesFilter(t) {
    if (currentFilter === "all") return true;
    return t.type === currentFilter;
  }

  function matchesSearch(t, q) {
    if (!q) return true;
    const hay = `${t.name} ${t.category} ${t.type}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  }

  function openModal() {
    modalBackdrop.classList.remove("hidden");
    modalBackdrop.setAttribute("aria-hidden", "false");

    // default date = today
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    if (!txDate.value) txDate.value = `${yyyy}-${mm}-${dd}`;

    txAmount.focus();
  }

  function closeModal() {
    modalBackdrop.classList.add("hidden");
    modalBackdrop.setAttribute("aria-hidden", "true");
    txForm.reset();
    repeatEveryWrap.classList.add("hidden");
    populateCategories();
  }

  // Delete transaction from modal and databse when user presses the delete icon
  async function deleteTransaction(id) {
    if (backendAvailable()) {
      const t = (txCache || []).find((x) => String(x.id) === String(id));
      if (t) {
        const h = await handlerReady();
        if (t.type === "income" && typeof h.delete_income === "function") {
          h.delete_income(parseInt(t._backendId ?? t.id, 10));
        } else if (t.type === "expense" && typeof h.delete_expense === "function") {
          h.delete_expense(parseInt(t._backendId ?? t.id, 10));
        }
      }
      txCache = await refreshTransactionsFromDb();
      dbCache.transactions = txCache;
      render();
      return;
    }

    const list = loadTransactions();
    const next = list.filter((t) => t.id !== id);
    saveTransactions(next);
    render();
  }

  function render() {
    const transactions = loadTransactions();

    const totals = computeTotals(transactions);
    if (incomeTotalEl) incomeTotalEl.textContent = money(totals.income);
    if (expenseTotalEl) expenseTotalEl.textContent = money(totals.expense);

    const q = (searchInput?.value || "").trim();
    const filtered = transactions
      .filter(matchesFilter)
      .filter((t) => matchesSearch(t, q))
      .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt - a.createdAt));

    txListEl.innerHTML = "";

    if (emptyStateEl) {
      emptyStateEl.style.display = filtered.length === 0 ? "block" : "none";
    }

    for (const t of filtered) {
      const li = document.createElement("li");
      li.className = "tx-item";

      const date = document.createElement("div");
      date.className = "date muted";
      date.textContent = formatDate(t.date);

      const name = document.createElement("div");
      name.className = "name";
      name.innerHTML = `
        <div style="font-weight:700">${escapeHtml(t.name)}</div>
        <div class="muted">${t.repeats ? `Repeats: ${escapeHtml(t.repeatEvery)}` : "One-time"}</div>
      `;

      const cat = document.createElement("div");
      cat.className = "cat";
      cat.innerHTML = `<span class="badge"><span class="dot"></span>${escapeHtml(t.category)}</span>`;

      const amt = document.createElement("div");
      amt.className = `amount ${t.type}`;
      amt.textContent = money(Math.abs(Number(t.amount)));

      const actions = document.createElement("div");
      actions.className = "actions";

      const del = document.createElement("button");
      del.className = "delete-btn";
      del.type = "button";
      del.title = "Delete";
      del.classList.add("delete-btn");
      del.innerHTML = `
  <img class="tableIcon"
       src="Icons/delete_dark-mode.png"
       data-dark="Icons/delete_dark-mode.png"
       data-light="Icons/delete_light-mode.png"
       alt="Delete" />
`;
      del.addEventListener("click", () => deleteTransaction(t.id));

      actions.appendChild(del);

      const repeat = document.createElement("div");
      repeat.className = "repeat muted";
      repeat.textContent = t.repeats ? `Repeats: ${t.repeatEvery}` : "";

      li.append(date, name, cat, amt, actions, repeat);
      txListEl.appendChild(li);
    }
  }

  // Events
  openAddModalBtn.addEventListener("click", () => {
    populateCategories();
    openModal();
  });

  closeModalBtn?.addEventListener("click", closeModal);
  cancelBtn?.addEventListener("click", closeModal);

  modalBackdrop.addEventListener("click", (e) => {
    if (e.target === modalBackdrop) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modalBackdrop.classList.contains("hidden")) closeModal();
  });

  txType.addEventListener("change", populateCategories);

  txRepeats.addEventListener("change", () => {
    if (txRepeats.checked) repeatEveryWrap.classList.remove("hidden");
    else repeatEveryWrap.classList.add("hidden");
  });

  txForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const amount = Number(txAmount.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Please enter a valid amount greater than 0.");
      return;
    }

    const date = txDate.value;
    const type = txType.value;
    const category = txCategory.value;
    const name = txName.value.trim();

    // all fields need to be filled out
    if (!date || !category || !name) {
      alert("Please fill out all required fields.");
      return;
    }

    const repeats = txRepeats.checked;
    const repeatEveryVal = repeats ? repeatEvery.value : "";

    const list = loadTransactions();
    list.push({
      id: uid(),
      createdAt: Date.now(),
      type,
      amount: amount.toFixed(2),
      date,
      category,
      name,
      repeats,
      repeatEvery: repeatEveryVal,
    });
    saveTransactions(list);

    closeModal();
    render();
  });

  pills.forEach((btn) => {
    btn.addEventListener("click", () => {
      pills.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      render();
    });
  });

  searchInput?.addEventListener("input", render);

  // When categories change on the Categories page, refresh dropdown + re-render
  window.addEventListener("plutus:categories-updated", async () => {
    if (!backendAvailable()) return;
    catCache = await refreshCategoriesFromDb();
    dbCache.categories = catCache;
    populateCategories();
    render();
  });

  // Init
  (async function init() {
    if (backendAvailable()) {
      // Pull fresh DB state once on load
      catCache = await refreshCategoriesFromDb();
      dbCache.categories = catCache;
      txCache = await refreshTransactionsFromDb();
      dbCache.transactions = txCache;
    }
    populateCategories();
    render();
  })();
})();




// =============== Budget Page (guarded - not built yet) ===============
(function initBudgetIfPresent() {
  // If your budget DOM isn't present (it’s “Coming Soon”), do nothing.
  const chartCanvas = $("#budgetChart");
  const categoryForm = $("#categoryForm");
  const itemForm = $("#itemForm");
  if (!chartCanvas && !categoryForm && !itemForm) return;
})();



// =============== Categories Page ===============
(function initCategories() {
  const openBtn = $("#openCatModal");
  const backdrop = $("#catModalBackdrop");
  const form = $("#catForm");
  if (!openBtn || !backdrop || !form) return;

  const STORAGE_BUDGET = "categorized_budget_v1"; // shared with Transactions

  // DOM
  const catIncomeTotalEl = $("#catIncomeTotal");
  const catExpenseTotalEl = $("#catExpenseTotal");
  const listEl = $("#catList");
  const emptyEl = $("#catEmptyState");

  const closeBtn = $("#closeCatModal");
  const cancelBtn = $("#catCancelBtn");

  const catTypeEl = $("#catType");
  const catColorEl = $("#catColor");
  const catNameEl = $("#catName");

  const searchInput = $("#catSearchInput");
  const pills = $$(".cat-pill");

  let currentFilter = "all"; // all --> income & expense standard

  // DB-backed caches (shared across pages)
  const dbCache = window.__plutusDbCache;
  let txCache = dbCache.transactions;
  let catCache = dbCache.categories;

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function normalizeBudgetShape(budget) {
    // Accept older format: { income: ["Paycheck"], expense: ["Groceries"] }
    // Convert to: { income: [{name,color}], expense: [{name,color}] }
    const out = { income: [], expense: [] };

    for (const type of ["income", "expense"]) {
      const arr = Array.isArray(budget?.[type]) ? budget[type] : [];
      out[type] = arr
        .map((item) => {
          if (typeof item === "string") return { name: item, color: type === "income" ? "#22c55e" : "#fb7185" };
          if (item && typeof item === "object" && item.name) return { name: String(item.name), color: String(item.color || "#94a3b8") };
          return null;
        })
        .filter(Boolean);
    }

    return out;
  }

  function loadBudget() {
    if (backendAvailable()) {
      // Keep the same shape the UI expects: { income:[{name,color}], expense:[{name,color}] }
      const income = Array.isArray(catCache?.income) ? catCache.income.map((c) => ({ name: c.name, color: c.color })) : [];
      const expense = Array.isArray(catCache?.expense) ? catCache.expense.map((c) => ({ name: c.name, color: c.color })) : [];
      return {
        income: income.length ? income : [{ name: "Paycheck", color: "#22c55e" }],
        expense: expense.length ? expense : [{ name: "Groceries", color: "#fb7185" }],
      };
    }

    const raw = readJSON(STORAGE_BUDGET, null);
    const normalized = normalizeBudgetShape(raw);

    // Write back once so everything stays consistent going forward
    writeJSON(STORAGE_BUDGET, normalized);

    return normalized;
  }

  function openModal() {
    backdrop.classList.remove("hidden");
    backdrop.setAttribute("aria-hidden", "false");
    catNameEl.focus();
  }

  function closeModal() {
    backdrop.classList.add("hidden");
    backdrop.setAttribute("aria-hidden", "true");
    form.reset();
  }

  function counts(budget) {
    return {
      income: budget.income.length,
      expense: budget.expense.length,
    };
  }

  function matchesFilter(item) {
    if (currentFilter === "all") return true;
    return item.type === currentFilter;
  }

  function matchesSearch(item, q) {
    if (!q) return true;
    return item.name.toLowerCase().includes(q.toLowerCase());
  }

  async function removeCategory(type, name) {
    if (backendAvailable()) {
      const h = await handlerReady();
      const isIncome = type === "income";
      if (typeof h.delete_category === "function") {
        h.delete_category(isIncome, name);
      }
      catCache = await refreshCategoriesFromDb();
      dbCache.categories = catCache;

      // Let the Transactions page know the category list changed
      window.dispatchEvent(new CustomEvent("plutus:categories-updated"));

      render();
      return;
    }

    const budget = loadBudget();
    budget[type] = budget[type].filter((c) => c.name.toLowerCase() !== name.toLowerCase());
    writeJSON(STORAGE_BUDGET, budget);
    render();
  }

  function render() {
    const budget = loadBudget();
    const c = counts(budget);

    if (catIncomeTotalEl) catIncomeTotalEl.textContent = String(c.income);
    if (catExpenseTotalEl) catExpenseTotalEl.textContent = String(c.expense);

    const q = (searchInput?.value || "").trim();

    // flatten for display
    const flat = [
      ...budget.income.map((x) => ({ ...x, type: "income" })),
      ...budget.expense.map((x) => ({ ...x, type: "expense" })),
    ];

    const filtered = flat
      .filter(matchesFilter)
      .filter((x) => matchesSearch(x, q))
      .sort((a, b) => a.name.localeCompare(b.name));

    listEl.innerHTML = "";

    if (emptyEl) emptyEl.style.display = filtered.length === 0 ? "block" : "none";

    for (const item of filtered) {
      const li = document.createElement("li");
      li.className = "cat-item";

      const type = document.createElement("div");
      type.innerHTML = `<span class="cat-type-badge">${item.type === "income" ? "Income" : "Expense"}</span>`;

      const name = document.createElement("div");
      name.className = "name";
      name.style.fontWeight = "700";
      name.textContent = item.name;

      const color = document.createElement("div");
      color.className = "cat-swatch";
      color.innerHTML = `<span class="dot" style="background:${item.color}"></span><span class="muted">${item.color}</span>`;

      const actions = document.createElement("div");
      actions.className = "cat-actions";

      const del = document.createElement("button");
      del.className = "delete-btn";
      del.type = "button";
      del.title = "Delete";
      del.innerHTML = `
      <img class="tableIcon"
        src="Icons/delete_dark-mode.png"
        data-dark="Icons/delete_dark-mode.png"
        data-light="Icons/delete_light-mode.png"
        alt="Delete" />
      `;
      del.addEventListener("click", () => removeCategory(item.type, item.name));
      actions.appendChild(del);
      li.append(type, name, color, actions);
      listEl.appendChild(li);
    }
    updateDockIcons();
  }

  // Events
  openBtn.addEventListener("click", openModal);

  closeBtn?.addEventListener("click", closeModal);
  cancelBtn?.addEventListener("click", closeModal);

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !backdrop.classList.contains("hidden")) closeModal();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const type = catTypeEl.value; // income|expense
    const name = catNameEl.value.trim();
    const color = catColorEl.value;

    if (!name) {
      alert("Please enter a category name.");
      return;
    }

    const budget = loadBudget();
    const exists = budget[type].some((c) => c.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      alert("That category already exists.");
      return;
    }

    if (backendAvailable()) {
      const h = await handlerReady();
      const isIncome = type === "income";
      // amount isn't part of the Categories UI yet; store 0 for now
      h.add_category(isIncome, name, 0.0, color);

      catCache = await refreshCategoriesFromDb();
      dbCache.categories = catCache;

      window.dispatchEvent(new CustomEvent("plutus:categories-updated"));

      closeModal();
      render();
      return;
    }

    // Browser-only fallback
    budget[type].push({ name, color });
    writeJSON(STORAGE_BUDGET, budget);

    closeModal();
    render();
  });

  pills.forEach((btn) => {
    btn.addEventListener("click", () => {
      pills.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      render();
    });
  });

  searchInput?.addEventListener("input", render);

  // Init
  (async function init() {
    if (backendAvailable()) {
      catCache = await refreshCategoriesFromDb();
      dbCache.categories = catCache;
    }
    render();
  })();
})();
