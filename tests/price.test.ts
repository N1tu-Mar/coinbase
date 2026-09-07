import { describe, expect, it } from "vitest";
import { parseTicker } from "../src/background/price.js";
import { fixtures } from "./real-data.js";

const recorded = fixtures();

describe("parseTicker over recorded live responses", () => {
  it.skipIf(recorded.length > 0)("has no fixtures yet — blocked on R1", () => {
    expect(recorded).toHaveLength(0);
  });

  for (const r of recorded) {
    it(`parses ${r.file}`, () => {
      const t = parseTicker(r.body, "BTC-USD", r.source, r.capturedAt);
      expect(typeof t.bid).toBe("number");
      expect(typeof t.ask).toBe("number");
      expect(t.mid).toBeCloseTo((t.bid + t.ask) / 2, 10);
      expect(t.source).toBe(r.source);
      expect(t.fetchedAt).toBe(r.capturedAt);
    });
  }
});
