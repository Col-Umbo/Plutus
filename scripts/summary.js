// ==================== Summary Page ====================
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

  // Total Spending Card (with pie chart)
  let spendingChart = null;
  const FALLBACK_TEXT = "rgba(255,255,255,0.92)";
  const FALLBACK_MUTED = "rgba(255,255,255,0.65)";
  const FALLBACK_BORDER = "rgba(255,255,255,0.16)";

  function cssVar(name, fallback) {
    const value = getComputedStyle(document.body).getPropertyValue(name).trim();
    return value || fallback;
  }

  function applySpendingChartTheme() {
    if (!spendingChart) return;

    const textColor = cssVar("--text", FALLBACK_TEXT);
    const mutedColor = cssVar("--muted", FALLBACK_MUTED);
    const borderColor = cssVar("--border", FALLBACK_BORDER);
    const tooltipBg = document.body.classList.contains("light")
      ? "rgba(248, 250, 252, 0.97)"
      : "rgba(15, 23, 42, 0.94)";

    spendingChart.options.plugins.legend = {
      ...spendingChart.options.plugins.legend,
      labels: {
        ...spendingChart.options.plugins.legend?.labels,
        color: textColor,
      },
    };

    spendingChart.options.plugins.tooltip = {
      ...spendingChart.options.plugins.tooltip,
      titleColor: textColor,
      bodyColor: textColor,
      footerColor: mutedColor,
      backgroundColor: tooltipBg,
      borderColor: borderColor,
      borderWidth: 1,
    };

    // Force canvas redraw so center text plugin picks up current CSS variables.
    spendingChart.update("none");
  }

  const centerTextPlugin = {
    id: "centerTextPlugin",
    afterDraw(chart) {
      const dataset = chart?.data?.datasets?.[0];
      if (!dataset || !dataset.data || !dataset.data.length) return;

      const meta = chart.getDatasetMeta(0);
      if (!meta || !meta.data || !meta.data.length) return;

      const total = dataset.data.reduce((sum, value) => sum + Number(value || 0), 0);
      if (!total) return;

      const x = meta.data[0].x;
      const y = meta.data[0].y;
      const ctx = chart.ctx;

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const textColor = getComputedStyle(document.body)
        .getPropertyValue("--text")
        .trim() || "#ffffff";

      const subTextColor = getComputedStyle(document.body)
        .getPropertyValue("--muted")
        .trim() || "rgba(255,255,255,0.65)";

      ctx.fillStyle = textColor;
      ctx.font = "bold 22px Sansation, sans-serif";
      ctx.fillText(`$${total.toFixed(2)}`, x, y - 10);

      ctx.fillStyle = subTextColor;
      ctx.font = "12px sans-serif";
      ctx.fillText("Total Spent", x, y + 14);

      ctx.restore();
    }
  };

  async function loadSpendingChart() {
    const canvas = document.getElementById("spendingPie");
    const list = document.getElementById("spendingList");
    const empty = document.getElementById("spendingEmpty");

    if (!canvas || !list || !empty || !window.handler || typeof Chart === "undefined") {
      return;
    }

    try {
      const expenses = JSON.parse(await handlerCall("get_expenses", "") || "[]");
      const categories = JSON.parse(await handlerCall("get_expense_categories") || "[]");

      const now = new Date();
      const currentMonth = monthKeyFromDate(now);

      // get_expenses() already returns only expense rows
      const monthExpenses = expenses.filter((tx) => txMonthKey(tx.date) === currentMonth);

      const totalsByCategory = {};
      monthExpenses.forEach((tx) => {
        const category =
          String(tx.category || tx.categoryName || "Other").trim() || "Other";
        const amount = Math.abs(Number(tx.amount || 0) || 0);

        if (amount > 0) {
          totalsByCategory[category] = (totalsByCategory[category] || 0) + amount;
        }
      });

      const sorted = Object.entries(totalsByCategory).sort((a, b) => b[1] - a[1]);

      if (!sorted.length) {
        if (spendingChart) {
          spendingChart.destroy();
          spendingChart = null;
        }
        list.innerHTML = "";
        empty.style.display = "block";
        canvas.style.display = "none";
        return;
      }

      empty.style.display = "none";
      canvas.style.display = "block";

      const labels = sorted.map(([category]) => category);
      const data = sorted.map(([, amount]) => amount);

      const colorMap = {};
      categories.forEach((cat) => {
        colorMap[cat.name] = cat.color;
      });

      const fallbackColors = [
        "#7c3aed",
        "#22d3ee",
        "#34d399",
        "#f97316",
        "#fb7185",
        "#facc15",
        "#60a5fa",
        "#a78bfa",
      ];

      const colors = labels.map(
        (label, index) => colorMap[label] || fallbackColors[index % fallbackColors.length],
      );

      if (spendingChart) {
        spendingChart.destroy();
        spendingChart = null;
      }

      spendingChart = new Chart(canvas, {
        type: "doughnut",
        data: {
          labels,
          datasets: [
            {
              data,
              backgroundColor: colors,
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "68%",
          plugins: {
            legend: {
              display: true,
              position: "bottom",
            },
            tooltip: {
              callbacks: {
                label(context) {
                  const value = Number(context.raw || 0);
                  const total = data.reduce((sum, n) => sum + n, 0);
                  const percent = total ? ((value / total) * 100).toFixed(1) : "0.0";
                  return `${context.label}: $${value.toFixed(2)} (${percent}%)`;
                },
              },
            },
          },
        },
        plugins: [centerTextPlugin],
      });

      applySpendingChartTheme();

      const totalSpent = data.reduce((sum, n) => sum + n, 0);

      list.innerHTML = sorted
        .map(([category, amount]) => {
          const percent = totalSpent ? ((amount / totalSpent) * 100).toFixed(1) : "0.0";
          return `
          <li>
            <span>${escapeHtml(category)}</span>
            <span>$${amount.toFixed(2)} (${percent}%)</span>
          </li>
        `;
        })
        .join("");
    } catch (error) {
      console.error("Failed to load Total Spending chart:", error);

      if (spendingChart) {
        spendingChart.destroy();
        spendingChart = null;
      }

      document.getElementById("spendingList").innerHTML = "";
      document.getElementById("spendingEmpty").style.display = "block";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderSummaryPage();
    loadSpendingChart();
  });

  window.addEventListener("plutus-db-changed", () => {
    renderSummaryPage();
    loadSpendingChart();
  });

  window.addEventListener("plutus-theme-changed", () => {
    applySpendingChartTheme();
  });

  dockBtn.addEventListener("click", () => {
    renderSummaryPage();
    loadSpendingChart();
  });
  // end of Total Spending card segment

  window.addEventListener("plutus-db-changed", renderSummaryPage);
  dockBtn.addEventListener("click", () => {
    renderSummaryPage();
  });

  renderSummaryPage();
})();
