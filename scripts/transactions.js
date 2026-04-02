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

      // Delete Button Segment
      const actions = document.createElement("div");
      actions.className = "actions";

      const del = document.createElement("button");
      del.className = "delete-btn";
      del.type = "button";
      del.title = "Delete transaction";
      del.innerHTML = `
        <img class="tableIcon"
          src="Icons/delete_dark-mode.png"
          data-dark="Icons/delete_dark-mode.png"
          data-light="Icons/delete_light-mode.png"
          alt="Delete" />
      `;

      del.addEventListener("click", () => {
        if (!window.handler) return;

        if (t.type === "expense") {
          window.handler.delete_expense(Number(t.id));
        } else {
          window.handler.delete_income(Number(t.id));
        }

        setTimeout(loadTransactionsFromBackend, 50);
      });

      actions.appendChild(del);
      // end of delete button segment

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
  window.addEventListener("plutus-db-changed", () => {
    populateCategories();
    loadTransactionsFromBackend();
  });

  // Init
  populateCategories();
  loadTransactionsFromBackend();
})();

