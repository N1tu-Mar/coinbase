import { ADVANCED_URL, FEE_TIER, SELECTORS, isConfigured } from "../config.js";
import { breakdown } from "../lib/calc.js";
import type { Quote, TickerRequest, TickerResponse } from "../lib/types.js";
import { hasBadge, render, remove } from "./badge.js";
import { observePreview } from "./detect.js";
import { scrape } from "./scrape.js";

let loggedFailure = false;
let inFlight = false;
let lastKey: string | null = null;

function logOnce(message: string): void {
  if (loggedFailure) return;
  loggedFailure = true;
  console.warn(`[spread-check] ${message}`);
}

/** Identity of everything the badge shows. The scrape time is deliberately out. */
export function quoteKey(q: Quote): string {
  return [q.productId, q.fiatAmount, q.quotedPrice, q.feeDisplayed].join("|");
}

/**
 * Coinbase mutates the preview screen constantly — the quote refreshes on a
 * timer — so detect fires far more often than anything actually changes. Only
 * go back to the service worker when a displayed number moved, or when our
 * badge is gone because Coinbase re-rendered its own subtree.
 */
export function shouldRefresh(
  key: string,
  previousKey: string | null,
  badgePresent: boolean,
): boolean {
  return key !== previousKey || !badgePresent;
}

async function onPreview(root: Element): Promise<void> {
  if (inFlight) return; // a slow ticker response must not queue up behind itself

  const quote = scrape(root);
  if (!quote || !FEE_TIER) {
    lastKey = null;
    return remove(); // rule 2.5: render nothing
  }

  const key = quoteKey(quote);
  if (!shouldRefresh(key, lastKey, hasBadge())) return;

  const anchor = root.querySelector(SELECTORS.confirmButton);
  if (!anchor) {
    lastKey = null;
    return remove();
  }

  const request: TickerRequest = { type: "spreadcheck:ticker", productId: quote.productId };
  let response: TickerResponse;
  inFlight = true;
  try {
    response = await chrome.runtime.sendMessage(request);
  } catch (e) {
    logOnce(`ticker request failed: ${String(e)}`);
    lastKey = null;
    return remove();
  } finally {
    inFlight = false;
  }

  if (!response?.ok) {
    logOnce(`ticker unavailable: ${response?.error ?? "no response"}`);
    lastKey = null;
    return remove();
  }

  render(
    breakdown(quote, response.ticker, FEE_TIER, ADVANCED_URL(quote.productId)),
    anchor,
  );
  lastKey = key;
}

if (isConfigured()) {
  observePreview((root) => void onPreview(root));
} else {
  logOnce("inactive: waiting on research deliverables (see BUILD_STATUS.md)");
}
