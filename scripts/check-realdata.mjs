#!/usr/bin/env node
/**
 * Real-data guard (PROMPT.md rule 0.2 / section 4.6).
 *
 * Fails the build if invented data can reach the extension:
 *   1. banned identifiers in src/ tests/ fixtures/ scripts/ and research/
 *   2. a recorded response without both `source` and `capturedAt`
 *   3. a numeric literal in src/config.ts (rates come from research/fees.json)
 *   4. a research/fees.json whose rates are not traceable to an official page
 *
 * Rule 4 exists because the fee tier is the one input a human types in by hand.
 * Everything else in the project is fetched or recorded by a script; the rates
 * are transcribed off a web page, which is exactly where a remembered number
 * would slip in.
 *
 * This file names the banned words in order to search for them, so it excludes
 * itself from rule 1. Nothing else may.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SELF = join("scripts", "check-realdata.mjs");
const SCAN_DIRS = ["src", "tests", "fixtures", "scripts", "research"];
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "generated"]);
const TEXT_EXT = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".html", ".md"]);

/**
 * Directories holding data recorded verbatim from Coinbase. Their contents are
 * evidence, not authored code: a real preview page carries input attributes
 * using these words, and editing a capture to satisfy a grep would be the very
 * violation this guard is for.
 */
const VERBATIM_DIRS = [join("research", "dom"), join("research", "captures")];

/** Directories whose *.json files must carry provenance. */
const RECORDED_DIRS = ["fixtures", join("research", "captures")];

/** Words that only ever show up when data was invented rather than observed. */
export const BANNED = ["mock", "fake", "sample", "dummy", "placeholder", "faker", "Math.random"];

/** A rate above this is a percentage that was never converted (0.6 vs 0.006). */
const MAX_PLAUSIBLE_RATE = 0.1;
const OFFICIAL_SOURCE = /^https:\/\/([a-z0-9-]+\.)*coinbase\.com\//i;

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return; // directory not created yet
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

const isVerbatim = (rel) => VERBATIM_DIRS.some((d) => rel === d || rel.startsWith(d + sep));

function scanBannedWords(root, failures) {
  for (const dir of SCAN_DIRS) {
    for (const file of walk(join(root, dir))) {
      const rel = relative(root, file);
      if (rel === SELF || isVerbatim(rel)) continue;
      if (!TEXT_EXT.has(extname(file))) continue;

      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        for (const word of BANNED) {
          if (line.toLowerCase().includes(word.toLowerCase())) {
            failures.push(`${rel}:${i + 1}: banned identifier "${word}" — ${line.trim()}`);
          }
        }
      });
    }
  }
}

function scanRecordedProvenance(root, failures) {
  for (const dir of RECORDED_DIRS) {
    for (const file of walk(join(root, dir))) {
      if (extname(file) !== ".json") continue;
      const rel = relative(root, file);
      let parsed;
      try {
        parsed = JSON.parse(readFileSync(file, "utf8"));
      } catch (e) {
        failures.push(`${rel}: not valid JSON (${e.message})`);
        continue;
      }
      for (const key of ["source", "capturedAt"]) {
        if (!parsed || typeof parsed !== "object" || !parsed[key]) {
          failures.push(
            `${rel}: missing "${key}" — a recorded response must say where and when it came from`,
          );
        }
      }
    }
  }
}

/** Strip comments and string literals, then any surviving digit is a hardcoded value. */
function scanConfigLiterals(root, failures) {
  const rel = join("src", "config.ts");
  let source;
  try {
    source = readFileSync(join(root, rel), "utf8");
  } catch {
    return;
  }

  let inBlockComment = false;

  source.split("\n").forEach((raw, i) => {
    let line = raw;

    // Block comments span lines, so track the state across the whole file.
    if (inBlockComment) {
      const end = line.indexOf("*/");
      if (end === -1) return;
      line = line.slice(end + 2);
      inBlockComment = false;
    }
    line = line.replace(/\/\*[\s\S]*?\*\//g, "");
    const open = line.indexOf("/*");
    if (open !== -1) {
      inBlockComment = true;
      line = line.slice(0, open);
    }

    const stripped = line
      .replace(/\/\/.*$/, "")
      .replace(/"[^"]*"/g, '""')
      .replace(/'[^']*'/g, "''")
      .replace(/`[^`]*`/g, "``");

    if (/\d/.test(stripped)) {
      failures.push(
        `${rel}:${i + 1}: numeric literal — rates and prices must come from research/fees.json or a live fetch`,
      );
    }
  });
}

/**
 * The fee tier is the only number a human transcribes. Absent is fine — that is
 * the documented blocked state. Present means it has to look like something
 * read off an official page today, not remembered.
 */
function scanFeeTier(root, failures) {
  const rel = join("research", "fees.json");
  const file = join(root, rel);
  if (!existsSync(file)) return;

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    failures.push(`${rel}: not valid JSON (${e.message})`);
    return;
  }
  if (typeof parsed !== "object" || parsed === null) {
    failures.push(`${rel}: must be a JSON object`);
    return;
  }

  for (const key of ["takerRate", "makerRate"]) {
    const rate = parsed[key];
    if (typeof rate !== "number" || !Number.isFinite(rate)) {
      failures.push(`${rel}: "${key}" must be a number, got ${JSON.stringify(rate)}`);
      continue;
    }
    if (rate < 0) {
      failures.push(`${rel}: "${key}" is negative`);
    }
    if (rate > MAX_PLAUSIBLE_RATE) {
      failures.push(
        `${rel}: "${key}" is ${rate} — FeeTier rates are decimal fractions, so 0.60% is 0.006. ` +
          `Divide the published percentage by 100.`,
      );
    }
  }
  if (
    typeof parsed.takerRate === "number" &&
    typeof parsed.makerRate === "number" &&
    parsed.takerRate < parsed.makerRate
  ) {
    failures.push(
      `${rel}: "takerRate" is below "makerRate" — Coinbase never prices taking below making, ` +
        `so these two are almost certainly swapped`,
    );
  }

  if (typeof parsed.tierLabel !== "string" || parsed.tierLabel.trim() === "") {
    failures.push(`${rel}: "tierLabel" must name the tier exactly as the page labels it`);
  }

  const source = parsed.source;
  if (typeof source !== "string" || !OFFICIAL_SOURCE.test(source)) {
    failures.push(
      `${rel}: "source" must be an https URL on coinbase.com — rule 0.2 takes fee rates from an ` +
        `official Coinbase page only, not from reviews or memory. Got ${JSON.stringify(source)}`,
    );
  }

  const capturedAt = parsed.capturedAt;
  const when = typeof capturedAt === "string" ? Date.parse(capturedAt) : Number.NaN;
  if (Number.isNaN(when)) {
    failures.push(`${rel}: "capturedAt" must be a date you read the page, got ${JSON.stringify(capturedAt)}`);
  } else if (when > Date.now() + 24 * 60 * 60 * 1000) {
    failures.push(`${rel}: "capturedAt" is in the future (${capturedAt})`);
  }

  // A rate with no transcribed table behind it was typed from memory.
  const mdRel = join("research", "fees.md");
  const md = existsSync(join(root, mdRel)) ? readFileSync(join(root, mdRel), "utf8") : "";
  if (typeof source === "string" && source && !md.includes(source)) {
    failures.push(
      `${mdRel}: does not cite ${source} — write the fee table up in fees.md from the page you ` +
        `read before putting rates in fees.json`,
    );
  }
}

export function runChecks(root = process.cwd()) {
  const failures = [];
  const base = resolve(root);
  scanBannedWords(base, failures);
  scanRecordedProvenance(base, failures);
  scanConfigLiterals(base, failures);
  scanFeeTier(base, failures);
  return failures;
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const failures = runChecks(process.cwd());
  if (failures.length) {
    console.error(`check:realdata FAILED (${failures.length})\n`);
    for (const f of failures) console.error(`  ${f}`);
    console.error(
      `\nRule 0.2: no synthetic, generated, sample or hand-typed data anywhere.` +
        `\nIf you need data you do not have, record the blocker in BUILD_STATUS.md instead.`,
    );
    process.exit(1);
  }
  console.log(`check:realdata OK — scanned ${SCAN_DIRS.join(", ")}`);
}
