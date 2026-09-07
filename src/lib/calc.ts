import type { CostBreakdown, FeeTier, Quote, Ticker } from "./types.js";

/**
 * Pure. No fetch, no DOM, no Date.now — every timestamp arrives on the inputs.
 * Formulas are fixed by PROMPT.md section 2.4.
 */
export function breakdown(
  q: Quote,
  t: Ticker,
  f: FeeTier,
  advancedUrl: string,
): CostBreakdown {
  const spreadPct = (q.quotedPrice - t.mid) / t.mid;
  // Spread is charged on the price the user is actually paying, so back it out
  // of the gross fiat amount rather than applying it to the mid-market amount.
  const spreadUsd = (q.fiatAmount * spreadPct) / (1 + spreadPct);
  const feeUsd = q.feeDisplayed;
  const allInUsd = spreadUsd + feeUsd;
  const advancedTradeEstUsd = q.fiatAmount * f.takerRate;

  return {
    spreadPct,
    spreadUsd,
    feeUsd,
    allInUsd,
    advancedTradeEstUsd,
    advancedTradeUrl: advancedUrl,
    feeTier: f,
    ticker: t,
    quote: q,
  };
}
