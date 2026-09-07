#!/usr/bin/env node
/**
 * Real-data guard (PROMPT.md rule 0.2 / section 4.6).
 *
 * Fails the build if invented data can reach the extension:
 *   1. banned identifiers anywhere in src/ tests/ fixtures/ scripts/
 *   2. a fixtures/*.json without both `source` and `capturedAt`
 *   3. a numeric literal in src/config.ts (rates come from research/fees.json)
 *
 * This file names the banned words in order to search for them, so it excludes
 * itself from rule 1. Nothing else may.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const ROOT = process.cwd();
const SELF = join("scripts", "check-realdata.mjs");
const SCAN_DIRS = ["src", "tests", "fixtures", "scripts"];
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "generated"]);
const TEXT_EXT = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".html", ".md"]);

// Words that only ever show up when data was invented rather than observed.
const BANNED = [
  "mock",
  "fake",
  "sample",
  "dummy",
  "placeholder",
  "faker",
  "Math.random",
];

const failures = [];

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

function scanBannedWords() {
  for (const dir of SCAN_DIRS) {
    for (const file of walk(join(ROOT, dir))) {
      const rel = relative(ROOT, file);
      if (rel === SELF) continue;
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

function scanFixtureProvenance() {
  for (const file of walk(join(ROOT, "fixtures"))) {
    if (extname(file) !== ".json") continue;
    const rel = relative(ROOT, file);
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(file, "utf8"));
    } catch (e) {
      failures.push(`${rel}: not valid JSON (${e.message})`);
      continue;
    }
    for (const key of ["source", "capturedAt"]) {
      if (!parsed || typeof parsed !== "object" || !parsed[key]) {
        failures.push(`${rel}: missing "${key}" — only scripts/capture-fixtures.ts may write fixtures/`);
      }
    }
  }
}

/** Strip comments and string literals, then any surviving digit is a hardcoded value. */
function scanConfigLiterals() {
  const rel = join("src", "config.ts");
  let source;
  try {
    source = readFileSync(join(ROOT, rel), "utf8");
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

scanBannedWords();
scanFixtureProvenance();
scanConfigLiterals();

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
