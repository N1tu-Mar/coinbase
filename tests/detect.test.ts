// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { observePreview } from "../src/content/detect.js";
import { BADGE_ATTR } from "../src/content/badge.js";

const CONTAINER = "[data-test-preview]";

let stop: (() => void) | undefined;

afterEach(() => {
  stop?.();
  stop = undefined;
  document.body.innerHTML = "";
});

/** detect.ts debounces 100ms and MutationObserver delivers on a microtask. */
const settle = () => new Promise((r) => setTimeout(r, 160));

function addContainer(): Element {
  const el = document.createElement("div");
  el.setAttribute("data-test-preview", "");
  document.body.appendChild(el);
  return el;
}

function addBadge(parent: Element): Element {
  const el = document.createElement("div");
  el.setAttribute(BADGE_ATTR, "");
  parent.appendChild(el);
  return el;
}

describe("observePreview", () => {
  it("fires when the preview container appears", async () => {
    let calls = 0;
    stop = observePreview(() => calls++, CONTAINER);
    addContainer();
    await settle();
    expect(calls).toBe(1);
  });

  it("does not re-fire when our own badge is inserted", async () => {
    const root = addContainer();
    let calls = 0;
    stop = observePreview(() => calls++, CONTAINER);
    await settle();
    expect(calls).toBe(1);

    // This is the loop: render() inserts the badge into the observed subtree.
    addBadge(root);
    await settle();
    expect(calls).toBe(1);
  });

  it("does not re-fire when our badge is removed and replaced", async () => {
    const root = addContainer();
    const badge = addBadge(root);
    let calls = 0;
    stop = observePreview(() => calls++, CONTAINER);
    await settle();
    expect(calls).toBe(1);

    badge.remove();
    addBadge(root);
    await settle();
    expect(calls).toBe(1);
  });

  it("ignores mutations inside the badge subtree", async () => {
    const root = addContainer();
    const badge = addBadge(root);
    let calls = 0;
    stop = observePreview(() => calls++, CONTAINER);
    await settle();
    expect(calls).toBe(1);

    badge.appendChild(document.createElement("span"));
    await settle();
    expect(calls).toBe(1);
  });

  it("still fires when the page itself changes", async () => {
    const root = addContainer();
    let calls = 0;
    stop = observePreview(() => calls++, CONTAINER);
    await settle();
    expect(calls).toBe(1);

    // Coinbase refreshing the quote on its timer must still reach us.
    root.appendChild(document.createElement("span"));
    await settle();
    expect(calls).toBe(2);
  });

  it("stops firing after the returned disconnect is called", async () => {
    const root = addContainer();
    let calls = 0;
    stop = observePreview(() => calls++, CONTAINER);
    await settle();
    stop();
    root.appendChild(document.createElement("span"));
    await settle();
    expect(calls).toBe(1);
  });

  it("stays inert when the selector has not landed yet (R3)", async () => {
    let calls = 0;
    stop = observePreview(() => calls++, "");
    addContainer();
    await settle();
    expect(calls).toBe(0);
  });
});
