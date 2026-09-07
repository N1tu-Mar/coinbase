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
 * source: research/endpoints.md -> the line marked `RECOMMENDED:`
 * TODO R1 — leave "" until that file exists. getTicker() refuses to fetch while
 * this is empty, so no request is ever sent to a guessed URL.
 */
export const TICKER_URL_TEMPLATE: string = "";

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
