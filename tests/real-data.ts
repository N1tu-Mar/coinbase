/**
 * Loaders for the only data tests are allowed to use: files produced by the
 * research agent or by scripts/capture-fixtures.ts. Every loader returns null
 * when its input has not landed yet, so the suite marks those tests skipped
 * instead of inventing numbers (PROMPT.md section 5).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FeeTier } from "../src/lib/types.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export function loadFeeTier(): FeeTier | null {
  const file = join(ROOT, "research", "fees.json");
  if (!existsSync(file)) return null;
  const parsed = JSON.parse(readFileSync(file, "utf8"));
  const ok =
    typeof parsed.takerRate === "number" &&
    typeof parsed.makerRate === "number" &&
    parsed.source &&
    parsed.capturedAt;
  return ok
    ? {
        takerRate: parsed.takerRate,
        makerRate: parsed.makerRate,
        source: parsed.source,
        capturedAt: parsed.capturedAt,
      }
    : null;
}

interface Recorded {
  file: string;
  source: string;
  capturedAt: string;
  body: unknown;
}

function loadRecorded(dir: string, ext: string): Recorded[] {
  const full = join(ROOT, dir);
  if (!existsSync(full)) return [];
  return readdirSync(full)
    .filter((f: string) => f.endsWith(ext))
    .map((f: string) => {
      const parsed = JSON.parse(readFileSync(join(full, f), "utf8"));
      return { file: f, source: parsed.source, capturedAt: parsed.capturedAt, body: parsed.body };
    })
    .filter((r: Recorded) => Boolean(r.source && r.capturedAt));
}

/** Raw live responses saved by the research agent (R1). */
export const captures = (): Recorded[] => loadRecorded("research/captures", ".json");

/** Responses recorded by scripts/capture-fixtures.ts. */
export const fixtures = (): Recorded[] => loadRecorded("fixtures", ".json");

/** Scrubbed real preview HTML saved by a human (R3). */
export function domCaptures(): { file: string; html: string }[] {
  const full = join(ROOT, "research", "dom");
  if (!existsSync(full)) return [];
  return readdirSync(full)
    .filter((f: string) => f.endsWith(".html"))
    .map((f: string) => ({ file: f, html: readFileSync(join(full, f), "utf8") }));
}
