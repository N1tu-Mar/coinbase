// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { matchProductId, parseMoney } from "../src/content/scrape.js";

/**
 * These are text-format cases for the parser, not market data: every assertion
 * is about how a string is read, and no number here is presented as a price
 * Coinbase quoted. The end-to-end numbers come from the real captures in
 * research/dom/ once R3 lands (tests/scrape.test.ts).
 *
 * PROMPT.md rule 2.5: on anything ambiguous, return null so nothing renders.
 */
describe("parseMoney", () => {
  it("reads a currency amount that follows a label", () => {
    expect(parseMoney("Coinbase fee $2.99")).toBe(2.99);
  });

  it("ignores a percentage that precedes the amount", () => {
    // The old parser took the first number it saw and returned 1.5 here.
    expect(parseMoney("1.5% fee $2.99")).toBe(2.99);
    expect(parseMoney("Spread 2.00% $34.40")).toBe(34.4);
  });

  it("strips thousands separators", () => {
    expect(parseMoney("$67,410.00")).toBe(67410);
    expect(parseMoney("$1,234,567.89")).toBe(1234567.89);
  });

  it("treats zero as a value, not a miss", () => {
    expect(parseMoney("Fee $0.00")).toBe(0);
    expect(parseMoney("$0")).toBe(0);
  });

  it("applies a leading minus sign", () => {
    expect(parseMoney("-$5.00")).toBe(-5);
    expect(parseMoney("$-5.00")).toBe(-5);
  });

  it("reads accounting parentheses as negative", () => {
    expect(parseMoney("($5.00)")).toBe(-5);
  });

  it("tolerates a currency prefix and a trailing code", () => {
    expect(parseMoney("US$2.99")).toBe(2.99);
    expect(parseMoney("2.99 USD")).toBe(2.99);
  });

  it("collapses whitespace inside the amount", () => {
    expect(parseMoney("$ 2.99")).toBe(2.99);
    expect(parseMoney("\n  Fee\n  $2.99\n")).toBe(2.99);
  });

  it("returns null when there is no number", () => {
    expect(parseMoney("Fee")).toBeNull();
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("—")).toBeNull();
  });

  it("returns null when only a percentage is present", () => {
    expect(parseMoney("2.00%")).toBeNull();
  });

  it("returns null when two different amounts are in scope", () => {
    // A selector that catches more than one figure is a selector bug. Guessing
    // which one is the fee would put a wrong number in front of the user.
    expect(parseMoney("Total $1,502.99  Fee $2.99")).toBeNull();
  });

  it("accepts the same amount repeated by nested elements", () => {
    // textContent concatenates, so a fee wrapped in its own span shows twice.
    expect(parseMoney("$2.99$2.99")).toBe(2.99);
    expect(parseMoney("Fee $2.99 $2.99")).toBe(2.99);
  });

  it("returns null when two bare numbers are in scope", () => {
    expect(parseMoney("2.99 3.99")).toBeNull();
  });
});

describe("matchProductId", () => {
  it("matches the ticker symbol", () => {
    expect(matchProductId("BTC")).toBe("BTC-USD");
    expect(matchProductId("ETH-USD")).toBe("ETH-USD");
    expect(matchProductId("Buy SOL")).toBe("SOL-USD");
  });

  it("matches the display name Coinbase actually renders", () => {
    // The old matcher looked for "BTC" and would have missed every one of these.
    expect(matchProductId("Bitcoin")).toBe("BTC-USD");
    expect(matchProductId("Ethereum")).toBe("ETH-USD");
    expect(matchProductId("Solana")).toBe("SOL-USD");
    expect(matchProductId("Buy Bitcoin")).toBe("BTC-USD");
  });

  it("is case insensitive", () => {
    expect(matchProductId("bitcoin")).toBe("BTC-USD");
    expect(matchProductId("btc")).toBe("BTC-USD");
  });

  it("does not match a symbol embedded in another word", () => {
    expect(matchProductId("SOLD")).toBeNull();
    expect(matchProductId("ETHOS")).toBeNull();
  });

  it("refuses a near-miss asset rather than guessing", () => {
    expect(matchProductId("Bitcoin Cash")).toBeNull();
    expect(matchProductId("Wrapped Bitcoin")).toBeNull();
    expect(matchProductId("Ethereum Classic")).toBeNull();
  });

  it("refuses text naming more than one of our products", () => {
    expect(matchProductId("Bitcoin / Ethereum")).toBeNull();
  });

  it("returns null for an asset outside the MVP scope", () => {
    expect(matchProductId("Dogecoin")).toBeNull();
    expect(matchProductId("")).toBeNull();
  });
});
