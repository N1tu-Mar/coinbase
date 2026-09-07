import { ADVANCED_URL, FEE_TIER, SELECTORS, isConfigured } from "../config.js";
import { breakdown } from "../lib/calc.js";
import type { TickerRequest, TickerResponse } from "../lib/types.js";
import { render, remove } from "./badge.js";
import { observePreview } from "./detect.js";
import { scrape } from "./scrape.js";

let loggedFailure = false;

function logOnce(message: string): void {
  if (loggedFailure) return;
  loggedFailure = true;
  console.warn(`[spread-check] ${message}`);
}

async function onPreview(root: Element): Promise<void> {
  const quote = scrape(root);
  if (!quote || !FEE_TIER) return remove(); // rule 2.5: render nothing

  const anchor = root.querySelector(SELECTORS.confirmButton);
  if (!anchor) return remove();

  const request: TickerRequest = { type: "spreadcheck:ticker", productId: quote.productId };
  let response: TickerResponse;
  try {
    response = await chrome.runtime.sendMessage(request);
  } catch (e) {
    logOnce(`ticker request failed: ${String(e)}`);
    return remove();
  }

  if (!response?.ok) {
    logOnce(`ticker unavailable: ${response?.error ?? "no response"}`);
    return remove();
  }

  render(
    breakdown(quote, response.ticker, FEE_TIER, ADVANCED_URL(quote.productId)),
    anchor,
  );
}

if (isConfigured()) {
  observePreview((root) => void onPreview(root));
} else {
  logOnce("inactive: waiting on research deliverables (see BUILD_STATUS.md)");
}
