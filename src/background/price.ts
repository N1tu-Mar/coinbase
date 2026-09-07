import { TICKER_URL, TICKER_URL_TEMPLATE } from "../config.js";
import type { ProductId, Ticker } from "../lib/types.js";

const CACHE_TTL_MS = 2000;

interface CacheEntry {
  ticker: Ticker;
  at: number;
}

const cache = new Map<ProductId, CacheEntry>();

/**
 * Fetch bid/ask for a product from the endpoint named RECOMMENDED in
 * research/endpoints.md, compute mid, and attach provenance.
 *
 * Endpoint and response shape: research/endpoints.md (captured 2026-09-07).
 */
export async function getTicker(productId: ProductId): Promise<Ticker> {
  const hit = cache.get(productId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.ticker;

  if (!TICKER_URL_TEMPLATE) {
    throw new Error("getTicker blocked on R1: research/endpoints.md has no RECOMMENDED endpoint");
  }

  const url = TICKER_URL(productId);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ticker fetch failed: ${res.status} ${url}`);

  const ticker = parseTicker(await res.json(), productId, url, new Date().toISOString());
  cache.set(productId, { ticker, at: Date.now() });
  return ticker;
}

/**
 * Response shape -> Ticker. Exported so tests can run it over the recorded
 * responses in fixtures/ and research/captures/ without touching the network.
 */
export function parseTicker(
  body: unknown,
  productId: ProductId,
  source: string,
  fetchedAt: string,
): Ticker {
  const fields = readBidAsk(body);
  if (!fields) throw new Error(`unrecognised ticker response from ${source}`);

  const { bid, ask } = fields;
  return { productId, bid, ask, mid: (bid + ask) / 2, source, fetchedAt };
}

function readBidAsk(body: unknown): { bid: number; ask: number } | null {
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;
  // source: research/endpoints.md field map — `bid` and `ask` are top-level and
  // arrive as strings. `price` is the last trade, not the mid: never read it.
  const bid = toNumber(record["bid"]);
  const ask = toNumber(record["ask"]);
  if (bid === null || ask === null) return null;
  return { bid, ask };
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Test seam only — never called by the extension. */
export function clearTickerCache(): void {
  cache.clear();
}
