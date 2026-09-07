import { AMBIGUOUS_ASSET_NAMES, PRODUCT_ALIASES, PRODUCTS, SELECTORS } from "../config.js";
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
  return matchProductId(root.querySelector(SELECTORS.productName)?.textContent ?? "");
}

/**
 * Identify which of the three MVP products a piece of preview text names.
 *
 * Matches the display name as well as the symbol — Coinbase writes "Bitcoin",
 * not "BTC", on most of the buy flow. Returns null when the text names none of
 * them, names more than one, or names a different asset whose name contains one
 * of ours ("Bitcoin Cash").
 */
export function matchProductId(text: string): ProductId | null {
  if (!text.trim()) return null;

  for (const name of AMBIGUOUS_ASSET_NAMES) {
    if (containsWord(text, name)) return null;
  }

  const hits = PRODUCTS.filter((productId) =>
    (PRODUCT_ALIASES[productId] ?? []).some((alias) => containsWord(text, alias)),
  );

  return hits.length === 1 ? hits[0]! : null;
}

function containsWord(text: string, word: string): boolean {
  // \b would not fire against the hyphen in "BTC-USD", so bound on characters
  // that could extend the token instead.
  const escaped = word.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9])${escaped}([^A-Za-z0-9]|$)`, "i").test(text);
}

/**
 * Parse a money string as Coinbase renders it. The exact formats are documented
 * in research/selectors.md; this handles the currency symbol, thousands
 * separators and a surrounding label, and refuses anything else.
 */
export function readMoney(root: Element, selector: string): number | null {
  if (!selector) return null;
  const text = root.querySelector(selector)?.textContent;
  return text === null || text === undefined ? null : parseMoney(text);
}

/** `$1,234.56` and `1,234.56` both parse; `(...)` and a leading `-` negate. */
const CURRENCY_AMOUNT = /(\()?\s*-?\s*\$\s*(-?\d+(?:\.\d+)?)\s*(\))?/g;
const BARE_AMOUNT = /(\()?\s*(-?\d+(?:\.\d+)?)\s*(\))?\s*(%)?/g;

export function parseMoney(text: string): number | null {
  // Thousands separators and non-breaking spaces first, so the patterns below
  // only ever see a plain number.
  const normalized = text.replace(/[  ]/g, " ").replace(/(\d),(?=\d{3}\b)/g, "$1");

  const currency = collect(normalized, CURRENCY_AMOUNT, false);
  if (currency !== null) return currency;

  // No currency symbol anywhere: fall back to a bare number, but never to one
  // that is a percentage — reading "1.5%" as $1.50 is exactly the bug this
  // parser exists to avoid.
  if (normalized.includes("$")) return null;
  return collect(normalized, BARE_AMOUNT, true);
}

/**
 * Every amount the pattern finds must agree. More than one distinct value means
 * the selector caught more than one figure, and picking one would be a guess.
 */
function collect(text: string, pattern: RegExp, skipPercent: boolean): number | null {
  const found = new Set<number>();

  pattern.lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    const [whole, open, digits, close, percent] = match;
    if (skipPercent && percent) continue;

    const n = Number(digits);
    if (!Number.isFinite(n)) return null;

    const negated = whole.includes("-") || Boolean(open && close);
    found.add(negated ? -Math.abs(n) : n);
  }

  if (found.size !== 1) return null;
  return [...found][0]!;
}
