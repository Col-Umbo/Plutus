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
  const modalTitle = $("#modalTitle");
  const txSubmitBtn = $("#txSubmitBtn");

  let editingTx = null;

  const searchInput = $("#searchInput");
  const pills = $$(".pill");

  const dockBtn = document.getElementById("transaction");

  let currentFilter = "all"; // all | income | expense

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

  function populateCategories(selectedValue = "") {
    if (!window.handler || !txCategory) return;

    const type = txType.value;
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

      if (selectedValue) {
        txCategory.value = selectedValue;
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

  function setTransactionModalMode(mode, tx = null) {
    editingTx = mode === "edit" ? tx : null;

    if (mode === "edit" && tx) {
      modalTitle.textContent = "Edit Transaction";
      txSubmitBtn.textContent = "Save Changes";

      txType.value = tx.type;
      txType.disabled = true;

      txAmount.value = Number(tx.amount || 0);
      txDate.value = tx.date || "";
      txName.value = tx.name || "";
      txRepeats.checked = Boolean(tx.recurring);
      repeatEveryWrap.classList.toggle("hidden", !txRepeats.checked);

      const freq = Number(tx.frequency || 0);
      if (freq === 7) repeatEvery.value = "weekly";
      else if (freq === 14) repeatEvery.value = "biweekly";
      else if (freq === 30) repeatEvery.value = "monthly";
      else if (freq === 365) repeatEvery.value = "yearly";
      else repeatEvery.value = "monthly";

      populateCategories(tx.category || "");
    } else {
      modalTitle.textContent = "Add Transaction";
      txSubmitBtn.textContent = "Add";

      editingTx = null;
      txType.disabled = false;
      txForm.reset();
      repeatEveryWrap.classList.add("hidden");

      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      txDate.value = `${yyyy}-${mm}-${dd}`;

      populateCategories();
    }
  }

  function openModal(mode = "add", tx = null) {
    setTransactionModalMode(mode, tx);
    modalBackdrop.classList.remove("hidden");
    modalBackdrop.setAttribute("aria-hidden", "false");
    txAmount.focus();
  }

  function closeModal() {
    modalBackdrop.classList.add("hidden");
    modalBackdrop.setAttribute("aria-hidden", "true");
    editingTx = null;
    txType.disabled = false;
    txForm.reset();
    repeatEveryWrap.classList.add("hidden");
    modalTitle.textContent = "Add Transaction";
    txSubmitBtn.textContent = "Add";
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
      const split = t.date.split("-", 3);
      const combined = split[1] + "-" + split[2] + "-" + split[0];
      date.textContent = combined || "";

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

      // Edit Button Segment
      const actions = document.createElement("div");
      actions.className = "row-actions";

      const edit = document.createElement("button");
      edit.className = "edit-btn";
      edit.type = "button";
      edit.textContent = "Edit";
      edit.addEventListener("click", () => openModal("edit", t));

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

      actions.append(edit, del);
      // end of edit button segment

      const repeat = document.createElement("div");
      repeat.className = "repeat muted";
      repeat.textContent = t.repeats ? `Repeats: ${t.repeatEvery}` : "";

      li.append(date, name, cat, amt, actions, repeat);
      txListEl.appendChild(li);
    }

    if (typeof updateDockIcons === "function") {
      updateDockIcons();
    }
  }

  // Events
  openAddModalBtn.addEventListener("click", () => {
    openModal("add");
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
    const date = txDate.value;

    if (!category || !name || !date) {
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

    if (editingTx) {
      if (type === "expense") {
        handler.update_expense(
          Number(editingTx.id),
          date,
          name,
          amount,
          category,
          repeats,
          frequency,
          endDate,
        );
      } else {
        handler.update_income(
          Number(editingTx.id),
          date,
          name,
          amount,
          category,
          repeats,
          frequency,
          endDate,
        );
      }
    } else {
      if (type === "expense") {
        handler.log_expense(
          date,
          name,
          amount,
          category,
          repeats,
          frequency,
          endDate,
        );
      } else {
        handler.log_income(
          date,
          name,
          amount,
          category,
          repeats,
          frequency,
          endDate,
        );
      }
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

  dockBtn.addEventListener("click", () => {
    populateCategories();
    loadTransactionsFromBackend();
  });

  // Init
  populateCategories();
  loadTransactionsFromBackend();
})();
