function createClassList(initial = []) {
  const set = new Set(initial);
  return {
    add: (...names) => names.forEach((name) => set.add(name)),
    remove: (...names) => names.forEach((name) => set.delete(name)),
    contains: (name) => set.has(name),
    toggle: (name, force) => {
      if (typeof force === "boolean") {
        if (force) set.add(name);
        else set.delete(name);
        return force;
      }
      if (set.has(name)) {
        set.delete(name);
        return false;
      }
      set.add(name);
      return true;
    },
    toArray: () => [...set],
  };
}

function createElement(doc, { id = "", classNames = [], dataset = {} } = {}) {
  const attrs = new Map();
  const listeners = new Map();
  const classList = createClassList(classNames);
  let innerHtmlValue = "";

  const element = {
    id,
    dataset: { ...dataset },
    style: { display: "", minHeight: "", setProperty() {} },
    classList,
    textContent: "",
    get innerHTML() {
      return innerHtmlValue;
    },
    set innerHTML(value) {
      innerHtmlValue = String(value ?? "");
      element.children = [];
    },
    value: "",
    checked: false,
    disabled: false,
    children: [],
    parentNode: null,
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(callback);
    },
    dispatchEvent(event) {
      const evt = event || { type: "" };
      if (!evt.preventDefault) evt.preventDefault = () => {};
      if (!evt.target) evt.target = element;
      const callbacks = listeners.get(evt.type) || [];
      callbacks.forEach((cb) => cb(evt));
      return true;
    },
    click() {
      element.dispatchEvent({ type: "click", target: element });
    },
    appendChild(child) {
      child.parentNode = element;
      element.children.push(child);
      return child;
    },
    append(...nodes) {
      nodes.forEach((node) => element.appendChild(node));
    },
    remove() {
      if (!element.parentNode) return;
      const siblings = element.parentNode.children;
      const idx = siblings.indexOf(element);
      if (idx >= 0) siblings.splice(idx, 1);
      element.parentNode = null;
    },
    querySelector(selector) {
      if (!selector || !selector.startsWith(".")) return null;
      const targetClass = selector.slice(1);
      const stack = [...element.children];
      while (stack.length) {
        const node = stack.shift();
        if (node.classList?.contains(targetClass)) return node;
        if (Array.isArray(node.children)) stack.push(...node.children);
      }
      return null;
    },
    querySelectorAll(selector) {
      if (!selector || !selector.startsWith(".")) return [];
      const targetClass = selector.slice(1);
      const result = [];
      const stack = [...element.children];
      while (stack.length) {
        const node = stack.shift();
        if (node.classList?.contains(targetClass)) result.push(node);
        if (Array.isArray(node.children)) stack.push(...node.children);
      }
      return result;
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
    focus() {},
    select() {},
    reset() {},
    closest(selector) {
      if (selector === "button[data-delete-id]") {
        let node = element;
        while (node) {
          if (
            node.dataset &&
            Object.prototype.hasOwnProperty.call(node.dataset, "deleteId")
          ) {
            return node;
          }
          node = node.parentNode;
        }
      }
      return null;
    },
  };

  doc._elements.push(element);
  if (id) {
    doc._byId.set(id, element);
  }
  return element;
}

function createMockDocument() {
  const listeners = new Map();
  const doc = {
    _byId: new Map(),
    _elements: [],
    body: null,
    documentElement: null,
    createElement(tagName) {
      const el = createElement(doc);
      el.tagName = String(tagName || "").toUpperCase();
      return el;
    },
    getElementById(id) {
      return doc._byId.get(id) || null;
    },
    querySelector(selector) {
      if (!selector) return null;
      if (selector.startsWith("#")) {
        return doc.getElementById(selector.slice(1));
      }
      if (selector.startsWith(".")) {
        const className = selector.slice(1);
        return doc._elements.find((el) => el.classList.contains(className)) || null;
      }
      return null;
    },
    querySelectorAll(selector) {
      if (!selector) return [];
      if (selector.includes(",")) {
        const items = selector
          .split(",")
          .flatMap((part) => doc.querySelectorAll(part.trim()));
        return Array.from(new Set(items));
      }
      if (selector.startsWith(".")) {
        const className = selector.slice(1);
        return doc._elements.filter((el) => el.classList.contains(className));
      }
      return [];
    },
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(callback);
    },
    dispatchEvent(event) {
      const callbacks = listeners.get(event.type) || [];
      callbacks.forEach((cb) => cb(event));
    },
  };

  doc.body = createElement(doc, { id: "body" });
  doc.documentElement = createElement(doc, { id: "documentElement" });
  return doc;
}

function createRuntime({ ids = [], classes = [] } = {}) {
  const document = createMockDocument();

  ids.forEach((id) => createElement(document, { id }));
  classes.forEach(({ className, count = 1, factory }) => {
    for (let i = 0; i < count; i += 1) {
      const seed = factory ? factory(i) : {};
      createElement(document, {
        id: seed.id || "",
        classNames: [className, ...(seed.classNames || [])],
        dataset: seed.dataset || {},
      });
    }
  });

  const windowListeners = new Map();
  const localStore = new Map();
  const window = {
    handler: null,
    addEventListener(type, callback) {
      if (!windowListeners.has(type)) windowListeners.set(type, []);
      windowListeners.get(type).push(callback);
    },
    dispatchEvent(event) {
      const callbacks = windowListeners.get(event.type) || [];
      callbacks.forEach((cb) => cb(event));
      return true;
    },
    matchMedia() {
      return { matches: false };
    },
    setTimeout(callback) {
      callback();
      return 0;
    },
    clearTimeout() {},
  };

  const context = {
    console,
    document,
    window,
    history: {
      pushState() {},
      replaceState() {},
    },
    location: { hash: "#home" },
    CustomEvent: function CustomEvent(type, init) {
      return { type, detail: init?.detail };
    },
    setTimeout: window.setTimeout,
    clearTimeout: window.clearTimeout,
    setInterval() {
      return 0;
    },
    clearInterval() {},
    localStorage: {
      getItem(key) {
        return localStore.has(key) ? localStore.get(key) : null;
      },
      setItem(key, value) {
        localStore.set(key, String(value));
      },
    },
    alert() {},
    confirm() {
      return true;
    },
    updateDockIcons() {},
  };

  context.$ = (sel, root = document) => root.querySelector(sel);
  context.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  context.globalThis = context;

  return { context, document, window };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

module.exports = {
  createElement,
  createRuntime,
  flush,
};
