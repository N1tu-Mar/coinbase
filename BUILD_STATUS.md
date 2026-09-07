# Build status

Branch: `main`. Build agent owns `src/`, `scripts/`, `fixtures/`, `tests/`.
Never edits `research/`.

## Phases

- [x] **P0 Scaffold** — `package.json`, `build.mjs`, `tsconfig.json`, vitest,
      `src/manifest.json`, `lib/types.ts`, module shells. `npm run build`
      produces a loadable unpacked extension in `dist/` that does nothing.
- [x] **P1 Calculator** — `lib/calc.ts` implemented per PROMPT.md 2.4 (pure, no
      I/O, no `Date.now`). Tests are `todo` pending real inputs — see blockers.
- [ ] **P2 Price fetcher** — `background/price.ts` and
      `scripts/capture-fixtures.ts` are written but inert. **Blocked on R1.**
- [ ] **P3 Detect + scrape** — `content/detect.ts`, `content/scrape.ts` written
      but inert (empty selectors). **Blocked on R3.**
- [ ] **P4 Badge + wiring** — `content/badge.ts` and `content/index.ts` written.
      Badge markup is complete; the link target is **blocked on R4**.
- [x] **P5 Real-data guard** — `npm run check:realdata`, wired into `npm test`,
      plus an optional pre-commit hook.
- [ ] **P6 README** — written; still needs the screenshot of a real preview
      screen (needs a logged-in session, same human step as R3).

## Blockers (waiting on the research agent)

| ID | Needed for | What is missing |
| -- | ---------- | --------------- |
| R1 | P2, `tests/calc.test.ts`, `tests/price.test.ts` | `research/endpoints.md` with a `RECOMMENDED:` endpoint and the exact field names holding bid/ask. `config.TICKER_URL_TEMPLATE` stays `""` until then, so nothing is fetched from a guessed URL. |
| R2 | P1 tests, badge fee-tier line | `research/fees.json`. `build.mjs` generates `src/generated/fee-tier.ts` as `null` while it is absent, so the badge never renders. |
| R3 | P3, P1 tests | `research/dom/*.html` and `research/selectors.md`. All six entries in `config.SELECTORS` are `""`. |
| R4 | P4 | `research/deeplinks.md`. `config.ADVANCED_URL_TEMPLATE` stays `""`. |
| R5 | manifest | `research/mv3-notes.md`. `host_permissions` is `[]` and `content_scripts.matches` is the broad `https://www.coinbase.com/*` — both marked `// TODO R5` in `src/manifest.json`. |

No number in `src/` was typed by hand. Every research-dependent constant is an
empty string or `null`, and `content/index.ts` calls `isConfigured()` before it
observes anything — so with research missing the extension loads and renders
nothing, which is the required failure behavior (PROMPT.md 2.5).

## Deviations from PROMPT.md section 2.2 (rule 0.4)

1. **`src/generated/fee-tier.ts`** (git-ignored, written by `build.mjs`).
   Section 2.4 says `FEE_TIER` is imported from `research/fees.json` at build
   time. A direct esbuild JSON import fails the whole build while that file is
   absent, which would block every phase on R2. The generator keeps the same
   guarantee — the rates can only come from `research/fees.json`, and it
   validates that `takerRate`, `makerRate`, `source` and `capturedAt` are all
   present and that the rates are numbers — while letting the extension build
   and render nothing until R2 lands.
2. **`src/background/index.ts`** — the service-worker message listener. Section
   2.2 lists only `background/price.ts`; the manifest needs an entry point that
   is not the fetcher itself, and keeping `price.ts` free of `chrome.*` lets
   `parseTicker` be tested in Node.
3. **`tests/real-data.ts`** — shared loaders for `research/` and `fixtures/`
   input, so no test file reimplements provenance checking.
4. **`scripts/check-realdata.mjs`** lives in a scanned directory and names the
   banned words in order to search for them, so it excludes itself by exact
   path. Nothing else is excluded.

## Manual verification log

Not yet run — needs R3/R4 plus a logged-in session. Record here what the badge
showed on real $10 BTC/ETH/SOL previews (do not confirm the orders).
