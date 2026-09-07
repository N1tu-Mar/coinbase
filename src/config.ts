import type { FeeTier, ProductId } from "./lib/types.js";
import { FEE_TIER_FROM_RESEARCH } from "./generated/fee-tier.js";

/**
 * The ONLY place selectors, product ids, endpoint shapes and the fee tier live.
 *
 * Every exported constant carries a `// source:` comment. Anything still marked
 * `// TODO R<n>` is waiting on a `research/` deliverable and MUST stay empty
 * until that file lands — an empty value makes the extension render nothing
 * (PROMPT.md rule 2.5), a guessed value would violate rule 0.2.
 */

// source: PROMPT.md section 1 "MVP scope" (buy side, three pairs)
export const PRODUCTS: readonly ProductId[] = ["BTC-USD", "ETH-USD", "SOL-USD"];

/**
 * Text that identifies each product on the preview screen. Coinbase renders the
 * display name ("Bitcoin") far more often than the symbol, so both are matched.
 *
 * source: Coinbase asset display names, as used throughout coinbase.com.
 * TODO R3 — confirm the exact wording against research/dom/ and add anything the
 * real captures show. Nothing here is a price, a rate or a fee.
 */
export const PRODUCT_ALIASES: Readonly<Record<ProductId, readonly string[]>> = {
  "BTC-USD": ["BTC-USD", "BTC", "Bitcoin"],
  "ETH-USD": ["ETH-USD", "ETH", "Ethereum"],
  "SOL-USD": ["SOL-USD", "SOL", "Solana"],
};

/**
 * Assets whose names contain one of the aliases above. If any of these appears,
 * the text is ambiguous and scrape() must return null rather than pick a
 * product (PROMPT.md rule 2.5).
 */
export const AMBIGUOUS_ASSET_NAMES: readonly string[] = [
  "Bitcoin Cash",
  "Wrapped Bitcoin",
  "Ethereum Classic",
  "Ethereum Name Service",
];

/**
 * source: research/endpoints.md, RECOMMENDED section (captured 2026-09-07).
 * Unauthenticated, returns flat `bid`/`ask`, sends `access-control-allow-origin: *`.
 */
export const TICKER_URL_TEMPLATE: string =
  "https://api.exchange.coinbase.com/products/{productId}/ticker";

export function TICKER_URL(productId: ProductId): string {
  if (!TICKER_URL_TEMPLATE) {
    throw new Error("TICKER_URL unavailable: blocked on R1 (research/endpoints.md)");
  }
  return TICKER_URL_TEMPLATE.replace("{productId}", productId);
}

/**
 * source: research/deeplinks.md — verified in a browser, not assumed.
 * TODO R4 — leave "" until that file exists.
 */
export const ADVANCED_URL_TEMPLATE: string = "";

export function ADVANCED_URL(productId: ProductId): string {
  if (!ADVANCED_URL_TEMPLATE) {
    throw new Error("ADVANCED_URL unavailable: blocked on R4 (research/deeplinks.md)");
  }
  return ADVANCED_URL_TEMPLATE.replace("{productId}", productId);
}

/**
 * source: research/selectors.md, derived from the scrubbed real HTML in
 * research/dom/. Each entry gets a `// captured: <YYYY-MM-DD>` comment when it
 * is filled in.
 * TODO R3 — every value stays "" until those captures exist.
 */
export const SELECTORS = {
  previewContainer: "",
  productName: "",
  fiatAmount: "",
  quotedPrice: "",
  feeLine: "",
  confirmButton: "",
} as const;

/** source: research/fees.json, generated into src/generated/fee-tier.ts by build.mjs. */
export const FEE_TIER: FeeTier | null = FEE_TIER_FROM_RESEARCH;

/** True only when every research-dependent constant has landed. */
export function isConfigured(): boolean {
  return (
    TICKER_URL_TEMPLATE !== "" &&
    ADVANCED_URL_TEMPLATE !== "" &&
    FEE_TIER !== null &&
    Object.values(SELECTORS).every((s) => s !== "")
  );
}
