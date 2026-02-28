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
    expense: [
      "Groceries",
      "Bills",
      "Subscriptions",
      "Entertainment",
      "Gas",
      "General Needs",
    ],
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
    return dt.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
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
    const t = String(raw ?? "")
      .toLowerCase()
      .trim();
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
    window.dispatchEvent(new CustomEvent("plutus:transactions-updated"));
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
      .sort(
        (a, b) =>
          (b.date || "").localeCompare(a.date || "") ||
          b.createdAt - a.createdAt,
      );

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

      // Make the amount turn red if transaction goes over budget
      const budgetState = (function () {
        try {
          const raw = localStorage.getItem("plutus_budget_v1");
          const s = raw ? JSON.parse(raw) : null;
          const overall = Math.max(0, Number(s?.overall ?? 0) || 0);
          const allocations = Array.isArray(s?.allocations)
            ? s.allocations
            : [];
          return {
            overall,
            allocations: allocations
              .map((a) => ({
                category: String(a?.category ?? "").trim(),
                limit: Math.max(0, Number(a?.limit ?? 0) || 0),
              }))
              .filter((a) => a.category),
          };
        } catch {
          return { overall: 0, allocations: [] };
        }
      })();

      const allocLimitMap = new Map(
        budgetState.allocations.map((a) => [a.category.toLowerCase(), a.limit]),
      );
      const spentByCat = new Map();

      for (const tx of transactions) {
        if (String(tx?.type).toLowerCase() !== "expense") continue;
        const amt = Math.abs(Number(tx?.amount ?? 0) || 0);
        const catKey = String(tx?.category ?? "Uncategorized").toLowerCase();
        if (allocLimitMap.has(catKey)) {
          spentByCat.set(catKey, (spentByCat.get(catKey) || 0) + amt);
        }
      }

      const overspentCats = new Set();
      for (const [catKey, spent] of spentByCat.entries()) {
        const limit = allocLimitMap.get(catKey) || 0;
        if (limit > 0 && spent > limit) overspentCats.add(catKey);
      }

      // Inside the transaction loop, replace amt creation with:
      const amt = document.createElement("div");
      const isOver =
        String(t.type).toLowerCase() === "expense" &&
        overspentCats.has(String(t.category || "").toLowerCase());

      amt.className = `amount ${t.type}${isOver ? " over-budget" : ""}`;
      amt.textContent = money(Math.abs(Number(t.amount)));
      // end

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
    if (e.key === "Escape" && !modalBackdrop.classList.contains("hidden"))
      closeModal();
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

// =============== Budget Page ===============
(function initBudget() {
  const pieCanvas = document.querySelector("#budgetPie");
  const overallForm = document.querySelector("#overallBudgetForm");
  const overallInput = document.querySelector("#overallBudgetInput");
  const overallEditBtn = document.querySelector("#overallBudgetEditBtn");
  const overallStatus = document.querySelector("#budgetOverallStatus");
  const overallWarn = document.querySelector("#budgetOverallWarn");

  const allocForm = document.querySelector("#allocationForm");
  const allocCategory = document.querySelector("#allocationCategory");
  const allocLimit = document.querySelector("#allocationLimit");
  const allocRemaining = document.querySelector("#allocateRemaining");
  const allocWarn = document.querySelector("#budgetAllocWarn");
  const remainingToAllocateEl = document.querySelector("#remainingToAllocate");

  const allocatedEl = document.querySelector("#budgetAllocated");
  const unallocatedEl = document.querySelector("#budgetUnallocated");
  const unallocatedSpentEl = document.querySelector("#budgetUnallocatedSpent");

  const listEl = document.querySelector("#budgetList");
  const emptyEl = document.querySelector("#budgetEmptyState");

  // If budget DOM not present, do nothing.
  if (!pieCanvas || !overallForm || !allocForm || !listEl) return;

  const STORAGE_TX = "plutus_transactions_v1";
  const STORAGE_CATEGORIES = "categorized_budget_v1"; // your Categories page storage
  const STORAGE_BUDGET = "plutus_budget_v1"; // NEW: budget state

  let pieChart = null;

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
    const num = Number(n || 0);
    return num.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
    });
  }
  function showWarn(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
  }
  function hideWarn(el) {
    if (!el) return;
    el.textContent = "";
    el.classList.add("hidden");
  }

  function loadCategories() {
    // We only allow allocating EXPENSE categories
    const cats = readJSON(STORAGE_CATEGORIES, { income: [], expense: [] });
    const expense = Array.isArray(cats?.expense) ? cats.expense : [];
    // normalize to {name,color}
    return expense
      .map((x) => {
        if (typeof x === "string") return { name: x, color: "#94a3b8" };
        if (x && typeof x === "object" && x.name)
          return { name: String(x.name), color: String(x.color || "#94a3b8") };
        return null;
      })
      .filter(Boolean);
  }

  function normalizeBudgetState(state) {
    const overall = Math.max(0, Number(state?.overall ?? 0) || 0);
    const allocations = Array.isArray(state?.allocations)
      ? state.allocations
      : [];
    const cleaned = allocations
      .map((a) => {
        const category = String(a?.category ?? "").trim();
        const limit = Math.max(0, Number(a?.limit ?? 0) || 0);
        if (!category) return null;
        return { category, limit };
      })
      .filter(Boolean);

    // de-dupe by category (case-insensitive), keep first
    const seen = new Set();
    const deduped = [];
    for (const a of cleaned) {
      const k = a.category.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      deduped.push(a);
    }

    return { overall, allocations: deduped };
  }

  function loadBudgetState() {
    const raw = readJSON(STORAGE_BUDGET, null);
    const normalized = normalizeBudgetState(raw);
    writeJSON(STORAGE_BUDGET, normalized);
    return normalized;
  }

  function saveBudgetState(next) {
    const normalized = normalizeBudgetState(next);
    writeJSON(STORAGE_BUDGET, normalized);
    // Let other parts of the app know budget changed
    window.dispatchEvent(new CustomEvent("plutus:budget-updated"));
  }

  function loadTransactions() {
    const tx = readJSON(STORAGE_TX, []);
    return Array.isArray(tx) ? tx : [];
  }

  function computeSpending(budgetState) {
    const tx = loadTransactions();
    const allocMap = new Map(
      (budgetState.allocations || []).map((a) => [
        a.category.toLowerCase(),
        a.limit,
      ]),
    );

    const spentByCat = new Map();
    let unallocatedSpent = 0;

    for (const t of tx) {
      const type = String(t?.type ?? "").toLowerCase();
      if (type !== "expense") continue;

      const amt = Math.abs(Number(t?.amount ?? 0) || 0);
      const cat = String(t?.category ?? "Uncategorized").trim();
      const key = cat.toLowerCase();

      if (allocMap.has(key)) {
        spentByCat.set(key, (spentByCat.get(key) || 0) + amt);
      } else {
        unallocatedSpent += amt;
      }
    }

    return { spentByCat, unallocatedSpent };
  }

  function allocatedTotal(budgetState) {
    return (budgetState.allocations || []).reduce(
      (sum, a) => sum + (Number(a.limit) || 0),
      0,
    );
  }

  function remainingToAllocate(budgetState) {
    return Math.max(0, budgetState.overall - allocatedTotal(budgetState));
  }

  function rebuildCategorySelect() {
    const cats = loadCategories();
    const state = loadBudgetState();
    const allocated = new Set(
      (state.allocations || []).map((a) => a.category.toLowerCase()),
    );

    allocCategory.innerHTML = "";
    const available = cats.filter((c) => !allocated.has(c.name.toLowerCase()));

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = available.length
      ? "Select a category…"
      : "No available categories";
    placeholder.disabled = true;
    placeholder.selected = true;
    allocCategory.appendChild(placeholder);

    for (const c of available) {
      const opt = document.createElement("option");
      opt.value = c.name;
      opt.textContent = c.name;
      allocCategory.appendChild(opt);
    }
  }

  function renderPie(state) {
    const cats = loadCategories();
    const colorMap = new Map(cats.map((c) => [c.name.toLowerCase(), c.color]));

    const labels = [];
    const data = [];
    const colors = [];

    for (const a of state.allocations) {
      labels.push(a.category);
      data.push(a.limit);
      colors.push(colorMap.get(a.category.toLowerCase()) || "#94a3b8");
    }

    const unalloc = remainingToAllocate(state);
    if (unalloc > 0) {
      labels.push("Unallocated");
      data.push(unalloc);
      colors.push("#64748b");
    }

    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pieCanvas.getContext("2d"), {
      type: "pie",
      data: { labels, datasets: [{ data, backgroundColor: colors }] },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${money(ctx.raw)}`,
            },
          },
        },
      },
    });
  }

  function renderList(state) {
    const cats = loadCategories();
    const colorMap = new Map(cats.map((c) => [c.name.toLowerCase(), c.color]));
    const { spentByCat, unallocatedSpent } = computeSpending(state);

    listEl.innerHTML = "";

    const unallocLimit = remainingToAllocate(state);
    const allocTotal = allocatedTotal(state);

    if (allocatedEl) allocatedEl.textContent = money(allocTotal);
    if (unallocatedEl) unallocatedEl.textContent = money(unallocLimit);
    if (unallocatedSpentEl)
      unallocatedSpentEl.textContent = money(unallocatedSpent);

    if (remainingToAllocateEl)
      remainingToAllocateEl.textContent = money(unallocLimit);

    if (emptyEl)
      emptyEl.style.display = state.allocations.length === 0 ? "block" : "none";

    function makeRow({ name, limit, spent, isUnallocated }) {
      const remaining = limit - spent;
      const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
      const over = spent > limit && limit > 0;

      const li = document.createElement("li");
      li.className = `budget-row ${over ? "over" : ""}`;

      const nameCell = document.createElement("div");
      nameCell.className = "budget-name";
      nameCell.innerHTML = `
        <div class="budget-title">${name}</div>
        <div class="budget-bar" aria-hidden="true"><div class="fill"></div></div>
      `;

      const fill = nameCell.querySelector(".fill");
      if (fill) {
        fill.style.width = `${pct}%`;
        if (!isUnallocated) {
          fill.style.background =
            colorMap.get(name.toLowerCase()) || "rgba(34, 197, 94, .75)";
        }
      }

      const limitCell = document.createElement("div");
      limitCell.className = "budget-limit";
      limitCell.textContent = money(limit);

      const spentCell = document.createElement("div");
      spentCell.className = "budget-spent";
      spentCell.textContent = money(spent);

      const remainingCell = document.createElement("div");
      remainingCell.className = "budget-remaining";
      remainingCell.textContent = money(Math.max(0, remaining));

      const actCell = document.createElement("div");
      actCell.className = "actions";

      if (!isUnallocated) {
        const del = document.createElement("button");
        del.className = "delete-btn";
        del.type = "button";
        del.title = "Remove allocation";
        del.innerHTML = `
          <img class="tableIcon"
               src="Icons/delete_dark-mode.png"
               data-dark="Icons/delete_dark-mode.png"
               data-light="Icons/delete_light-mode.png"
               alt="Delete" />
        `;
        del.addEventListener("click", () => {
          const next = loadBudgetState();
          next.allocations = next.allocations.filter(
            (a) => a.category.toLowerCase() !== name.toLowerCase(),
          );
          saveBudgetState(next);
          render();
        });
        actCell.appendChild(del);
      }

      li.append(nameCell, limitCell, spentCell, remainingCell, actCell);
      listEl.appendChild(li);
    }

    // Allocations
    for (const a of state.allocations) {
      const spent = spentByCat.get(a.category.toLowerCase()) || 0;
      makeRow({
        name: a.category,
        limit: a.limit,
        spent,
        isUnallocated: false,
      });
    }

    // Unallocated bucket row (tracks spending with categories NOT in allocations)
    if (state.overall > 0) {
      makeRow({
        name: "Unallocated",
        limit: unallocLimit,
        spent: unallocatedSpent,
        isUnallocated: true,
      });
    }
  }

  function render() {
    hideWarn(overallWarn);
    hideWarn(allocWarn);

    const state = loadBudgetState();

    // overall UI status
    if (overallStatus) {
      overallStatus.textContent =
        state.overall > 0 ? `Current: ${money(state.overall)}` : "Not set yet";
    }

    // keep input enabled only when editing / not set
    if (state.overall > 0 && !overallInput.dataset.editing) {
      overallInput.value = state.overall.toFixed(2);
      overallInput.disabled = true;
    } else {
      overallInput.disabled = false;
      if (!overallInput.value && state.overall > 0)
        overallInput.value = state.overall.toFixed(2);
    }

    rebuildCategorySelect();
    renderPie(state);
    renderList(state);

    // remaining checkbox behavior
    const rem = remainingToAllocate(state);
    allocRemaining.disabled = rem <= 0;
    if (rem <= 0) allocRemaining.checked = false;
  }

  // Events: Overall Budget save
  overallForm.addEventListener("submit", (e) => {
    e.preventDefault();
    hideWarn(overallWarn);

    const val = Math.max(0, Number(overallInput.value || 0));
    if (!Number.isFinite(val) || val <= 0) {
      showWarn(
        overallWarn,
        "Please enter a valid overall monthly budget greater than 0.",
      );
      return;
    }

    const state = loadBudgetState();
    const allocTotal = allocatedTotal(state);

    if (allocTotal > val) {
      showWarn(
        overallWarn,
        `Your current allocations total ${money(allocTotal)}, which is higher than ${money(val)}. Reduce allocations first.`,
      );
      return;
    }

    state.overall = val;
    saveBudgetState(state);

    overallInput.dataset.editing = "";
    overallInput.disabled = true;

    render();
  });

  overallEditBtn?.addEventListener("click", () => {
    overallInput.dataset.editing = "1";
    overallInput.disabled = false;
    overallInput.focus();
    overallInput.select();
  });

  // Allocate remaining checkbox
  allocRemaining.addEventListener("change", () => {
    const state = loadBudgetState();
    const rem = remainingToAllocate(state);
    if (allocRemaining.checked && rem > 0) {
      allocLimit.value = rem.toFixed(2);
    }
  });

  // Add allocation
  allocForm.addEventListener("submit", (e) => {
    e.preventDefault();
    hideWarn(allocWarn);

    const state = loadBudgetState();
    if (state.overall <= 0) {
      showWarn(allocWarn, "Set your overall monthly budget first.");
      return;
    }

    const category = String(allocCategory.value || "").trim();
    if (!category) {
      showWarn(allocWarn, "Pick a category.");
      return;
    }

    const limit = Math.max(0, Number(allocLimit.value || 0));
    if (!Number.isFinite(limit) || limit <= 0) {
      showWarn(allocWarn, "Enter a valid category limit greater than 0.");
      return;
    }

    const rem = remainingToAllocate(state);
    if (limit > rem + 1e-9) {
      showWarn(
        allocWarn,
        `That would exceed your overall budget. Remaining to allocate is ${money(rem)}.`,
      );
      return;
    }

    const exists = state.allocations.some(
      (a) => a.category.toLowerCase() === category.toLowerCase(),
    );
    if (exists) {
      showWarn(allocWarn, "That category is already allocated.");
      return;
    }

    state.allocations.push({ category, limit });
    saveBudgetState(state);

    // reset form bits
    allocForm.reset();
    render();
  });

  // Re-render when other tabs modify things
  window.addEventListener("storage", (e) => {
    if ([STORAGE_CATEGORIES, STORAGE_TX, STORAGE_BUDGET].includes(e.key)) {
      render();
    }
  });
  window.addEventListener("plutus:budget-updated", render);

  // Initial render
  render();
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
          if (typeof item === "string")
            return {
              name: item,
              color: type === "income" ? "#22c55e" : "#fb7185",
            };
          if (item && typeof item === "object" && item.name)
            return {
              name: String(item.name),
              color: String(item.color || "#94a3b8"),
            };
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
    budget[type] = budget[type].filter(
      (c) => c.name.toLowerCase() !== name.toLowerCase(),
    );
    writeJSON(STORAGE_BUDGET, budget);
    window.dispatchEvent(new CustomEvent("plutus:categories-updated"));
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

    if (emptyEl)
      emptyEl.style.display = filtered.length === 0 ? "block" : "none";

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
    if (e.key === "Escape" && !backdrop.classList.contains("hidden"))
      closeModal();
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

    const exists = budget[type].some(
      (c) => c.name.toLowerCase() === name.toLowerCase(),
    );
    if (exists) {
      alert("That category already exists.");
      return;
    }

    budget[type].push({ name, color });
    writeJSON(STORAGE_BUDGET, budget);
    window.dispatchEvent(new CustomEvent("plutus:categories-updated"));

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

// =============== Goals Page ===============
(function initGoals() {
  const form = $("#goalScenarioForm");
  const scenarioTypeEl = $("#goalScenarioType");
  const scenarioAmountEl = $("#goalScenarioAmount");
  const scenarioCategoryEl = $("#goalScenarioCategory");
  const scenarioNameEl = $("#goalScenarioName");
  const scenarioNoteEl = $("#goalScenarioNote");
  const clearBtn = $("#goalClearBtn");
  const formWarn = $("#goalsFormWarn");

  const scenarioCountEl = $("#goalScenarioCount");
  const scenarioListEl = $("#goalsScenarioList");
  const emptyStateEl = $("#goalsEmptyState");

  const impactListEl = $("#goalsImpactList");
  const impactEmptyEl = $("#goalsImpactEmpty");

  const currentIncomeEl = $("#goalsCurrentIncome");
  const projectedIncomeEl = $("#goalsProjectedIncome");
  const scenarioIncomeEl = $("#goalsScenarioIncome");
  const currentExpenseEl = $("#goalsCurrentExpense");
  const projectedExpenseEl = $("#goalsProjectedExpense");
  const scenarioExpenseEl = $("#goalsScenarioExpense");
  const currentNetEl = $("#goalsCurrentNet");
  const projectedNetEl = $("#goalsProjectedNet");
  const netDeltaEl = $("#goalsNetDelta");
  const budgetProjectedEl = $("#goalsBudgetProjected");
  const budgetDeltaEl = $("#goalsBudgetDelta");
  const budgetStatusEl = $("#goalsBudgetStatus");

  if (
    !form ||
    !scenarioTypeEl ||
    !scenarioAmountEl ||
    !scenarioCategoryEl ||
    !scenarioNameEl ||
    !scenarioListEl ||
    !impactListEl
  ) {
    return;
  }

  const STORAGE_TX = "plutus_transactions_v1";
  const STORAGE_CATEGORIES = "categorized_budget_v1";
  const STORAGE_BUDGET = "plutus_budget_v1";
  const STORAGE_GOALS = "plutus_goals_scenarios_v1";

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
    const t = String(raw ?? "")
      .toLowerCase()
      .trim();
    return t === "income" ? "income" : "expense";
  }

  function showWarn(msg) {
    if (!formWarn) return;
    formWarn.textContent = msg;
    formWarn.classList.remove("hidden");
  }

  function hideWarn() {
    if (!formWarn) return;
    formWarn.textContent = "";
    formWarn.classList.add("hidden");
  }

  function normalizeBudgetState(state) {
    const overall = Math.max(0, Number(state?.overall ?? 0) || 0);
    const allocationsRaw = Array.isArray(state?.allocations)
      ? state.allocations
      : [];

    const allocations = allocationsRaw
      .map((a) => {
        const category = String(a?.category ?? "").trim();
        const limit = Math.max(0, Number(a?.limit ?? 0) || 0);
        if (!category) return null;
        return { category, limit };
      })
      .filter(Boolean);

    const seen = new Set();
    const deduped = [];
    for (const a of allocations) {
      const key = a.category.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(a);
    }

    return { overall, allocations: deduped };
  }

  function loadBudgetState() {
    return normalizeBudgetState(readJSON(STORAGE_BUDGET, null));
  }

  function normalizeCategoryList(list, fallbackColor) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const out = [];

    for (const item of list) {
      const name = typeof item === "string" ? item : item?.name;
      if (!name) continue;
      const clean = String(name).trim();
      if (!clean) continue;

      const key = clean.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const color =
        typeof item === "object" && item?.color
          ? String(item.color)
          : fallbackColor;
      out.push({ name: clean, color });
    }
    return out;
  }

  function loadCategories(type) {
    const raw = readJSON(STORAGE_CATEGORIES, { income: [], expense: [] });
    const income = normalizeCategoryList(raw?.income, "#22c55e");
    const expense = normalizeCategoryList(raw?.expense, "#fb7185");
    return type === "income" ? income : expense;
  }

  function normalizeScenario(item) {
    const type = normalizeType(item?.type);
    const amount = Math.max(0, Number(item?.amount ?? 0) || 0);
    const name = String(item?.name ?? "").trim();
    const fallbackCategory =
      type === "income" ? "Uncategorized Income" : "Uncategorized Expense";
    const category =
      String(item?.category ?? fallbackCategory).trim() || fallbackCategory;
    const note = String(item?.note ?? "").trim();

    if (!name || amount <= 0) return null;

    return {
      id: String(item?.id ?? uid()),
      createdAt: Number(item?.createdAt ?? Date.now()),
      type,
      amount,
      category,
      name,
      note,
    };
  }

  function loadScenarios() {
    const raw = readJSON(STORAGE_GOALS, []);
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizeScenario).filter(Boolean);
  }

  function saveScenarios(list) {
    const normalized = Array.isArray(list)
      ? list.map(normalizeScenario).filter(Boolean)
      : [];
    writeJSON(STORAGE_GOALS, normalized);
    window.dispatchEvent(new CustomEvent("plutus:goals-updated"));
  }

  function loadTransactions() {
    const raw = readJSON(STORAGE_TX, []);
    return Array.isArray(raw) ? raw : [];
  }

  function computeCurrentTotals(transactions) {
    let income = 0;
    let expense = 0;
    const expenseByCat = new Map();

    for (const tx of transactions) {
      const type = normalizeType(tx?.type ?? tx?.txType ?? tx?.kind);
      const amount = Math.abs(Number(tx?.amount ?? tx?.amt ?? 0) || 0);
      if (!Number.isFinite(amount) || amount <= 0) continue;

      if (type === "income") {
        income += amount;
        continue;
      }

      expense += amount;
      const category =
        String(tx?.category ?? tx?.cat ?? "Uncategorized Expense").trim() ||
        "Uncategorized Expense";
      const key = category.toLowerCase();
      expenseByCat.set(key, (expenseByCat.get(key) || 0) + amount);
    }

    return { income, expense, expenseByCat };
  }

  function computeScenarioTotals(scenarios) {
    let income = 0;
    let expense = 0;
    const expenseByCat = new Map();

    for (const s of scenarios) {
      const amount = Math.max(0, Number(s?.amount ?? 0) || 0);
      if (!Number.isFinite(amount) || amount <= 0) continue;

      if (s.type === "income") {
        income += amount;
        continue;
      }

      expense += amount;
      const key = String(s.category ?? "Uncategorized Expense")
        .trim()
        .toLowerCase();
      expenseByCat.set(key, (expenseByCat.get(key) || 0) + amount);
    }

    return { income, expense, expenseByCat };
  }

  function setDelta(el, value, { positiveGood = true } = {}) {
    if (!el) return;
    const delta = Number(value || 0);
    if (Math.abs(delta) < 0.005) {
      el.textContent = "No change";
      el.className = "delta neutral";
      return;
    }

    const sign = delta > 0 ? "+" : "-";
    el.textContent = `${sign}${money(Math.abs(delta))}`;
    const good = positiveGood ? delta > 0 : delta < 0;
    el.className = `delta ${good ? "good" : "bad"}`;
  }

  function rebuildScenarioCategoryOptions() {
    const type = normalizeType(scenarioTypeEl.value);
    const priorValue = scenarioCategoryEl.value;
    const fallback =
      type === "income" ? "Uncategorized Income" : "Uncategorized Expense";

    const categories = loadCategories(type).map((c) => c.name);
    if (
      !categories.some((name) => name.toLowerCase() === fallback.toLowerCase())
    ) {
      categories.push(fallback);
    }

    scenarioCategoryEl.innerHTML = "";
    for (const name of categories) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      scenarioCategoryEl.appendChild(opt);
    }

    const priorExists = categories.some(
      (name) => name.toLowerCase() === String(priorValue).toLowerCase(),
    );
    scenarioCategoryEl.value = priorExists ? priorValue : categories[0];
  }

  function renderSummary(current, scenario, budgetState) {
    const projectedIncome = current.income + scenario.income;
    const projectedExpense = current.expense + scenario.expense;

    const currentNet = current.income - current.expense;
    const projectedNet = projectedIncome - projectedExpense;
    const netDelta = projectedNet - currentNet;

    if (currentIncomeEl) currentIncomeEl.textContent = money(current.income);
    if (projectedIncomeEl)
      projectedIncomeEl.textContent = money(projectedIncome);
    if (scenarioIncomeEl) scenarioIncomeEl.textContent = money(scenario.income);

    if (currentExpenseEl) currentExpenseEl.textContent = money(current.expense);
    if (projectedExpenseEl)
      projectedExpenseEl.textContent = money(projectedExpense);
    if (scenarioExpenseEl)
      scenarioExpenseEl.textContent = money(scenario.expense);

    if (currentNetEl) currentNetEl.textContent = money(currentNet);
    if (projectedNetEl) projectedNetEl.textContent = money(projectedNet);
    setDelta(netDeltaEl, netDelta, { positiveGood: true });

    if (budgetState.overall > 0) {
      const budgetNow = budgetState.overall - current.expense;
      const budgetProjected = budgetState.overall - projectedExpense;
      const budgetDelta = budgetProjected - budgetNow;

      if (budgetProjectedEl)
        budgetProjectedEl.textContent = money(budgetProjected);
      setDelta(budgetDeltaEl, budgetDelta, { positiveGood: true });

      if (budgetStatusEl) {
        if (budgetProjected >= 0) {
          budgetStatusEl.textContent = `Projected budget remains under the cap by ${money(budgetProjected)}.`;
        } else {
          budgetStatusEl.textContent = `Projected budget goes over the cap by ${money(Math.abs(budgetProjected))}.`;
        }
      }
    } else {
      if (budgetProjectedEl) budgetProjectedEl.textContent = "Not set";
      if (budgetDeltaEl) {
        budgetDeltaEl.textContent = "No change";
        budgetDeltaEl.className = "delta neutral";
      }
      if (budgetStatusEl) {
        budgetStatusEl.textContent =
          "Set an overall budget on the Budget tab to project remaining budget.";
      }
    }
  }

  function renderScenarioList(scenarios) {
    const sorted = [...scenarios].sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
    );

    if (scenarioCountEl) {
      scenarioCountEl.textContent = `${sorted.length} scenario${sorted.length === 1 ? "" : "s"}`;
    }

    scenarioListEl.innerHTML = "";
    if (emptyStateEl)
      emptyStateEl.style.display = sorted.length ? "none" : "block";

    for (const s of sorted) {
      const li = document.createElement("li");
      li.className = "goals-row";

      const typeCell = document.createElement("div");
      typeCell.className = "goals-type";
      typeCell.innerHTML = `<span class="cat-type-badge">${s.type === "income" ? "Income" : "Expense"}</span>`;

      const scenarioCell = document.createElement("div");
      scenarioCell.className = "goals-scenario";
      scenarioCell.innerHTML = `
        <div class="title">${escapeHtml(s.name)}</div>
        <div class="muted">${s.note ? escapeHtml(s.note) : "No notes"}</div>
      `;

      const categoryCell = document.createElement("div");
      categoryCell.className = "goals-category";
      categoryCell.textContent = s.category;

      const amountCell = document.createElement("div");
      amountCell.className = "goals-amount";
      amountCell.textContent = money(s.amount);

      const impactCell = document.createElement("div");
      impactCell.className = `goals-net-impact ${s.type === "income" ? "good" : "bad"}`;
      impactCell.textContent = `${s.type === "income" ? "+" : "-"}${money(s.amount)}`;

      const actions = document.createElement("div");
      actions.className = "actions";

      const del = document.createElement("button");
      del.className = "delete-btn";
      del.type = "button";
      del.title = "Delete scenario";
      del.dataset.deleteId = s.id;
      del.innerHTML = `
        <img class="tableIcon"
          src="Icons/delete_dark-mode.png"
          data-dark="Icons/delete_dark-mode.png"
          data-light="Icons/delete_light-mode.png"
          alt="Delete scenario" />
      `;

      actions.appendChild(del);
      li.append(
        typeCell,
        scenarioCell,
        categoryCell,
        amountCell,
        impactCell,
        actions,
      );
      scenarioListEl.appendChild(li);
    }
  }

  function renderImpact(current, scenario, budgetState) {
    const allocations = Array.isArray(budgetState.allocations)
      ? budgetState.allocations
      : [];
    impactListEl.innerHTML = "";

    if (!allocations.length) {
      if (impactEmptyEl) impactEmptyEl.style.display = "block";
      return;
    }
    if (impactEmptyEl) impactEmptyEl.style.display = "none";

    for (const alloc of allocations) {
      const key = alloc.category.toLowerCase();
      const currentSpent = current.expenseByCat.get(key) || 0;
      const scenarioAdded = scenario.expenseByCat.get(key) || 0;
      const projectedSpent = currentSpent + scenarioAdded;
      const remaining = alloc.limit - projectedSpent;
      const over = projectedSpent > alloc.limit && alloc.limit > 0;

      const li = document.createElement("li");
      li.className = `goals-impact-row ${over ? "over" : ""}`;

      const categoryCell = document.createElement("div");
      categoryCell.className = "goals-impact-category";
      categoryCell.textContent = alloc.category;

      const limitCell = document.createElement("div");
      limitCell.className = "goals-impact-limit";
      limitCell.textContent = money(alloc.limit);

      const currentCell = document.createElement("div");
      currentCell.className = "goals-impact-current";
      currentCell.textContent = money(currentSpent);

      const scenarioCell = document.createElement("div");
      scenarioCell.className = "goals-impact-scenario";
      scenarioCell.textContent = money(scenarioAdded);

      const projectedCell = document.createElement("div");
      projectedCell.className = "goals-impact-projected";
      projectedCell.textContent = money(projectedSpent);

      const remainingCell = document.createElement("div");
      remainingCell.className = "goals-impact-remaining";
      remainingCell.textContent = money(remaining);

      li.append(
        categoryCell,
        limitCell,
        currentCell,
        scenarioCell,
        projectedCell,
        remainingCell,
      );
      impactListEl.appendChild(li);
    }
  }

  function render() {
    const transactions = loadTransactions();
    const scenarios = loadScenarios();
    const budgetState = loadBudgetState();

    const currentTotals = computeCurrentTotals(transactions);
    const scenarioTotals = computeScenarioTotals(scenarios);

    rebuildScenarioCategoryOptions();
    renderSummary(currentTotals, scenarioTotals, budgetState);
    renderScenarioList(scenarios);
    renderImpact(currentTotals, scenarioTotals, budgetState);
    updateDockIcons();
  }

  scenarioTypeEl.addEventListener("change", rebuildScenarioCategoryOptions);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    hideWarn();

    const type = normalizeType(scenarioTypeEl.value);
    const amount = Math.max(0, Number(scenarioAmountEl.value || 0) || 0);
    const name = scenarioNameEl.value.trim();
    const note = scenarioNoteEl?.value?.trim() || "";
    const fallbackCategory =
      type === "income" ? "Uncategorized Income" : "Uncategorized Expense";
    const category =
      String(scenarioCategoryEl.value || fallbackCategory).trim() ||
      fallbackCategory;

    if (!name) {
      showWarn("Please enter a scenario name.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      showWarn("Please enter a valid amount greater than 0.");
      return;
    }

    const list = loadScenarios();
    list.push({
      id: uid(),
      createdAt: Date.now(),
      type,
      amount,
      category,
      name,
      note,
    });
    saveScenarios(list);

    form.reset();
    scenarioTypeEl.value = "expense";
    rebuildScenarioCategoryOptions();
    render();
  });

  clearBtn?.addEventListener("click", () => {
    const scenarios = loadScenarios();
    if (!scenarios.length) return;
    if (!confirm("Clear all what-if scenarios?")) return;

    saveScenarios([]);
    form.reset();
    scenarioTypeEl.value = "expense";
    rebuildScenarioCategoryOptions();
    render();
  });

  scenarioListEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-delete-id]");
    if (!btn) return;

    const id = String(btn.dataset.deleteId || "");
    if (!id) return;

    const next = loadScenarios().filter((s) => s.id !== id);
    saveScenarios(next);
    render();
  });

  window.addEventListener("storage", (e) => {
    if (
      [STORAGE_TX, STORAGE_CATEGORIES, STORAGE_BUDGET, STORAGE_GOALS].includes(
        e.key,
      )
    ) {
      render();
    }
  });

  window.addEventListener("plutus:transactions-updated", render);
  window.addEventListener("plutus:categories-updated", render);
  window.addEventListener("plutus:budget-updated", render);
  window.addEventListener("plutus:goals-updated", render);

  render();
})();
