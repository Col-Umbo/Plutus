// =============== Utilities ===============
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));



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
  document.querySelectorAll(".dockIcon").forEach((icon) => {
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

  function loadTransactions() {
    const raw = readJSON(STORAGE_TX, []);
    if (!Array.isArray(raw)) return [];

    // normalize everything so filters/search always work
    const normalized = raw.map(normalizeTx);

    // optional: write back normalized data once to “fix” old entries permanently
    writeJSON(STORAGE_TX, normalized);

    return normalized;
  }

  function saveTransactions(list) {
    writeJSON(STORAGE_TX, list);
  }

  function getCategoriesFromBudgetState() {
    // Budget storage is { categories: [{id,type,name,color,...}], items: [...] }
    const budgetState = readJSON(STORAGE_BUDGET, null);
    if (!budgetState?.categories?.length) return DEFAULT_CATEGORIES;

    const income = budgetState.categories
      .filter((c) => c.type === "income")
      .map((c) => c.name)
      .filter(Boolean);

    const expense = budgetState.categories
      .filter((c) => c.type === "expense")
      .map((c) => c.name)
      .filter(Boolean);

    return {
      income: income.length ? income : DEFAULT_CATEGORIES.income,
      expense: expense.length ? expense : DEFAULT_CATEGORIES.expense,
    };
  }

  // Create categories
  function populateCategories() {
    if (!txCategory) return;

    const type = txType.value; // income | expense
    txCategory.innerHTML = "";

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

  function deleteTransaction(id) {
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
      del.className = "icon-btn";
      del.type = "button";
      del.title = "Delete";
      del.textContent = "🗑";
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

  txForm.addEventListener("submit", (e) => {
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

  // Init
  populateCategories();
  render();
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

  let currentFilter = "all"; // all | income | expense

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

  function removeCategory(type, name) {
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
      del.className = "icon-btn";
      del.type = "button";
      del.title = "Delete";
      del.textContent = "🗑";
      del.addEventListener("click", () => removeCategory(item.type, item.name));

      actions.appendChild(del);
      li.append(type, name, color, actions);
      listEl.appendChild(li);
    }
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

  form.addEventListener("submit", (e) => {
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
  render();
})();
