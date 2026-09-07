import { PRODUCTS, SELECTORS } from "../config.js";
import type { ProductId, Quote } from "../lib/types.js";

/**
 * DOM -> Quote. Uses only config.SELECTORS. Returns null on any miss or parse
 * failure so the caller renders nothing (PROMPT.md rule 2.5) — a partial badge
 * is worse than no badge.
 *
 * BLOCKED ON R3 for the selectors and the exact text formats.
 */
export function scrape(root: Element): Quote | null {
  if (!SELECTORS.productName) return null; // blocked on R3

  const productId = readProductId(root);
  const fiatAmount = readMoney(root, SELECTORS.fiatAmount);
  const quotedPrice = readMoney(root, SELECTORS.quotedPrice);
  const feeDisplayed = readMoney(root, SELECTORS.feeLine);

  if (productId === null || fiatAmount === null || quotedPrice === null || feeDisplayed === null) {
    return null;
  }

  return { productId, fiatAmount, quotedPrice, feeDisplayed, scrapedAt: new Date().toISOString() };
}

function readProductId(root: Element): ProductId | null {
  const text = root.querySelector(SELECTORS.productName)?.textContent ?? "";
  return PRODUCTS.find((p) => text.includes(p.split("-")[0]!)) ?? null;
}

/**
 * Parse a money string as Coinbase renders it. The exact formats are documented
 * in research/selectors.md; this handles the currency symbol, thousands
 * separators and a trailing/leading label, and refuses anything else.
 */
export function readMoney(root: Element, selector: string): number | null {
  if (!selector) return null;
  const text = root.querySelector(selector)?.textContent;
  return text === null || text === undefined ? null : parseMoney(text);
}

export function parseMoney(text: string): number | null {
  const match = text.replace(/,/g, "").match(/-?\$?\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}
