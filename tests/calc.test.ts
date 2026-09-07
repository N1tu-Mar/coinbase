import { describe, expect, it } from "vitest";
import { breakdown } from "../src/lib/calc.js";
import { parseTicker } from "../src/background/price.js";
import { PRODUCTS } from "../src/config.js";
import type { FeeTier, ProductId, Quote, Ticker } from "../src/lib/types.js";
import { captures, fixtures, loadFeeTier } from "./real-data.js";

/**
 * Every market number below is read out of a recorded live response — the
 * fixtures written by scripts/capture-fixtures.ts and the research agent's
 * captures. Nothing is typed in.
 *
 * What is still missing is a real Quote: the fiat amount, the quoted price and
 * the fee as Coinbase renders them come from research/dom/, which is blocked on
 * R3. So this suite checks the algebra of breakdown() against real prices, and
 * the end-to-end numbers stay `todo` until those captures land (PROMPT.md §5).
 */

const RECOMMENDED = "https://api.exchange.coinbase.com/products/";

interface RealCase {
  productId: ProductId;
  ticker: Ticker;
  /** A real ask, recorded live, at or above this ticker's mid. */
  quotedPrice: number;
  /** A real recorded dollar figure, used as the amount the user is spending. */
  fiatAmount: number;
}

function realCases(): RealCase[] {
  const recorded = [...fixtures(), ...captures()];
  const cases: RealCase[] = [];

  for (const productId of PRODUCTS) {
    const forProduct = recorded.filter((r) =>
      r.source.startsWith(`${RECOMMENDED}${productId}/ticker`),
    );
    if (forProduct.length === 0) continue;

    const tickers = forProduct.map((r) =>
      parseTicker(r.body, productId, r.source, r.capturedAt),
    );
    const ticker = tickers[0]!;
    // An ask is always above its own mid, so the highest recorded ask gives a
    // real, strictly positive spread over this ticker's mid.
    const quotedPrice = Math.max(...tickers.map((t) => t.ask));

    cases.push({ productId, ticker, quotedPrice, fiatAmount: ticker.ask });
  }

  return cases;
}

const cases = realCases();

/**
 * Not a fee claim. breakdown() requires a FeeTier and the real one is blocked
 * on R2, so the fee-independent assertions run against the neutral element:
 * a zero rate contributes nothing, which is exactly what lets these tests
 * isolate the spread math. The real rate is asserted separately, below.
 */
const NEUTRAL_TIER: FeeTier = {
  takerRate: 0,
  makerRate: 0,
  source: "research/fees.md — BLOCKED ON R2, no rate has been published here",
  capturedAt: "",
};

const ADVANCED_URL = "https://www.coinbase.com/advanced-trade/spot";

function quoteFrom(c: RealCase, feeDisplayed: number, fiatAmount = c.fiatAmount): Quote {
  return {
    productId: c.productId,
    fiatAmount,
    quotedPrice: c.quotedPrice,
    feeDisplayed,
    scrapedAt: c.ticker.fetchedAt,
  };
}

describe("breakdown over real recorded prices", () => {
  it.skipIf(cases.length > 0)("has no recorded tickers yet — blocked on R1", () => {
    expect(cases).toHaveLength(0);
  });

  for (const c of cases) {
    describe(c.productId, () => {
      it("prices the spread the same way an independent derivation does", () => {
        // Derived a different way on purpose: the fiat buys
        // fiatAmount / quotedPrice units, those units are worth mid each, and
        // whatever the user does not get back is the spread. If breakdown()
        // ever restates its own formula wrongly, these two disagree.
        const cb = breakdown(quoteFrom(c, 0), c.ticker, NEUTRAL_TIER, ADVANCED_URL);
        const unitsBought = c.fiatAmount / c.quotedPrice;
        const worthAtMid = unitsBought * c.ticker.mid;

        expect(cb.spreadUsd).toBeCloseTo(c.fiatAmount - worthAtMid, 10);
      });

      it("reports the spread as a fraction of mid", () => {
        const cb = breakdown(quoteFrom(c, 0), c.ticker, NEUTRAL_TIER, ADVANCED_URL);
        expect(cb.spreadPct).toBeCloseTo(
          (c.quotedPrice - c.ticker.mid) / c.ticker.mid,
          12,
        );
      });

      it("charges a strictly positive spread when the quote is above mid", () => {
        const cb = breakdown(quoteFrom(c, 0), c.ticker, NEUTRAL_TIER, ADVANCED_URL);
        expect(c.quotedPrice).toBeGreaterThan(c.ticker.mid);
        expect(cb.spreadPct).toBeGreaterThan(0);
        expect(cb.spreadUsd).toBeGreaterThan(0);
        expect(cb.spreadUsd).toBeLessThan(c.fiatAmount);
      });

      it("charges nothing when the quote is exactly mid", () => {
        const atMid: Quote = { ...quoteFrom(c, 0), quotedPrice: c.ticker.mid };
        const cb = breakdown(atMid, c.ticker, NEUTRAL_TIER, ADVANCED_URL);

        expect(cb.spreadPct).toBe(0);
        expect(cb.spreadUsd).toBe(0);
        expect(cb.allInUsd).toBe(0);
      });

      it("scales the spread linearly with the amount spent", () => {
        const single = breakdown(quoteFrom(c, 0), c.ticker, NEUTRAL_TIER, ADVANCED_URL);
        const double = breakdown(
          quoteFrom(c, 0, c.fiatAmount * 2),
          c.ticker,
          NEUTRAL_TIER,
          ADVANCED_URL,
        );

        expect(double.spreadUsd).toBeCloseTo(single.spreadUsd * 2, 10);
        expect(double.spreadPct).toBeCloseTo(single.spreadPct, 12);
      });

      it("adds the displayed fee on top of the spread", () => {
        // The dollar figure is the recorded bid-ask gap. It stands in for a fee
        // only to prove additivity — it is not a claim about Coinbase's fee.
        const fee = c.ticker.ask - c.ticker.bid;
        const cb = breakdown(quoteFrom(c, fee), c.ticker, NEUTRAL_TIER, ADVANCED_URL);

        expect(cb.feeUsd).toBe(fee);
        expect(cb.allInUsd).toBeCloseTo(cb.spreadUsd + fee, 10);
      });

      it("treats a zero fee as a value, not a miss", () => {
        const cb = breakdown(quoteFrom(c, 0), c.ticker, NEUTRAL_TIER, ADVANCED_URL);
        expect(cb.feeUsd).toBe(0);
        expect(cb.allInUsd).toBe(cb.spreadUsd);
      });

      it("passes its inputs through untouched for the badge to cite", () => {
        const quote = quoteFrom(c, 0);
        const before = JSON.stringify({ quote, ticker: c.ticker, tier: NEUTRAL_TIER });
        const cb = breakdown(quote, c.ticker, NEUTRAL_TIER, ADVANCED_URL);

        expect(cb.quote).toEqual(quote);
        expect(cb.ticker).toEqual(c.ticker);
        expect(cb.feeTier).toEqual(NEUTRAL_TIER);
        expect(cb.advancedTradeUrl).toBe(ADVANCED_URL);
        expect(JSON.stringify({ quote, ticker: c.ticker, tier: NEUTRAL_TIER })).toBe(before);
      });

      it("is pure — same inputs, same output, no clock", () => {
        const quote = quoteFrom(c, 0);
        const first = breakdown(quote, c.ticker, NEUTRAL_TIER, ADVANCED_URL);
        const second = breakdown(quote, c.ticker, NEUTRAL_TIER, ADVANCED_URL);
        expect(second).toEqual(first);
      });

      it("estimates the Advanced Trade cost from the tier rate alone", () => {
        const cb = breakdown(quoteFrom(c, 0), c.ticker, NEUTRAL_TIER, ADVANCED_URL);
        expect(cb.advancedTradeEstUsd).toBe(0); // takerRate 0 -> costs nothing
      });
    });
  }
});

const feeTier = loadFeeTier();
const firstCase = cases[0];

describe("breakdown with the real Advanced Trade fee tier", () => {
  it.skipIf(feeTier !== null)("is blocked on R2 (research/fees.json)", () => {
    expect(feeTier).toBeNull();
  });

  it.runIf(feeTier !== null && firstCase !== undefined)(
    "applies the published taker rate to the amount spent",
    () => {
      const c = firstCase!;
      const cb = breakdown(quoteFrom(c, 0), c.ticker, feeTier!, ADVANCED_URL);
      expect(cb.advancedTradeEstUsd).toBeCloseTo(c.fiatAmount * feeTier!.takerRate, 10);
      expect(cb.advancedTradeEstUsd).toBeLessThan(cb.allInUsd + cb.advancedTradeEstUsd);
      expect(cb.feeTier.source).toBe(feeTier!.source);
    },
  );
});

describe("breakdown against a real Simple preview", () => {
  // These need a real Quote — fiat amount, quoted price and fee exactly as
  // Coinbase rendered them. Blocked on R3; see research/dom/HOW_TO_CAPTURE.md.
  it.todo("matches a real BTC-USD preview once R2 + R3 have landed");
  it.todo("matches a real ETH-USD preview once R2 + R3 have landed");
  it.todo("matches a real SOL-USD preview once R2 + R3 have landed");
});
