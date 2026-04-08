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
  const dockBtn = document.getElementById("goals");

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
  window.addEventListener("plutus-db-changed", () => {
    render();
  });

  dockBtn.addEventListener("click", () => {
    render();
  });

  render();
})();
