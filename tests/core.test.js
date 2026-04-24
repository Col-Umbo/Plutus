const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createElement({ id = "", dataset = {} } = {}) {
  const classSet = new Set();
  const attrs = new Map();

  return {
    id,
    dataset: { ...dataset },
    style: {
      minHeight: "",
      setProperty() {},
    },
    textContent: "",
    value: "",
    src: "",
    classList: {
      add: (...names) => names.forEach((name) => classSet.add(name)),
      remove: (...names) => names.forEach((name) => classSet.delete(name)),
      contains: (name) => classSet.has(name),
      toggle: (name, force) => {
        if (typeof force === "boolean") {
          if (force) classSet.add(name);
          else classSet.delete(name);
          return force;
        }
        if (classSet.has(name)) {
          classSet.delete(name);
          return false;
        }
        classSet.add(name);
        return true;
      },
    },
    setAttribute(name, value) {
      attrs.set(name, String(value));
    },
    getAttribute(name) {
      return attrs.has(name) ? attrs.get(name) : null;
    },
    removeAttribute(name) {
      attrs.delete(name);
    },
    addEventListener() {},
    remove() {},
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    focus() {},
  };
}

function loadCoreScriptForTests() {
  const viewIds = [
    "view-home",
    "view-transactions",
    "view-budget",
    "view-categories",
    "view-goals",
  ];

  const elementById = new Map();
  viewIds.forEach((id) => elementById.set(id, createElement({ id })));
  elementById.set("page", createElement({ id: "page" }));

  const dockButtons = [
    "home",
    "transactions",
    "budget",
    "categories",
    "goals",
  ].map((target) => createElement({ dataset: { target } }));

  const body = createElement({ id: "body" });
  const documentElement = createElement({ id: "documentElement" });
  const localStore = new Map();

  const document = {
    body,
    documentElement,
    querySelector(selector) {
      if (selector.startsWith("#")) {
        return elementById.get(selector.slice(1)) || null;
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === ".dockBtn") return dockButtons;
      if (selector === ".dockIcon, .tableIcon, .lockIcon") return [];
      return [];
    },
    getElementById(id) {
      return elementById.get(id) || null;
    },
    addEventListener() {},
  };

  const history = {
    pushState() {},
    replaceState() {},
  };

  const location = { hash: "#home" };

  const window = {
    addEventListener() {},
    dispatchEvent() {},
    matchMedia() {
      return { matches: false };
    },
    setTimeout(callback) {
      callback();
      return 0;
    },
    clearTimeout() {},
    handler: null,
  };

  const context = vm.createContext({
    console,
    document,
    window,
    history,
    location,
    localStorage: {
      getItem(key) {
        return localStore.has(key) ? localStore.get(key) : null;
      },
      setItem(key, value) {
        localStore.set(key, String(value));
      },
    },
    CustomEvent: function CustomEvent(type, init) {
      return { type, detail: init?.detail };
    },
    setTimeout: window.setTimeout,
    clearTimeout: window.clearTimeout,
    setInterval() {
      return 0;
    },
    clearInterval() {},
  });
  context.globalThis = context;

  const coreScript = fs.readFileSync(
    path.join(__dirname, "..", "scripts", "core.js"),
    "utf8",
  );
  vm.runInContext(coreScript, context, { filename: "core.js" });

  return { context, elementById, dockButtons };
}

test("normalizeViewKey keeps known keys and defaults unknown to home", () => {
  const { context } = loadCoreScriptForTests();
  assert.equal(context.normalizeViewKey("transactions"), "transactions");
  assert.equal(context.normalizeViewKey("goals"), "goals");
  assert.equal(context.normalizeViewKey("not-real"), "home");
});

test("getViewDirection returns forward, backward, or null", () => {
  const { context } = loadCoreScriptForTests();
  assert.equal(context.getViewDirection("home", "budget"), "forward");
  assert.equal(context.getViewDirection("goals", "transactions"), "backward");
  assert.equal(context.getViewDirection("budget", "budget"), null);
  assert.equal(context.getViewDirection("missing", "home"), null);
});

test("setViewImmediately activates the expected view and dock button", () => {
  const { context, elementById, dockButtons } = loadCoreScriptForTests();
  context.setViewImmediately("budget");

  assert.equal(elementById.get("view-budget").classList.contains("active"), true);
  assert.equal(elementById.get("view-home").classList.contains("active"), false);

  const activeButton = dockButtons.find(
    (btn) => btn.dataset.target === "budget",
  );
  const inactiveButton = dockButtons.find((btn) => btn.dataset.target === "home");
  assert.equal(activeButton.getAttribute("aria-current"), "page");
  assert.equal(inactiveButton.getAttribute("aria-current"), null);
});
