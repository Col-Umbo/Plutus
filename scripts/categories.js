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

  const dockBtn = document.getElementById("categories");

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

          // Delete Button
          const actions = document.createElement("div");
          actions.className = "cat-actions";

          const del = document.createElement("button");
          del.className = "delete-btn";
          del.type = "button";
          del.title = "Delete category";
          del.innerHTML = `
            <img class="tableIcon"
              src="Icons/delete_dark-mode.png"
              data-dark="Icons/delete_dark-mode.png"
              data-light="Icons/delete_light-mode.png"
              alt="Delete" />
          `;

          del.addEventListener("click", () => {
            if (!window.handler) return;

            if (item.type === "expense") {
              window.handler.delete_expense_category(item.name);
            } else {
              window.handler.delete_income_category(item.name);
            }

            setTimeout(() => {
              renderCategoriesFromBackend();
              if (typeof populateCategories === "function")
                populateCategories();
              if (typeof updateDockIcons === "function") updateDockIcons();
            }, 50);
          });

          actions.appendChild(del);
          // end of delete button segment

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
  window.addEventListener("plutus-db-changed", renderCategoriesFromBackend);

  dockBtn.addEventListener("click", () => {
    renderCategoriesFromBackend();
  });

  // Init
  renderCategoriesFromBackend();
})();
