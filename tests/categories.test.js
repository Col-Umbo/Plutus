const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRuntime, flush } = require("./js_test_utils");

function loadCategoriesWith(handler) {
  const { context, document, window } = createRuntime({
    ids: [
      "openCatModal",
      "catModalBackdrop",
      "catForm",
      "catIncomeTotal",
      "catExpenseTotal",
      "catList",
      "catEmptyState",
      "closeCatModal",
      "catCancelBtn",
      "catType",
      "catColor",
      "catName",
      "catModalTitle",
      "catSubmitBtn",
      "catSearchInput",
      "categories",
    ],
    classes: [
      {
        className: "cat-pill",
        count: 3,
        factory(index) {
          const filters = ["all", "income", "expense"];
          return { dataset: { filter: filters[index] } };
        },
      },
    ],
  });

  const form = document.getElementById("catForm");
  const catType = document.getElementById("catType");
  const catColor = document.getElementById("catColor");
  const catName = document.getElementById("catName");
  catType.value = "expense";
  catColor.value = "#22c55e";
  form.reset = () => {
    catType.value = "expense";
    catColor.value = "#22c55e";
    catName.value = "";
  };

  window.handler = handler;
  context.handler = handler;

  vm.createContext(context);
  const source = fs.readFileSync(
    path.join(__dirname, "..", "scripts", "categories.js"),
    "utf8",
  );
  vm.runInContext(source, context, { filename: "categories.js" });
  return { document };
}

function makeHandler(overrides = {}) {
  const calls = { add: [] };
  const handler = {
    get_expense_categories(cb) {
      cb(JSON.stringify([{ name: "Rent", color: "#f00" }, { name: "Food", color: "#0f0" }]));
    },
    get_income_categories(cb) {
      cb(JSON.stringify([{ name: "Salary", color: "#00f" }]));
    },
    add_category(...args) {
      calls.add.push(args);
    },
    update_income_category() {},
    update_expense_category() {},
    delete_expense_category() {},
    delete_income_category() {},
    ...overrides,
  };
  return { handler, calls };
}

test("categories.js renders counts and list entries on init", async () => {
  const { handler } = makeHandler();
  const { document } = loadCategoriesWith(handler);
  await flush();

  assert.equal(document.getElementById("catIncomeTotal").textContent, "1");
  assert.equal(document.getElementById("catExpenseTotal").textContent, "2");
  assert.equal(document.getElementById("catList").children.length, 3);
  assert.equal(document.getElementById("catEmptyState").style.display, "none");
});

test("categories.js submits new income category via add_category", async () => {
  const { handler, calls } = makeHandler();
  const { document } = loadCategoriesWith(handler);
  await flush();

  document.getElementById("catType").value = "income";
  document.getElementById("catName").value = "Bonus";
  document.getElementById("catColor").value = "#abcdef";

  document.getElementById("catForm").dispatchEvent({
    type: "submit",
    preventDefault() {},
  });
  await flush();

  assert.equal(calls.add.length, 1);
  assert.deepEqual(calls.add[0], [true, "Bonus", 0, "#abcdef"]);
});

test("categories.js applies search filter before rendering list", async () => {
  const { handler } = makeHandler();
  const { document } = loadCategoriesWith(handler);
  await flush();

  const search = document.getElementById("catSearchInput");
  search.value = "foo";
  search.dispatchEvent({ type: "input" });
  await flush();

  assert.equal(document.getElementById("catList").children.length, 1);
});
