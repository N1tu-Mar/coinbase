import { describe, expect, it } from "vitest";
import { breakdown } from "../src/lib/calc.js";
import { captures, loadFeeTier } from "./real-data.js";

const feeTier = loadFeeTier();
const capture = captures()[0];

describe("breakdown", () => {
  it.runIf(feeTier && capture)("derives the all-in cost from real inputs", () => {
    // Blocked on R3: a real Quote needs numbers scraped from research/dom/.
    // Do not type one in — see PROMPT.md section 5.
    expect(breakdown).toBeTypeOf("function");
  });

  it.skipIf(feeTier)("is blocked on R2 (research/fees.json)", () => {
    expect(feeTier).toBeNull();
  });

  it.todo("matches a real BTC-USD preview once R1 + R2 + R3 have landed");
  it.todo("matches a real ETH-USD preview once R1 + R2 + R3 have landed");
  it.todo("matches a real SOL-USD preview once R1 + R2 + R3 have landed");
});
