export type ProductId = "BTC-USD" | "ETH-USD" | "SOL-USD";

export interface Quote {
  productId: ProductId;
  fiatAmount: number; // what the user is spending, from DOM
  quotedPrice: number; // per-unit price shown by Coinbase, from DOM
  feeDisplayed: number; // fee line item shown by Coinbase, from DOM (0 is valid)
  scrapedAt: string; // ISO timestamp
}

export interface Ticker {
  productId: string;
  bid: number;
  ask: number;
  mid: number; // (bid + ask) / 2
  source: string; // full URL that was fetched
  fetchedAt: string; // ISO timestamp
}

export interface FeeTier {
  takerRate: number; // value comes from research/fees.json
  makerRate: number;
  source: string; // official Coinbase URL
  capturedAt: string; // ISO date
}

export interface CostBreakdown {
  spreadPct: number;
  spreadUsd: number;
  feeUsd: number;
  allInUsd: number;
  advancedTradeEstUsd: number;
  advancedTradeUrl: string;
  feeTier: FeeTier;
  ticker: Ticker;
  quote: Quote;
}

/** Message contract between content script and service worker. */
export interface TickerRequest {
  type: "spreadcheck:ticker";
  productId: ProductId;
}

export type TickerResponse =
  | { ok: true; ticker: Ticker }
  | { ok: false; error: string };
