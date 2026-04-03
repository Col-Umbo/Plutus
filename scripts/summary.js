// ==================== Summary Page (Reserved)====================
(function initSummaryPage() {
  const homeView = $("#view-home");
  if (!homeView) return;

  const monthLabelEl = $("#summaryMonthLabel");
  const incomeEl = $("#summaryIncome");
  const expenseEl = $("#summaryExpenses");
  const netEl = $("#summaryNet");
  const remainingEl = $("#summaryRemaining");
  const budgetUsedEl = $("#summaryBudgetUsed");
  const daysLeftEl = $("#summaryDaysLeft");
  const projectedSpendEl = $("#summaryProjectedSpend");
  const budgetStatusEl = $("#summaryBudgetStatus");
  const topListEl = $("#summaryTopCategories");
  const topEmptyEl = $("#summaryTopCategoriesEmpty");
  const recentListEl = $("#summaryRecentActivity");
  const recentEmptyEl = $("#summaryRecentEmpty");
  const dockBtn = document.getElementById("home");

  function money(n) {
    const value = Number(n || 0);
    return value.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
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

  function monthKeyFromDate(date) {
    return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getFullYear()).slice(-2)}`;
  }

  function parseTxDate(raw) {
    const value = String(raw || "").trim();
    if (!value) return null;

    let match = /^(\d{1,2})-(\d{1,2})-(\d{2,4})$/.exec(value);
    if (match) {
      const day = Number(match[1]);
      const month = Number(match[2]);
      let year = Number(match[3]);
      if (year < 100) year += 2000;
      return new Date(year, month - 1, day);
    }

    match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function txMonthKey(rawDate) {
    const parsed = parseTxDate(rawDate);
    if (!parsed) return "";
    return monthKeyFromDate(parsed);
  }

  function formatDate(rawDate) {
    const parsed = parseTxDate(rawDate);
    if (!parsed) return "No date";
    return parsed.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
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

  function sumAmount(list) {
    return list.reduce(
      (acc, item) => acc + Math.abs(Number(item.amount || 0) || 0),
      0,
    );
  }

  function setSignedClass(el, value) {
    if (!el) return;
    el.classList.remove("good", "bad");
    if (value > 0) el.classList.add("good");
    if (value < 0) el.classList.add("bad");
  }

  function renderTopCategories(expenses, allocations) {
    if (!topListEl || !topEmptyEl) return;

    const spendByCategory = new Map();
    for (const tx of expenses) {
      const category =
        String(tx.category || tx.categoryName || "Uncategorized").trim() ||
        "Uncategorized";
      const amount = Math.abs(Number(tx.amount || 0) || 0);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      spendByCategory.set(
        category,
        (spendByCategory.get(category) || 0) + amount,
      );
    }

    const top = Array.from(spendByCategory.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    topListEl.innerHTML = "";
    topEmptyEl.style.display = top.length ? "none" : "block";
    if (!top.length) return;

    const allocationMap = new Map(
      (Array.isArray(allocations) ? allocations : []).map((a) => [
        String(a.category || "").toLowerCase(),
        Math.max(0, Number(a.limit || 0)),
      ]),
    );
    const maxSpent = top[0].amount || 1;

    for (const row of top) {
      const limit = allocationMap.get(row.category.toLowerCase()) || 0;
      const pct =
        limit > 0
          ? Math.min(100, (row.amount / limit) * 100)
          : (row.amount / maxSpent) * 100;

      const li = document.createElement("li");
      li.className = "summary-item";
      li.innerHTML = `
        <div class="summary-item-row">
          <div class="summary-item-title">${escapeHtml(row.category)}</div>
          <div class="summary-item-meta">${money(row.amount)}${limit > 0 ? ` of ${money(limit)}` : ""}</div>
        </div>
        <div class="summary-meter"><span style="width:${pct.toFixed(1)}%"></span></div>
      `;
      topListEl.appendChild(li);
    }
  }

  function renderRecentActivity(income, expenses) {
    if (!recentListEl || !recentEmptyEl) return;

    const items = [
      ...income.map((tx) => ({ ...tx, type: "income" })),
      ...expenses.map((tx) => ({ ...tx, type: "expense" })),
    ].sort((a, b) => {
      const aDate = parseTxDate(a.date);
      const bDate = parseTxDate(b.date);
      const aTime = aDate ? aDate.getTime() : 0;
      const bTime = bDate ? bDate.getTime() : 0;
      if (bTime !== aTime) return bTime - aTime;
      return Number(b.id || 0) - Number(a.id || 0);
    });

    const recent = items.slice(0, 5);
    recentListEl.innerHTML = "";
    recentEmptyEl.style.display = recent.length ? "none" : "block";
    if (!recent.length) return;

    for (const tx of recent) {
      const amount = Math.abs(Number(tx.amount || 0) || 0);
      const sign = tx.type === "income" ? "+" : "-";
      const amountClass = tx.type === "income" ? "good" : "bad";
      const title = String(tx.name || "Untitled").trim() || "Untitled";
      const category =
        String(tx.category || tx.categoryName || "Uncategorized").trim() ||
        "Uncategorized";

      const li = document.createElement("li");
      li.className = "summary-item";
      li.innerHTML = `
        <div class="summary-item-row">
          <div class="summary-item-title">${escapeHtml(title)}</div>
          <div class="summary-item-amount ${amountClass}">${sign}${money(amount)}</div>
        </div>
        <div class="summary-item-sub">${escapeHtml(category)} - ${formatDate(tx.date)}</div>
      `;
      recentListEl.appendChild(li);
    }
  }

  async function renderSummaryPage() {
    if (!window.handler) return;

    const now = new Date();
    if (monthLabelEl) {
      monthLabelEl.textContent = now.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      });
    }

    const [expenseJson, incomeJson, budgetJson, allocJson] = await Promise.all([
      handlerCall("get_expenses", ""),
      handlerCall("get_income", ""),
      handlerCall("get_budget_amount"),
      handlerCall("get_budget_allocations"),
    ]);

    const allExpenses = JSON.parse(expenseJson || "[]");
    const allIncome = JSON.parse(incomeJson || "[]");
    const budget = JSON.parse(budgetJson || '{"amount":0}');
    const allocations = JSON.parse(allocJson || "[]");

    const currentMonth = monthKeyFromDate(now);
    const monthExpenses = allExpenses.filter(
      (tx) => txMonthKey(tx.date) === currentMonth,
    );
    const monthIncome = allIncome.filter(
      (tx) => txMonthKey(tx.date) === currentMonth,
    );

    const incomeTotal = sumAmount(monthIncome);
    const expenseTotal = sumAmount(monthExpenses);
    const netTotal = incomeTotal - expenseTotal;
    const overallBudget = Math.max(0, Number(budget.amount || 0));
    const remainingBudget = overallBudget - expenseTotal;

    if (incomeEl) incomeEl.textContent = money(incomeTotal);
    if (expenseEl) expenseEl.textContent = money(expenseTotal);
    if (netEl) netEl.textContent = money(netTotal);
    setSignedClass(netEl, netTotal);

    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysElapsed = Math.max(1, now.getDate());
    const daysLeft = Math.max(0, daysInMonth - now.getDate());
    const projectedSpend = (expenseTotal / daysElapsed) * daysInMonth;

    if (daysLeftEl) daysLeftEl.textContent = String(daysLeft);
    if (projectedSpendEl) projectedSpendEl.textContent = money(projectedSpend);

    if (overallBudget > 0) {
      const budgetUsed = (expenseTotal / overallBudget) * 100;
      if (budgetUsedEl)
        budgetUsedEl.textContent = `${Math.min(999, budgetUsed).toFixed(1)}%`;
      if (remainingEl) remainingEl.textContent = money(remainingBudget);
      setSignedClass(remainingEl, remainingBudget);

      if (budgetStatusEl) {
        if (projectedSpend > overallBudget) {
          budgetStatusEl.textContent = `At this pace, you may exceed budget by ${money(projectedSpend - overallBudget)}.`;
        } else {
          budgetStatusEl.textContent = `At this pace, you may finish under budget by ${money(overallBudget - projectedSpend)}.`;
        }
      }
    } else {
      if (budgetUsedEl) budgetUsedEl.textContent = "N/A";
      if (remainingEl) {
        remainingEl.textContent = "Not set";
        remainingEl.classList.remove("good", "bad");
      }
      if (budgetStatusEl) {
        budgetStatusEl.textContent =
          "Set a monthly budget to track remaining budget and projections.";
      }
    }

    renderTopCategories(monthExpenses, allocations);
    renderRecentActivity(allIncome, allExpenses);
  }

  window.addEventListener("plutus-db-changed", renderSummaryPage);
  dockBtn.addEventListener("click", () => {
    renderSummaryPage();
  });
  renderSummaryPage();
})();
