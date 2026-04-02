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
      actCell.className = "budget-actions";

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
  window.addEventListener("plutus-db-changed", () => {
    render();
  });

  render();
})();

