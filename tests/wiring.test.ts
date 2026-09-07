// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { hasBadge } from "../src/content/badge.js";
import { quoteKey, shouldRefresh } from "../src/content/index.js";
import type { Quote } from "../src/lib/types.js";

/**
 * detect.ts stops the badge retriggering its own observer. This is the second
 * half: Coinbase mutates the preview screen constantly (the quote refreshes on
 * a timer), and every one of those reached the service worker and re-rendered
 * the badge even when not a single number had changed.
 *
 * The numbers below are identity values for a cache key — what is compared,
 * not what is displayed. Real quotes come from research/dom/ at R3.
 */
const quote: Quote = {
  productId: "BTC-USD",
  fiatAmount: 10,
  quotedPrice: 100,
  feeDisplayed: 0,
  scrapedAt: "2026-09-07T07:26:31Z",
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("quoteKey", () => {
  it("ignores the scrape timestamp, which changes on every pass", () => {
    expect(quoteKey({ ...quote, scrapedAt: "2026-09-07T09:00:00Z" })).toBe(quoteKey(quote));
  });

  it("changes when any displayed number changes", () => {
    const base = quoteKey(quote);
    expect(quoteKey({ ...quote, fiatAmount: quote.fiatAmount + 1 })).not.toBe(base);
    expect(quoteKey({ ...quote, quotedPrice: quote.quotedPrice + 1 })).not.toBe(base);
    expect(quoteKey({ ...quote, feeDisplayed: quote.feeDisplayed + 1 })).not.toBe(base);
    expect(quoteKey({ ...quote, productId: "ETH-USD" })).not.toBe(base);
  });
});

describe("shouldRefresh", () => {
  const key = quoteKey(quote);

  it("skips when nothing changed and the badge is already showing", () => {
    expect(shouldRefresh(key, key, true)).toBe(false);
  });

  it("runs when the quote changed", () => {
    expect(shouldRefresh(quoteKey({ ...quote, quotedPrice: 101 }), key, true)).toBe(true);
  });

  it("runs when the badge is gone, even if the quote is unchanged", () => {
    // Coinbase re-rendering its own subtree takes our badge with it.
    expect(shouldRefresh(key, key, false)).toBe(true);
  });

  it("runs on the first pass", () => {
    expect(shouldRefresh(key, null, false)).toBe(true);
  });
});

describe("hasBadge", () => {
  it("is false on a page we have not touched", () => {
    expect(hasBadge()).toBe(false);
  });

  it("is true once the badge is in the document", () => {
    const el = document.createElement("div");
    el.setAttribute("data-spreadcheck", "");
    document.body.appendChild(el);
    expect(hasBadge()).toBe(true);
  });
});
