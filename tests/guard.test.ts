import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { BANNED, runChecks } from "../scripts/check-realdata.mjs";

/**
 * The guard's job is to stop invented numbers reaching the extension. Its
 * biggest hole was research/: the fee rates are the one input a human types in
 * by hand, and nothing checked them.
 *
 * The banned identifiers are read from the guard's own export rather than
 * written out here, so this file does not trip the rule it is testing.
 */

const OFFICIAL =
  "https://help.coinbase.com/en/coinbase/trading-and-funding/advanced-trade/advanced-trade-fees";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function repo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "spread-check-guard-"));
  roots.push(root);
  for (const [path, body] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
  return root;
}

function feesJson(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    takerRate: 0.006,
    makerRate: 0.004,
    tierLabel: "Entry",
    source: OFFICIAL,
    capturedAt: "2026-09-07",
    ...over,
  });
}

const feesMd = `# R2\n\nRead from ${OFFICIAL} on 2026-09-07.\n\n| Tier | Taker | Maker |\n| Entry | 0.60% | 0.40% |\n`;

const valid = () => ({ "research/fees.json": feesJson(), "research/fees.md": feesMd });

const complaints = (root: string, about: string) =>
  runChecks(root).filter((f) => f.includes(about));

describe("the repository itself", () => {
  it("passes every check", () => {
    expect(runChecks(process.cwd())).toEqual([]);
  });
});

describe("research/fees.json provenance", () => {
  it("accepts a rate copied from an official page and cited in fees.md", () => {
    expect(runChecks(repo(valid()))).toEqual([]);
  });

  it("accepts the blocked state — no file at all", () => {
    expect(complaints(repo({ "research/fees.md": feesMd }), "fees.json")).toEqual([]);
  });

  it("rejects a percentage typed where a decimal fraction belongs", () => {
    // 0.60% is 0.006. Typing 0.6 overstates the Advanced Trade cost 100x and is
    // the single easiest mistake to make when transcribing the table.
    const root = repo({ ...valid(), "research/fees.json": feesJson({ takerRate: 0.6 }) });
    expect(complaints(root, "takerRate")).not.toEqual([]);
  });

  it("rejects a rate that is not a number", () => {
    const root = repo({ ...valid(), "research/fees.json": feesJson({ makerRate: "0.004" }) });
    expect(complaints(root, "makerRate")).not.toEqual([]);
  });

  it("rejects a negative rate", () => {
    const root = repo({ ...valid(), "research/fees.json": feesJson({ makerRate: -0.004 }) });
    expect(complaints(root, "makerRate")).not.toEqual([]);
  });

  it("rejects maker and taker swapped", () => {
    const root = repo({
      ...valid(),
      "research/fees.json": feesJson({ takerRate: 0.004, makerRate: 0.006 }),
    });
    expect(complaints(root, "takerRate")).not.toEqual([]);
  });

  it("rejects a source that is not an official Coinbase URL", () => {
    const root = repo({
      ...valid(),
      "research/fees.json": feesJson({ source: "https://some-crypto-blog.example/fees" }),
    });
    expect(complaints(root, "source")).not.toEqual([]);
  });

  it("rejects an unusable capture date", () => {
    const root = repo({ ...valid(), "research/fees.json": feesJson({ capturedAt: "recently" }) });
    expect(complaints(root, "capturedAt")).not.toEqual([]);
  });

  it("rejects a capture date in the future", () => {
    const root = repo({ ...valid(), "research/fees.json": feesJson({ capturedAt: "2099-01-01" }) });
    expect(complaints(root, "capturedAt")).not.toEqual([]);
  });

  it("rejects a missing tier label", () => {
    const root = repo({ ...valid(), "research/fees.json": feesJson({ tierLabel: "" }) });
    expect(complaints(root, "tierLabel")).not.toEqual([]);
  });

  it("rejects rates whose source page was never written up in fees.md", () => {
    // Rates with no transcribed table behind them were typed from memory.
    const root = repo({ "research/fees.json": feesJson(), "research/fees.md": "# R2\n\nTODO\n" });
    expect(complaints(root, "fees.md")).not.toEqual([]);
  });

  it("rejects invalid JSON", () => {
    const root = repo({ ...valid(), "research/fees.json": "{ takerRate: 0.006, }" });
    expect(complaints(root, "fees.json")).not.toEqual([]);
  });
});

describe("banned identifiers", () => {
  const line = (word: string) => `export const rate = ${word}Rate;\n`;

  it("still catches them in src/", () => {
    const root = repo({ [`src/x.ts`]: line(BANNED[0]!) });
    expect(complaints(root, "src/x.ts")).not.toEqual([]);
  });

  it("now catches them in research/ prose", () => {
    for (const word of BANNED) {
      const root = repo({ "research/notes.md": `The rate is a ${word} value.\n` });
      expect(complaints(root, "research/notes.md")).not.toEqual([]);
    }
  });

  it("does not flag real captured HTML, which legitimately contains them", () => {
    // A real Coinbase page has input attributes carrying these words. Rejecting
    // the capture would push people to edit it, which is the actual violation.
    const html = BANNED.map((w) => `<input ${w}="x">`).join("");
    const root = repo({ "research/dom/preview-BTC-USD-2026-09-07.html": html });
    expect(complaints(root, "research/dom")).toEqual([]);
  });

  it("does not flag raw recorded API responses", () => {
    const root = repo({
      "research/captures/x.json": JSON.stringify({
        source: "https://api.exchange.coinbase.com/products/BTC-USD/ticker",
        capturedAt: "2026-09-07T07:26:31Z",
        body: { note: BANNED.join(" ") },
      }),
    });
    expect(complaints(root, "research/captures")).toEqual([]);
  });
});

describe("recorded response provenance", () => {
  it("requires source and capturedAt on a research capture", () => {
    const root = repo({ "research/captures/x.json": JSON.stringify({ body: { bid: "1" } }) });
    expect(complaints(root, "research/captures/x.json")).not.toEqual([]);
  });

  it("requires source and capturedAt on a fixture", () => {
    const root = repo({ "fixtures/x.json": JSON.stringify({ body: { bid: "1" } }) });
    expect(complaints(root, "fixtures/x.json")).not.toEqual([]);
  });
});

describe("src/config.ts", () => {
  it("rejects a numeric literal", () => {
    const root = repo({ "src/config.ts": "export const TAKER = 0.006;\n" });
    expect(complaints(root, "config.ts")).not.toEqual([]);
  });

  it("allows digits inside comments and strings", () => {
    const root = repo({
      "src/config.ts": '// captured: 2026-09-07\nexport const U = "BTC-USD";\n',
    });
    expect(complaints(root, "config.ts")).toEqual([]);
  });
});
