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

// ==================== Summary Page (Reserved)====================

// ==================== Transactions Page ====================
(function initTransactions() {
  // If transactions view isn't in DOM, do nothing
  const openAddModalBtn = $("#openAddModal");
  const modalBackdrop = $("#modalBackdrop");
  const txForm = $("#txForm");
  if (!openAddModalBtn || !modalBackdrop || !txForm) return;

  // DOM (Document Object Model)
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

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function populateCategories() {
    if (!window.handler || !txCategory) return;

    const type = txType.value; // "income" or "expense"
    txCategory.innerHTML = "";

    const callback = function (json) {
      const list = JSON.parse(json || "[]");

      for (const item of list) {
        if (!item.name) continue;
        const opt = document.createElement("option");
        opt.value = item.name;
        opt.textContent = item.name;
        txCategory.appendChild(opt);
      }
    };

    if (type === "income") {
      handler.get_income_categories(callback);
    } else {
      handler.get_expense_categories(callback);
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

  function loadTransactionsFromBackend() {
    if (!window.handler) return;

    handler.get_expenses("", function (expenseJson) {
      handler.get_income("", function (incomeJson) {
        const expenses = JSON.parse(expenseJson || "[]").map((e) => ({
          ...e,
          type: "expense",
          repeats: Boolean(e.recurring),
          repeatEvery: String(e.frequency || ""),
        }));

        const income = JSON.parse(incomeJson || "[]").map((i) => ({
          ...i,
          type: "income",
          repeats: Boolean(i.recurring),
          repeatEvery: String(i.frequency || ""),
        }));

        renderTransactions([...expenses, ...income]);
      });
    });
  }

  function renderTransactions(transactions) {
    const totals = computeTotals(transactions);
    if (incomeTotalEl) incomeTotalEl.textContent = money(totals.income);
    if (expenseTotalEl) expenseTotalEl.textContent = money(totals.expense);

    const q = (searchInput?.value || "").trim();
    const filtered = transactions
      .filter(matchesFilter)
      .filter((t) => matchesSearch(t, q))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    txListEl.innerHTML = "";

    if (emptyStateEl) {
      emptyStateEl.style.display = filtered.length === 0 ? "block" : "none";
    }

    for (const t of filtered) {
      const li = document.createElement("li");
      li.className = "tx-item";

      const date = document.createElement("div");
      date.className = "date muted";
      date.textContent = t.date || "";

      const name = document.createElement("div");
      name.className = "name";
      name.innerHTML = `
        <div style="font-weight:700">${escapeHtml(t.name || "")}</div>
        <div class="muted">${t.repeats ? `Repeats: ${escapeHtml(t.repeatEvery)}` : "One-time"}</div>
      `;

      const cat = document.createElement("div");
      cat.className = "cat";
      cat.innerHTML = `<span class="badge"><span class="dot"></span>${escapeHtml(t.category || "")}</span>`;

      const amt = document.createElement("div");
      amt.className = `amount ${t.type}`;
      amt.textContent = money(Math.abs(Number(t.amount || 0)));

      const actions = document.createElement("div");
      actions.className = "actions";
      actions.innerHTML = "";

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

    if (!window.handler) {
      alert("Backend not connected.");
      return;
    }

    const amount = Number(txAmount.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Please enter a valid amount greater than 0.");
      return;
    }

    const type = txType.value;
    const category = txCategory.value;
    const name = txName.value.trim();

    if (!category || !name) {
      alert("Please fill out all required fields.");
      return;
    }

    const repeats = txRepeats.checked;
    let frequency = 0;

    if (repeats) {
      if (repeatEvery.value === "weekly") frequency = 7;
      else if (repeatEvery.value === "biweekly") frequency = 14;
      else if (repeatEvery.value === "monthly") frequency = 30;
      else if (repeatEvery.value === "yearly") frequency = 365;
    }

    const endDate = "";
    const credit = false;

    if (type === "expense") {
      handler.log_expense(
        name,
        amount,
        category,
        repeats,
        frequency,
        endDate,
        credit,
      );
    } else {
      handler.log_income(name, amount, category, repeats, frequency, endDate);
    }

    closeModal();
    setTimeout(loadTransactionsFromBackend, 50);
  });

  pills.forEach((btn) => {
    btn.addEventListener("click", () => {
      pills.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      loadTransactionsFromBackend();
    });
  });

  searchInput?.addEventListener("input", loadTransactionsFromBackend);

  // Init
  populateCategories();
  loadTransactionsFromBackend();
})();

// ==================== Budget Page ====================
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

  if (!pieCanvas || !overallForm || !allocForm || !listEl) return;

  let pieChart = null;

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

  function handlerCall(methodName, ...args) {
    return new Promise((resolve) => {
      if (!window.handler || typeof window.handler[methodName] !== "function") {
        resolve(null);
        return;
      }
      window.handler[methodName](...args, function (result) {
        resolve(result);
      });
    });
  }

  async function loadBudgetState() {
    const budgetJson = await handlerCall("get_budget_amount");
    const allocJson = await handlerCall("get_budget_allocations");

    const budget = JSON.parse(budgetJson || '{"amount":0}');
    const allocations = JSON.parse(allocJson || "[]");

    return {
      overall: Math.max(0, Number(budget.amount || 0)),
      allocations: Array.isArray(allocations)
        ? allocations
            .map((a) => ({
              category: String(a.category || "").trim(),
              limit: Math.max(0, Number(a.limit || 0)),
            }))
            .filter((a) => a.category)
        : [],
    };
  }

  async function loadExpenseCategories() {
    const json = await handlerCall("get_expense_categories");
    const list = JSON.parse(json || "[]");
    return Array.isArray(list)
      ? list
          .map((x) => ({
            name: String(x.name || "").trim(),
            color: String(x.color || "#94a3b8"),
          }))
          .filter((x) => x.name)
      : [];
  }

  async function loadTransactions() {
    const json = await handlerCall("get_expenses", "");
    const list = JSON.parse(json || "[]");
    return Array.isArray(list) ? list : [];
  }

  function allocatedTotal(state) {
    return (state.allocations || []).reduce(
      (sum, a) => sum + (Number(a.limit) || 0),
      0,
    );
  }

  function remainingToAllocate(state) {
    return Math.max(0, state.overall - allocatedTotal(state));
  }

  function computeSpending(transactions, state) {
    const allocMap = new Map(
      (state.allocations || []).map((a) => [a.category.toLowerCase(), a.limit]),
    );

    const spentByCat = new Map();
    let unallocatedSpent = 0;

    for (const t of transactions) {
      const amt = Math.abs(Number(t.amount || 0));
      const cat = String(
        t.category || t.categoryName || "Uncategorized",
      ).trim();
      const key = cat.toLowerCase();

      if (allocMap.has(key)) {
        spentByCat.set(key, (spentByCat.get(key) || 0) + amt);
      } else {
        unallocatedSpent += amt;
      }
    }

    return { spentByCat, unallocatedSpent };
  }

  async function rebuildCategorySelect(state) {
    const cats = await loadExpenseCategories();
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

  async function renderPie(state) {
    const cats = await loadExpenseCategories();
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

  async function renderList(state) {
    const transactions = await loadTransactions();
    const { spentByCat, unallocatedSpent } = computeSpending(
      transactions,
      state,
    );

    listEl.innerHTML = "";

    const unallocLimit = remainingToAllocate(state);
    const allocTotal = allocatedTotal(state);

    if (allocatedEl) allocatedEl.textContent = money(allocTotal);
    if (unallocatedEl) unallocatedEl.textContent = money(unallocLimit);
    if (unallocatedSpentEl)
      unallocatedSpentEl.textContent = money(unallocatedSpent);
    if (remainingToAllocateEl)
      remainingToAllocateEl.textContent = money(unallocLimit);

    if (emptyEl) {
      emptyEl.style.display = state.allocations.length === 0 ? "block" : "none";
    }

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
      if (fill) fill.style.width = `${pct}%`;

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
        del.addEventListener("click", async () => {
          if (!window.handler) return;
          window.handler.delete_budget_allocation(name);
          setTimeout(render, 50);
        });
        actCell.appendChild(del);
      }

      li.append(nameCell, limitCell, spentCell, remainingCell, actCell);
      listEl.appendChild(li);
    }

    for (const a of state.allocations) {
      const spent = spentByCat.get(a.category.toLowerCase()) || 0;
      makeRow({
        name: a.category,
        limit: a.limit,
        spent,
        isUnallocated: false,
      });
    }

    if (state.overall > 0) {
      makeRow({
        name: "Unallocated",
        limit: unallocLimit,
        spent: unallocatedSpent,
        isUnallocated: true,
      });
    }
  }

  async function render() {
    hideWarn(overallWarn);
    hideWarn(allocWarn);

    const state = await loadBudgetState();

    if (overallStatus) {
      overallStatus.textContent =
        state.overall > 0 ? `Current: ${money(state.overall)}` : "Not set yet";
    }

    if (state.overall > 0 && !overallInput.dataset.editing) {
      overallInput.value = state.overall.toFixed(2);
      overallInput.disabled = true;
    } else {
      overallInput.disabled = false;
      if (!overallInput.value && state.overall > 0) {
        overallInput.value = state.overall.toFixed(2);
      }
    }

    await rebuildCategorySelect(state);
    await renderPie(state);
    await renderList(state);

    const rem = remainingToAllocate(state);
    allocRemaining.disabled = rem <= 0;
    if (rem <= 0) allocRemaining.checked = false;
  }

  overallForm.addEventListener("submit", async (e) => {
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

    const state = await loadBudgetState();
    const allocTotal = allocatedTotal(state);

    if (allocTotal > val) {
      showWarn(
        overallWarn,
        `Your current allocations total ${money(allocTotal)}, which is higher than ${money(val)}. Reduce allocations first.`,
      );
      return;
    }

    if (!window.handler) return;
    window.handler.set_budget_amount(val);

    overallInput.dataset.editing = "";
    overallInput.disabled = true;
    setTimeout(render, 50);
  });

  overallEditBtn?.addEventListener("click", () => {
    overallInput.dataset.editing = "1";
    overallInput.disabled = false;
    overallInput.focus();
    overallInput.select();
  });

  allocRemaining.addEventListener("change", async () => {
    const state = await loadBudgetState();
    const rem = remainingToAllocate(state);
    if (allocRemaining.checked && rem > 0) {
      allocLimit.value = rem.toFixed(2);
    }
  });

  allocForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideWarn(allocWarn);

    const state = await loadBudgetState();
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

    if (!window.handler) return;
    window.handler.upsert_budget_allocation(category, limit);

    allocForm.reset();
    setTimeout(render, 50);
  });

  render();
})();

// ==================== Categories Page ====================
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

  function matchesFilter(item) {
    if (currentFilter === "all") return true;
    return item.type === currentFilter;
  }

  function matchesSearch(item, q) {
    if (!q) return true;
    return item.name.toLowerCase().includes(q.toLowerCase());
  }

  function renderCategoriesFromBackend() {
    if (!window.handler) return;

    handler.get_expense_categories(function (expenseJson) {
      handler.get_income_categories(function (incomeJson) {
        const expense = JSON.parse(expenseJson || "[]").map((x) => ({
          ...x,
          type: "expense",
        }));
        const income = JSON.parse(incomeJson || "[]").map((x) => ({
          ...x,
          type: "income",
        }));

        const flat = [...income, ...expense];
        const q = (searchInput?.value || "").trim();

        const filtered = flat
          .filter(matchesFilter)
          .filter((x) => matchesSearch(x, q))
          .sort((a, b) => a.name.localeCompare(b.name));

        if (catIncomeTotalEl)
          catIncomeTotalEl.textContent = String(income.length);
        if (catExpenseTotalEl)
          catExpenseTotalEl.textContent = String(expense.length);

        listEl.innerHTML = "";

        if (emptyEl) {
          emptyEl.style.display = filtered.length === 0 ? "block" : "none";
        }

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
          actions.innerHTML = "";

          li.append(type, name, color, actions);
          listEl.appendChild(li);
        }

        updateDockIcons();
      });
    });
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

    if (!window.handler) {
      alert("Backend not connected.");
      return;
    }

    const type = catTypeEl.value; // income|expense
    const name = catNameEl.value.trim();
    const color = catColorEl.value;

    if (!name) {
      alert("Please enter a category name.");
      return;
    }

    const isIncome = type === "income";
    handler.add_category(isIncome, name, 0.0, color);

    closeModal();
    setTimeout(() => {
      renderCategoriesFromBackend();
      if (typeof populateCategories === "function") populateCategories();
    }, 50);
  });

  pills.forEach((btn) => {
    btn.addEventListener("click", () => {
      pills.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      renderCategoriesFromBackend();
    });
  });

  searchInput?.addEventListener("input", renderCategoriesFromBackend);

  // Init
  renderCategoriesFromBackend();
})();

// ==================== Goals Page ====================
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

  function money(n) {
    const v = Number(n || 0);
    return v.toLocaleString(undefined, { style: "currency", currency: "USD" });
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

  function handlerCall(methodName, ...args) {
    return new Promise((resolve) => {
      if (!window.handler || typeof window.handler[methodName] !== "function") {
        resolve(null);
        return;
      }
      window.handler[methodName](...args, function (result) {
        resolve(result);
      });
    });
  }

  async function loadTransactions() {
    const expenseJson = await handlerCall("get_expenses", "");
    const incomeJson = await handlerCall("get_income", "");

    const expenses = JSON.parse(expenseJson || "[]").map((x) => ({
      ...x,
      type: "expense",
    }));
    const income = JSON.parse(incomeJson || "[]").map((x) => ({
      ...x,
      type: "income",
    }));

    return [...expenses, ...income];
  }

  async function loadCategories(type) {
    const method =
      type === "income" ? "get_income_categories" : "get_expense_categories";
    const json = await handlerCall(method);
    const list = JSON.parse(json || "[]");

    return Array.isArray(list)
      ? list
          .map((x) => ({
            name: String(x.name || "").trim(),
            color: String(x.color || "#94a3b8"),
          }))
          .filter((x) => x.name)
      : [];
  }

  async function loadBudgetState() {
    const budgetJson = await handlerCall("get_budget_amount");
    const allocJson = await handlerCall("get_budget_allocations");

    const budget = JSON.parse(budgetJson || '{"amount":0}');
    const allocations = JSON.parse(allocJson || "[]");

    return {
      overall: Math.max(0, Number(budget.amount || 0)),
      allocations: Array.isArray(allocations)
        ? allocations
            .map((a) => ({
              category: String(a.category || "").trim(),
              limit: Math.max(0, Number(a.limit || 0)),
            }))
            .filter((a) => a.category)
        : [],
    };
  }

  async function loadScenarios() {
    const json = await handlerCall("get_goal_scenarios");
    const list = JSON.parse(json || "[]");
    return Array.isArray(list) ? list : [];
  }

  function computeCurrentTotals(transactions) {
    let income = 0;
    let expense = 0;
    const expenseByCat = new Map();

    for (const tx of transactions) {
      const type = normalizeType(tx?.type ?? tx?.txType ?? tx?.kind);
      const amount = Math.abs(Number(tx?.amount ?? 0) || 0);
      if (!Number.isFinite(amount) || amount <= 0) continue;

      if (type === "income") {
        income += amount;
        continue;
      }

      expense += amount;
      const category =
        String(
          tx?.category ?? tx?.categoryName ?? "Uncategorized Expense",
        ).trim() || "Uncategorized Expense";
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

      if (normalizeType(s.type) === "income") {
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

  async function rebuildScenarioCategoryOptions() {
    const type = normalizeType(scenarioTypeEl.value);
    const priorValue = scenarioCategoryEl.value;
    const fallback =
      type === "income" ? "Uncategorized Income" : "Uncategorized Expense";

    const categories = (await loadCategories(type)).map((c) => c.name);
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
      (a, b) =>
        Number(b.createdAt || 0) - Number(a.createdAt || 0) ||
        Number(b.id || 0) - Number(a.id || 0),
    );

    if (scenarioCountEl) {
      scenarioCountEl.textContent = `${sorted.length} scenario${sorted.length === 1 ? "" : "s"}`;
    }

    scenarioListEl.innerHTML = "";
    if (emptyStateEl)
      emptyStateEl.style.display = sorted.length ? "none" : "block";

    for (let i = 0; i < sorted.length; i++) {
      const li = document.createElement("li");
      li.className = "goals-row";

      const typeCell = document.createElement("div");
      typeCell.className = "goals-type";
      typeCell.innerHTML = `<span class="cat-type-badge">${sorted[i].type === "income" ? "Income" : "Expense"}</span>`;

      const scenarioCell = document.createElement("div");
      scenarioCell.className = "goals-scenario";
      scenarioCell.innerHTML = `
        <div class="title">${escapeHtml(sorted[i].name)}</div>
        <div class="muted">${sorted[i].note ? escapeHtml(sorted[i].note) : "No notes"}</div>
      `;

      const categoryCell = document.createElement("div");
      categoryCell.className = "goals-category";
      categoryCell.textContent = sorted[i].category;

      const amountCell = document.createElement("div");
      amountCell.className = "goals-amount";
      amountCell.textContent = money(sorted[i].amount);

      const impactCell = document.createElement("div");
      let netImpact = 0;
      impactCell.className = `goals-net-impact ${sorted[i].type === "income" ? "good" : "bad"}`;
      for (let j = i; j < sorted.length; j++) {
        if (sorted[j].category === sorted[i].category) {
          netImpact += parseFloat(sorted[j].amount);
        }
      }
      impactCell.textContent += `${sorted[i].type === "income" ? "+" : "-"} ${money(netImpact)}`;
      // impactCell.textContent = `${sorted[i].type === "income" ? "+" : "-"}${money(sorted[i].amount)}`;

      const actions = document.createElement("div");
      actions.className = "actions";

      const del = document.createElement("button");
      del.className = "delete-btn";
      del.type = "button";
      del.title = "Delete scenario";
      del.dataset.deleteId = String(sorted[i].id);
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

  async function render() {
    const transactions = await loadTransactions();
    const scenarios = await loadScenarios();
    const budgetState = await loadBudgetState();

    const currentTotals = computeCurrentTotals(transactions);
    const scenarioTotals = computeScenarioTotals(scenarios);

    await rebuildScenarioCategoryOptions();
    renderSummary(currentTotals, scenarioTotals, budgetState);
    renderScenarioList(scenarios);
    renderImpact(currentTotals, scenarioTotals, budgetState);
    updateDockIcons();
  }

  scenarioTypeEl.addEventListener("change", rebuildScenarioCategoryOptions);

  form.addEventListener("submit", async (e) => {
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

    if (!window.handler) return;
    window.handler.add_goal_scenario(type, amount, category, name, note);

    form.reset();
    scenarioTypeEl.value = "expense";
    setTimeout(render, 50);
  });

  clearBtn?.addEventListener("click", () => {
    if (!confirm("Clear all what-if scenarios?")) return;
    if (!window.handler) return;
    window.handler.clear_goal_scenarios();
    form.reset();
    scenarioTypeEl.value = "expense";
    setTimeout(render, 50);
  });

  scenarioListEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-delete-id]");
    if (!btn) return;

    const id = Number(btn.dataset.deleteId || 0);
    if (!id || !window.handler) return;

    window.handler.delete_goal_scenario(id);
    setTimeout(render, 50);
  });

  render();
})();
