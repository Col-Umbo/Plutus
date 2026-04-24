const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRuntime, flush } = require("./js_test_utils");

function monthIsoDate(offsetMonths = 0, day = 5) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offsetMonths, day);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function loadSummaryWithHandler(handler) {
  const { context, document, window } = createRuntime({
    ids: [
      "view-home",
      "summaryMonthLabel",
      "summaryIncome",
      "summaryExpenses",
      "summaryNet",
      "summaryRemaining",
      "summaryBudgetUsed",
      "summaryDaysLeft",
      "summaryProjectedSpend",
      "summaryBudgetStatus",
      "summaryTopCategories",
      "summaryTopCategoriesEmpty",
      "summaryRecentActivity",
      "summaryRecentEmpty",
      "home",
      "spendingPie",
      "spendingList",
      "spendingEmpty",
    ],
  });

  window.handler = handler;
  context.handler = handler;
  context.Chart = undefined;

  const source = fs.readFileSync(
    path.join(__dirname, "..", "scripts", "summary.js"),
    "utf8",
  );
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "summary.js" });
  return { document };
}

test("summary.js renders monthly totals and budget status", async () => {
  const currentDate = monthIsoDate(0, 7);
  const lastMonthDate = monthIsoDate(-1, 14);

  const handler = {
    get_expenses(_month, cb) {
      cb(
        JSON.stringify([
          { id: 1, date: currentDate, name: "Rent", amount: 1000, category: "Rent" },
          { id: 2, date: lastMonthDate, name: "Old", amount: 999, category: "Rent" },
          { id: 3, date: currentDate, name: "Food", amount: 500, category: "Food" },
        ]),
      );
    },
    get_income(_month, cb) {
      cb(
        JSON.stringify([
          { id: 4, date: currentDate, name: "Salary", amount: 3000, category: "Job" },
        ]),
      );
    },
    get_budget_amount(cb) {
      cb(JSON.stringify({ amount: 2400 }));
    },
    get_budget_allocations(cb) {
      cb(
        JSON.stringify([
          { category: "Rent", limit: 1500 },
          { category: "Food", limit: 700 },
        ]),
      );
    },
  };

  const { document } = loadSummaryWithHandler(handler);
  await flush();

  const income = document.getElementById("summaryIncome").textContent;
  const expense = document.getElementById("summaryExpenses").textContent;
  const budgetUsed = document.getElementById("summaryBudgetUsed").textContent;
  const status = document.getElementById("summaryBudgetStatus").textContent;
  const topList = document.getElementById("summaryTopCategories");
  const recentList = document.getElementById("summaryRecentActivity");

  assert.match(income, /\$?3,?000(\.00)?/);
  assert.match(expense, /\$?1,?500(\.00)?/);
  assert.equal(budgetUsed, "62.5%");
  assert.ok(status.length > 0);
  assert.equal(topList.children.length, 2);
  assert.ok(recentList.children.length >= 2);
});

test("summary.js shows default state when budget is not set", async () => {
  const currentDate = monthIsoDate(0, 10);
  const handler = {
    get_expenses(_month, cb) {
      cb(JSON.stringify([{ id: 1, date: currentDate, amount: 120, name: "Gas", category: "Fuel" }]));
    },
    get_income(_month, cb) {
      cb("[]");
    },
    get_budget_amount(cb) {
      cb(JSON.stringify({ amount: 0 }));
    },
    get_budget_allocations(cb) {
      cb("[]");
    },
  };

  const { document } = loadSummaryWithHandler(handler);
  await flush();

  assert.equal(document.getElementById("summaryBudgetUsed").textContent, "N/A");
  assert.equal(document.getElementById("summaryRemaining").textContent, "Not set");
  assert.match(
    document.getElementById("summaryBudgetStatus").textContent,
    /Set a monthly budget/,
  );
});
