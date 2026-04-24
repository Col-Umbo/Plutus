const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRuntime, flush } = require("./js_test_utils");

function loadTransactionsWith(handler) {
  const { context, document, window } = createRuntime({
    ids: [
      "openAddModal",
      "modalBackdrop",
      "txForm",
      "incomeTotal",
      "expenseTotal",
      "txList",
      "emptyState",
      "closeModal",
      "cancelBtn",
      "txType",
      "txAmount",
      "txDate",
      "txCategory",
      "txName",
      "txRepeats",
      "repeatEveryWrap",
      "repeatEvery",
      "modalTitle",
      "txSubmitBtn",
      "searchInput",
      "transaction",
    ],
    classes: [
      {
        className: "pill",
        count: 3,
        factory(index) {
          const filters = ["all", "income", "expense"];
          return { dataset: { filter: filters[index] } };
        },
      },
    ],
  });

  const txType = document.getElementById("txType");
  const txAmount = document.getElementById("txAmount");
  const txDate = document.getElementById("txDate");
  const txCategory = document.getElementById("txCategory");
  const txName = document.getElementById("txName");
  const txRepeats = document.getElementById("txRepeats");
  const repeatEvery = document.getElementById("repeatEvery");
  const txForm = document.getElementById("txForm");

  txType.value = "expense";
  repeatEvery.value = "monthly";
  txForm.reset = () => {
    txAmount.value = "";
    txDate.value = "";
    txCategory.value = "";
    txName.value = "";
    txRepeats.checked = false;
    repeatEvery.value = "monthly";
    txType.value = "expense";
  };

  window.handler = handler;
  context.handler = handler;

  vm.createContext(context);
  const source = fs.readFileSync(
    path.join(__dirname, "..", "scripts", "transactions.js"),
    "utf8",
  );
  vm.runInContext(source, context, { filename: "transactions.js" });
  return { context, document };
}

function makeBaseHandler(overrides = {}) {
  const calls = {
    addExpense: [],
    addIncome: [],
  };
  const handler = {
    get_expense_categories(cb) {
      cb(JSON.stringify([{ name: "Food" }, { name: "Rent" }]));
    },
    get_income_categories(cb) {
      cb(JSON.stringify([{ name: "Paycheck" }]));
    },
    get_expenses(_month, cb) {
      cb(
        JSON.stringify([
          { id: 1, date: "2026-04-02", amount: 500, name: "Rent", category: "Rent", recurring: false, frequency: 0 },
        ]),
      );
    },
    get_income(_month, cb) {
      cb(
        JSON.stringify([
          { id: 2, date: "2026-04-03", amount: 2000, name: "Pay", category: "Paycheck", recurring: false, frequency: 0 },
        ]),
      );
    },
    add_expense_with_date(...args) {
      calls.addExpense.push(args);
    },
    add_income_with_date(...args) {
      calls.addIncome.push(args);
    },
    update_expense() {},
    update_income() {},
    delete_expense() {},
    delete_income() {},
    ...overrides,
  };
  return { handler, calls };
}

test("transactions.js renders totals and transaction rows on init", async () => {
  const { handler } = makeBaseHandler();
  const { document } = loadTransactionsWith(handler);
  await flush();

  assert.match(document.getElementById("incomeTotal").textContent, /\$?2,?000(\.00)?/);
  assert.match(document.getElementById("expenseTotal").textContent, /\$?500(\.00)?/);
  assert.equal(document.getElementById("txList").children.length, 2);
  assert.equal(document.getElementById("emptyState").style.display, "none");
});

test("transactions.js submits expense form with repeat frequency mapping", async () => {
  const { handler, calls } = makeBaseHandler();
  const { document } = loadTransactionsWith(handler);
  await flush();

  document.getElementById("txType").value = "expense";
  document.getElementById("txAmount").value = "42.5";
  document.getElementById("txDate").value = "2026-04-11";
  document.getElementById("txCategory").value = "Food";
  document.getElementById("txName").value = "Lunch";
  document.getElementById("txRepeats").checked = true;
  document.getElementById("repeatEvery").value = "weekly";

  document.getElementById("txForm").dispatchEvent({
    type: "submit",
    preventDefault() {},
  });
  await flush();

  assert.equal(calls.addExpense.length, 1);
  assert.deepEqual(calls.addExpense[0], [
    "2026-04-11",
    "Lunch",
    42.5,
    "Food",
    true,
    7,
    "26-4-15",
  ]);
});

test("transactions.js applies income filter when income pill is clicked", async () => {
  const { handler } = makeBaseHandler();
  const { document } = loadTransactionsWith(handler);
  await flush();

  const pills = document.querySelectorAll(".pill");
  const incomePill = pills.find((el) => el.dataset.filter === "income");
  incomePill.click();
  await flush();

  assert.equal(document.getElementById("txList").children.length, 1);
  assert.match(document.getElementById("incomeTotal").textContent, /\$?2,?000(\.00)?/);
});
