// =============== Utiliites ===============

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// (dev notes) '$' is being used as a variable to manipulate CSS selectors

const isMac = navigator.platform.toLocaleLowerCase().includes("mac"); // Determine if Mac or PC
const modKeyEl = $("#modKey");
if (modKeyEl) modKeyEl.textContent = isMac ? "Cmd" : "Ctrl";




// =============== Views / Routing (Switch between tabs) ===============

const views = {
  home: $("#view-home"),
  transactions: $("#view-transactions"),
  budget: $("#view-budget"),
  whatif: $("#view-whatif"),
  goals: $("#view-goals"),
};

const dockButtons = $$(".dockBtn");

function setActiveView(key, { push = true } = {}) {
  if (!views[key]) key = "home";

  // Show the correct page
  Object.entries(views).forEach(([k, el]) => {
    if (!el) return;
    el.classList.toggle("active", k === key);
  });

  // Update dock button "active" + aria-current
  dockButtons.forEach((btn) => {
    const isActive = btn.dataset.target === key;
    btn.classList.toggle("active", isActive);
    if (isActive) btn.setAttribute("aria-current", "page");
    else btn.removeAttribute("aria-current");
  });

  // Update URL hash
  if (push) history.pushState({ key }, "", `#${key}`);
}

// Click handlers
dockButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.target;
    setActiveView(target);
  });
});

// Back/forward buttons
window.addEventListener("popstate", (e) => {
  const key = (e.state && e.state.key) || (location.hash || "#home").slice(1);
  setActiveView(key, { push: false });
});

// Initial route
const initial = (location.hash || "#home").slice(1);
history.replaceState({ key: initial }, "", `#${initial}`);
setActiveView(initial, { push: false });




// =============== Theme toggle (Light/Dark) ===============

const themeToggleBtn = document.getElementById("themeToggleBtn");
const themeLabel = document.getElementById("themeLabel");
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

  // fallback to system preference
  const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)")?.matches;
  return prefersLight ? "light" : "dark";
}

// Initialize
let currentTheme = getInitialTheme();
applyTheme(currentTheme);

themeToggleBtn?.addEventListener("click", () => {
  currentTheme = document.body.classList.contains("light") ? "dark" : "light";
  localStorage.setItem(THEME_KEY, currentTheme);
  applyTheme(currentTheme);
});

document.addEventListener("DOMContentLoaded", updateDockIcons);



// =============== Password Lock Button Scripts ===============

// ~~~~~~~~~~ Popup Overlay ~~~~~~~~~~
const overlay = $("#overlay");
const palInput = $("#palInput");
const palList = $("#palList");
const palCount = $("#palCount");
const openPaletteBtn = $("#openPaletteBtn");

const commands = [ // Insert commands later
];

let filtered = [...commands];
let activeIndex = 0;

function openPalette() {
  overlay.classList.add("open");
  palInput.value = "";
  filtered = [...commands];
  activeIndex = 0;
  renderCommands();
  setTimeout(() => palInput.focus(), 0);
}

function closePalette() {
  overlay.classList.remove("open");
  palInput.blur();
}

function renderCommands() {
  palList.innerHTML = "";
  filtered.forEach((cmd, idx) => {
    const row = document.createElement("div");
    row.className = "item" + (idx === activeIndex ? " active" : "");
    row.tabIndex = 0;
    row.dataset.key = cmd.key;

    row.innerHTML = `
        <div class="badge">${cmd.icon}</div>
        <div class="meta">
        <b>${cmd.label}</b>
        <span>${cmd.hint}</span>
        </div>
    `;

    row.addEventListener("click", () => {
      setActiveView(cmd.key);
      closePalette();
    });

    palList.appendChild(row);
  });

  palCount.textContent = `${filtered.length} command${filtered.length === 1 ? "" : "s"}`;

  // keep selected item visible
  const active = $(".item.active", palList);
  if (active) active.scrollIntoView({ block: "nearest" });
}

function applyFilter(text) {
  const q = text.trim().toLowerCase();
  filtered = commands.filter(c =>
    c.label.toLowerCase().includes(q) ||
    c.hint.toLowerCase().includes(q) ||
    c.key.toLowerCase().includes(q)
  );
  activeIndex = 0;
  renderCommands();
}

palInput.addEventListener("input", (e) => applyFilter(e.target.value));

openPaletteBtn.addEventListener("click", openPalette);
overlay.addEventListener("click", (e) => {
  if (e.target === overlay) closePalette();
});



// =============== Scripts for Budget Page ===============

// ~~~~~~~~~~ Storage Helpers ~~~~~~~~~~
const STORAGE_KEY = "categorized_budget_v1";

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    // seed with a couple defaults
    return {
      categories: [
        { id: crypto.randomUUID(), type: "expense", name: "Bills", color: "#ef4444" },
        { id: crypto.randomUUID(), type: "expense", name: "Groceries", color: "#f59e0b" },
        { id: crypto.randomUUID(), type: "income", name: "Paycheck", color: "#22c55e" },
      ],
      items: []
    };
  }
  try { return JSON.parse(raw); } catch { return { categories: [], items: [] }; }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ~~~~~~~~~~ State ~~~~~~~~~~
let state = loadState();

// ~~~~~~~~~~ DOM ~~~~~~~~~~
const categoryForm = document.getElementById("categoryForm");
const categoryType = document.getElementById("categoryType");
const categoryName = document.getElementById("categoryName");
const categoryColor = document.getElementById("categoryColor");

const expenseCategories = document.getElementById("expenseCategories");
const incomeCategories = document.getElementById("incomeCategories");

const tabs = Array.from(document.querySelectorAll(".tab"));

const itemForm = document.getElementById("itemForm");
const itemDesc = document.getElementById("itemDesc");
const itemAmount = document.getElementById("itemAmount");
const itemCategory = document.getElementById("itemCategory");
const itemIsIncome = document.getElementById("itemIsIncome");

const totalsList = document.getElementById("totalsList");
const itemsList = document.getElementById("itemsList");

const totalIncomeEl = document.getElementById("totalIncome");
const totalExpensesEl = document.getElementById("totalExpenses");
const netTotalEl = document.getElementById("netTotal");

const chartMode = document.getElementById("chartMode");
const clearAllBtn = document.getElementById("clearAll");

// ~~~~~~~~~~ Chart ~~~~~~~~~~
const ctx = document.getElementById("budgetChart");
let budgetChart = null;

function ensureChart(labels, data, colors, titleText) {
  if (budgetChart) {
    budgetChart.data.labels = labels;
    budgetChart.data.datasets[0].data = data;
    budgetChart.data.datasets[0].backgroundColor = colors;
    budgetChart.options.plugins.title.text = titleText;
    budgetChart.update();
    return;
  }

  budgetChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: titleText },
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: (context) => {
              const val = context.parsed ?? 0;
              return ` ${context.label}: $${val.toFixed(2)}`;
            }
          }
        }
      }
    }
  });
}

// ~~~~~~~~~~ Computations ~~~~~~~~~~
function getCategoryById(id) {
  return state.categories.find(c => c.id === id);
}

function sumByCategory(type) {
  // type: "expense" | "income"
  const totals = new Map();

  for (const item of state.items) {
    const cat = getCategoryById(item.categoryId);
    if (!cat) continue;

    //item.sign: +1 for income-like, -1 for expense-like
    //For "expense" mode, we want only negative items OR categories of expense type
    if (type === "expense") {
      if (item.sign !== -1 && cat.type !== "expense") continue;
    } else {
      if (item.sign !== 1 && cat.type !== "income") continue;
    }

    const key = cat.id;
    const prev = totals.get(key) ?? 0;
    totals.set(key, prev + Math.abs(item.amount));
  }

  // Build arrays sorted descending by total
  const rows = Array.from(totals.entries())
    .map(([catId, total]) => ({ cat: getCategoryById(catId), total }))
    .filter(r => r.cat)
    .sort((a, b) => b.total - a.total);

  return rows;
}

function computeTotals() {
  let income = 0;
  let expenses = 0;

  for (const item of state.items) {
    if (item.sign === 1) income += item.amount;
    if (item.sign === -1) expenses += item.amount;
  }

  // expenses stored positive numbers but sign indicates direction; keep display positive
  const expenseAbs = Math.abs(expenses);
  const net = income - expenseAbs;

  return { income, expenses: expenseAbs, net };
}

// ~~~~~~~~~~ Render ~~~~~~~~~~
function renderCategories() {
  expenseCategories.innerHTML = "";
  incomeCategories.innerHTML = "";

  const expenses = state.categories.filter(c => c.type === "expense");
  const incomes = state.categories.filter(c => c.type === "income");

  const makeLi = (cat) => {
    const li = document.createElement("li");
    li.className = "chip";

    const left = document.createElement("div");
    left.className = "chipLeft";

    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = cat.color;

    const name = document.createElement("span");
    name.className = "chipName";
    name.textContent = cat.name;

    left.appendChild(swatch);
    left.appendChild(name);

    const del = document.createElement("button");
    del.className = "iconBtn";
    del.type = "button";
    del.textContent = "Delete";
    del.addEventListener("click", () => {
      // remove category AND any items pointing to it
      state.categories = state.categories.filter(c => c.id !== cat.id);
      state.items = state.items.filter(it => it.categoryId !== cat.id);
      saveState();
      renderAll();
    });

    li.appendChild(left);
    li.appendChild(del);
    return li;
  };

  expenses.forEach(cat => expenseCategories.appendChild(makeLi(cat)));
  incomes.forEach(cat => incomeCategories.appendChild(makeLi(cat)));
}

function renderCategorySelect() {
  itemCategory.innerHTML = "";

  // Include all categories, but label them
  const categories = [...state.categories].sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.name.localeCompare(b.name);
  });

  for (const cat of categories) {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = `${cat.type === "income" ? "Income" : "Expense"}: ${cat.name}`;
    itemCategory.appendChild(opt);
  }

  // If no categories, disable item form
  const disabled = categories.length === 0;
  itemCategory.disabled = disabled;
}

function renderItems() {
  itemsList.innerHTML = "";

  // newest first
  const items = [...state.items].sort((a, b) => b.createdAt - a.createdAt);

  for (const item of items) {
    const cat = getCategoryById(item.categoryId);
    const li = document.createElement("li");

    const left = document.createElement("div");
    const title = document.createElement("div");
    title.textContent = item.desc;

    const meta = document.createElement("div");
    meta.className = "muted";
    meta.textContent = cat ? `${cat.type.toUpperCase()} • ${cat.name}` : "Unknown category";

    left.appendChild(title);
    left.appendChild(meta);

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.alignItems = "center";
    right.style.gap = "10px";

    const amt = document.createElement("div");
    const signPrefix = item.sign === 1 ? "+" : "-";
    amt.textContent = `${signPrefix}$${item.amount.toFixed(2)}`;
    amt.style.fontWeight = "600";

    const del = document.createElement("button");
    del.className = "iconBtn";
    del.type = "button";
    del.textContent = "Remove";
    del.addEventListener("click", () => {
      state.items = state.items.filter(it => it.id !== item.id);
      saveState();
      renderAll();
    });

    right.appendChild(amt);
    right.appendChild(del);

    li.appendChild(left);
    li.appendChild(right);

    // add a tiny color hint
    if (cat) {
      li.style.borderLeft = `6px solid ${cat.color}`;
    }

    itemsList.appendChild(li);
  }

  if (items.length === 0) {
    const empty = document.createElement("li");
    empty.className = "muted";
    empty.textContent = "No items yet — add your first budget item above.";
    empty.style.justifyContent = "flex-start";
    itemsList.appendChild(empty);
  }
}

function renderTotalsAndChart() {
  const { income, expenses, net } = computeTotals();

  totalIncomeEl.textContent = `$${income.toFixed(2)}`;
  totalExpensesEl.textContent = `$${expenses.toFixed(2)}`;

  netTotalEl.textContent = `$${net.toFixed(2)}`;
  netTotalEl.style.color = net >= 0 ? "rgba(34,197,94,1)" : "rgba(239,68,68,1)";

  totalsList.innerHTML = "";

  const mode = chartMode.value;

  if (mode === "net") {
    const labels = ["Income", "Expenses"];
    const data = [income, expenses];
    const colors = ["#22c55e", "#ef4444"];
    ensureChart(labels, data, colors, "Net Breakdown");

    const rows = [
      { label: "Income", total: income, color: "#22c55e" },
      { label: "Expenses", total: expenses, color: "#ef4444" },
    ];

    for (const r of rows) {
      const li = document.createElement("li");
      const left = document.createElement("div");
      left.style.display = "flex";
      left.style.alignItems = "center";
      left.style.gap = "10px";

      const sw = document.createElement("span");
      sw.className = "swatch";
      sw.style.background = r.color;

      const name = document.createElement("div");
      name.textContent = r.label;

      left.appendChild(sw);
      left.appendChild(name);

      const right = document.createElement("div");
      right.textContent = `$${r.total.toFixed(2)}`;
      right.style.fontWeight = "600";

      li.appendChild(left);
      li.appendChild(right);
      totalsList.appendChild(li);
    }

    return;
  }

  const rows = sumByCategory(mode); // expense or income
  const labels = rows.map(r => r.cat.name);
  const data = rows.map(r => r.total);
  const colors = rows.map(r => r.cat.color);

  const title = mode === "expense" ? "Expenses by Category" : "Income by Category";

  // handle empty chart nicely
  if (labels.length === 0) {
    ensureChart(["No data"], [1], ["rgba(255,255,255,.12)"], title);
  } else {
    ensureChart(labels, data, colors, title);
  }

  if (rows.length === 0) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = "No totals yet — add items to see category totals.";
    li.style.justifyContent = "flex-start";
    totalsList.appendChild(li);
    return;
  }

  for (const r of rows) {
    const li = document.createElement("li");
    const left = document.createElement("div");
    left.style.display = "flex";
    left.style.alignItems = "center";
    left.style.gap = "10px";

    const sw = document.createElement("span");
    sw.className = "swatch";
    sw.style.background = r.cat.color;

    const name = document.createElement("div");
    name.textContent = r.cat.name;

    left.appendChild(sw);
    left.appendChild(name);

    const right = document.createElement("div");
    right.textContent = `$${r.total.toFixed(2)}`;
    right.style.fontWeight = "600";

    li.appendChild(left);
    li.appendChild(right);
    totalsList.appendChild(li);
  }
}

function renderAll() {
  renderCategories();
  renderCategorySelect();
  renderItems();
  renderTotalsAndChart();
}

// ~~~~~~~~~~ Events ~~~~~~~~~~
categoryForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const type = categoryType.value;
  const name = categoryName.value.trim();
  const color = categoryColor.value;

  if (!name) return;

  // prevent duplicates per type (case-insensitive)
  const exists = state.categories.some(c => c.type === type && c.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    alert(`A ${type} category named "${name}" already exists.`);
    return;
  }

  state.categories.push({
    id: crypto.randomUUID(),
    type,
    name,
    color
  });

  categoryName.value = "";
  saveState();
  renderAll();
});

itemForm.addEventListener("submit", (e) => {
  e.preventDefault();

  if (state.categories.length === 0) {
    alert("Create a category first.");
    return;
  }

  const desc = itemDesc.value.trim();
  const amt = Number(itemAmount.value);

  if (!desc || !Number.isFinite(amt) || amt <= 0) return;

  const categoryId = itemCategory.value;
  const cat = getCategoryById(categoryId);

  // sign: income checkbox overrides; otherwise infer from category type
  const sign = itemIsIncome.checked ? 1 : (cat?.type === "income" ? 1 : -1);

  state.items.push({
    id: crypto.randomUUID(),
    desc,
    amount: Math.round(amt * 100) / 100,
    categoryId,
    sign,
    createdAt: Date.now()
  });

  itemDesc.value = "";
  itemAmount.value = "";
  itemIsIncome.checked = false;

  saveState();
  renderAll();
});

chartMode.addEventListener("change", () => {
  renderTotalsAndChart();
});

clearAllBtn.addEventListener("click", () => {
  const ok = confirm("Clear all categories and items?");
  if (!ok) return;

  state = { categories: [], items: [] };
  saveState();
  renderAll();
});

tabs.forEach(btn => {
  btn.addEventListener("click", () => {
    tabs.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const tab = btn.dataset.tab;
    if (tab === "expense") {
      expenseCategories.classList.remove("hidden");
      incomeCategories.classList.add("hidden");
    } else {
      incomeCategories.classList.remove("hidden");
      expenseCategories.classList.add("hidden");
    }
  });
});

// ~~~~~~~~~~ Init ~~~~~~~~~~
renderAll();
