# PROMPT.md — spread-check (working name)

A Chrome extension that shows the real all-in cost of a Coinbase **Simple** trade
(spread over mid-market + displayed fee) before the user hits Confirm, and links
them to the same pair on Advanced Trade.

This file is the contract. Two Claude Code agents work from it in parallel:

| Agent              | Reads sections | Writes to                                 | Branch     |
| ------------------ | -------------- | ----------------------------------------- | ---------- |
| **Research agent** | 0, 1, 2, 3     | `research/` only                          | `research` |
| **Build agent**    | 0, 1, 2, 4, 5  | `src/`, `scripts/`, `fixtures/`, `tests/` | `main`     |

If you are the research agent: stop reading after section 3. Do not write code.
If you are the build agent: skip section 3 except to read the deliverable file
names it produces.

---

## 0. Rules for every agent (non-negotiable)

### 0.1 Commit every 5 minutes

- Set a timer. Every ~5 minutes of work, or at every logical unit (whichever comes
  first), run `git add -A && git commit`. Never leave uncommitted work older than
  5 minutes.
- Work-in-progress is fine to commit. Prefix with `wip:`. Broken code on a commit
  is acceptable; lost work is not.
- Message format: `<type>(<scope>): <what changed>`. Types: `feat`, `fix`, `test`,
  `research`, `chore`, `wip`. Example: `research(endpoints): capture live BTC-USD ticker`.
- Before each commit on your branch: `git pull --rebase origin <your-branch>`.
- Push after every commit: `git push origin <your-branch>`.
- If you finish a phase, commit with `feat:`/`research:` and update the relevant
  STATUS file in the same commit.

### 0.2 Real data only

- No hardcoded prices, fees, spreads, percentages, or timestamps in `src/`.
- No synthetic, generated, sample, mock, dummy, or placeholder data anywhere:
  not in `src/`, not in `tests/`, not in `fixtures/`, not in `research/`.
- The only numbers allowed in the codebase are (a) fetched live at runtime,
  (b) recorded from a live call by `scripts/capture-fixtures.ts` with source URL
  and timestamp attached, or (c) copied from an official Coinbase page by the
  research agent with source URL and capture date attached.
- Banned identifiers and libraries: `mock`, `fake`, `sample`, `dummy`,
  `placeholder`, `faker`, `Math.random` for data, any fixture file lacking a
  `source` and `capturedAt` field. `npm run check:realdata` (section 4.6) greps
  for these and fails the build.
- If you need data you do not have, stop and record what is missing in
  `research/STATUS.md` (research agent) or `BUILD_STATUS.md` (build agent). Do
  not invent it to keep moving.

### 0.3 Stay read-only against Coinbase

- Read the DOM. Never click, submit, or fill anything on the user's behalf.
- Call only unauthenticated public endpoints. Never touch the logged-in session,
  cookies, or authenticated API.
- Store nothing about the user. No balances, no emails, no order history, no
  analytics.

### 0.4 Do not drift from section 2

- File layout and module boundaries in section 2 are fixed. If a change is
  truly required, write the reason in the STATUS file, commit it, then make the
  change in a separate commit.

---

## 1. What we are building

### Problem

Coinbase's Simple buy/sell flow bakes a spread into the quoted price and shows
the fee only on the preview screen. Users don't see the all-in cost, blame
"hidden fees", and churn to competitors — when Advanced Trade on the same
account would have cost them a fraction. (Complaint pattern is consistent across
r/CoinBase, Trustpilot, and BBB.)

### What the user sees

On the Simple trade preview/confirm screen, a small badge next to Confirm:

```
Quoted: $67,410.00   Mid-market now: $66,090.00
Spread: 2.00%  +  Fee: $2.99   =   $34.40 over market on this $1,500 buy
Same order on Advanced Trade ≈ $9.00      [Open BTC-USD in Advanced Trade →]
Fee tier source: <official url>, captured <date>
```

Every number on that badge is either scraped live from the page, fetched live
from a public Coinbase endpoint, or traceable to an official Coinbase page.

### MVP scope

- Chrome, desktop web only (extensions do not run inside the mobile app — state
  this limitation in the README).
- Buy side only.
- Pairs: BTC-USD, ETH-USD, SOL-USD.
- No backend. No storage.

### Out of scope for MVP

Sell side, other fiat currencies, Firefox/Safari, mobile, savings counter,
historical charts.

---

## 2. Architecture (fixed)

### 2.1 Stack

- Manifest V3 Chrome extension
- TypeScript, built with `esbuild` (single `build.mjs`, no framework)
- Tests: `vitest`
- No runtime dependencies beyond what Chrome provides. Dev deps only.

### 2.2 File layout

```
PROMPT.md
README.md
BUILD_STATUS.md                 # build agent's checklist + blockers
package.json
build.mjs
research/                       # research agent owns this tree (section 3)
  STATUS.md
  endpoints.md
  captures/                     # raw live API responses (real)
  fees.md
  fees.json
  dom/                          # scrubbed real HTML snapshots
  selectors.md
  deeplinks.md
  mv3-notes.md
src/
  manifest.json
  config.ts                     # selectors, product ids, fee tier ref. ONLY place these live.
  lib/
    types.ts                    # Quote, Ticker, CostBreakdown
    calc.ts                     # pure math. No I/O. No DOM.
  background/
    price.ts                    # fetch mid from public endpoint, 2s in-memory cache
  content/
    detect.ts                   # MutationObserver: is the preview screen showing?
    scrape.ts                   # DOM -> Quote (asset, fiatAmount, quotedPrice, feeDisplayed)
    badge.ts                    # renders CostBreakdown into the page
    index.ts                    # wires detect -> scrape -> message background -> badge
scripts/
  capture-fixtures.ts           # hits live public endpoints, writes fixtures/ with metadata
fixtures/                       # recorded REAL responses only
tests/
  calc.test.ts
  scrape.test.ts
  price.test.ts
```

### 2.3 Data flow

```
coinbase.com preview screen
        │  (MutationObserver)
        ▼
content/detect.ts ── preview visible ──► content/scrape.ts ──► Quote
                                                                │
                                              chrome.runtime.sendMessage
                                                                ▼
                                                     background/price.ts
                                                     GET public ticker (2s cache)
                                                                │
                                                                ▼ Ticker {bid, ask, mid}
                                                     lib/calc.ts(Quote, Ticker, feeTier)
                                                                │
                                                                ▼ CostBreakdown
                                                     content/badge.ts renders it
```

### 2.4 Module contracts

`lib/types.ts`

```ts
export interface Quote {
  productId: "BTC-USD" | "ETH-USD" | "SOL-USD";
  fiatAmount: number; // what the user is spending, from DOM
  quotedPrice: number; // per-unit price shown by Coinbase, from DOM
  feeDisplayed: number; // fee line item shown by Coinbase, from DOM (0 is valid)
  scrapedAt: string; // ISO timestamp
}

export interface Ticker {
  productId: string;
  bid: number;
  ask: number;
  mid: number; // (bid + ask) / 2
  source: string; // full URL that was fetched
  fetchedAt: string; // ISO timestamp
}

export interface FeeTier {
  takerRate: number; // e.g. 0.006 — value comes from research/fees.json
  makerRate: number;
  source: string; // official Coinbase URL
  capturedAt: string; // ISO date
}

export interface CostBreakdown {
  spreadPct: number;
  spreadUsd: number;
  feeUsd: number;
  allInUsd: number;
  advancedTradeEstUsd: number;
  advancedTradeUrl: string;
  feeTier: FeeTier;
  ticker: Ticker;
  quote: Quote;
}
```

`lib/calc.ts`

```ts
export function breakdown(
  q: Quote,
  t: Ticker,
  f: FeeTier,
  advancedUrl: string,
): CostBreakdown;
```

Pure. No fetch, no DOM, no Date.now (timestamps come in on the inputs).

- `spreadPct = (q.quotedPrice - t.mid) / t.mid`
- `spreadUsd = q.fiatAmount * spreadPct / (1 + spreadPct)` (spread is on the price the user is paying)
- `feeUsd = q.feeDisplayed`
- `allInUsd = spreadUsd + feeUsd`
- `advancedTradeEstUsd = q.fiatAmount * f.takerRate`

`config.ts`

- Exports `PRODUCTS`, `SELECTORS`, `TICKER_URL(productId)`, `ADVANCED_URL(productId)`, `FEE_TIER`.
- `FEE_TIER` is imported from `research/fees.json` at build time (esbuild JSON import), never typed by hand.
- `SELECTORS` values are copied from `research/selectors.md` with a comment giving the capture date.
- Every exported constant carries a `// source:` comment.

### 2.5 Failure behavior

- If any selector misses or a scraped number fails to parse: render nothing.
  Never render a badge with a guessed or partial number.
- If the ticker fetch fails: render nothing, log once to console.
- Badge must never block, overlay, or shift the Confirm button.

---

## 3. RESEARCH AGENT — read this section only, then stop

You do not write code. You produce verified inputs the build agent depends on.
Every deliverable below is a file under `research/`. Commit each one the moment
it's done (rule 0.1). Keep `research/STATUS.md` current — the build agent polls
it.

### 3.0 `research/STATUS.md` (create first, update constantly)

```
# Research status
- [ ] R1 endpoints.md + captures/        BLOCKED/IN PROGRESS/DONE  <notes>
- [ ] R2 fees.md + fees.json
- [ ] R3 dom/ + selectors.md             (needs human capture — see 3.3)
- [ ] R4 deeplinks.md
- [ ] R5 mv3-notes.md
```

### 3.1 R1 — Public ticker endpoint (`research/endpoints.md`, `research/captures/`)

Goal: one unauthenticated HTTPS endpoint that returns current bid and ask for
BTC-USD, ETH-USD, SOL-USD.

Candidates to verify (do not assume either works — call them):

- Coinbase Exchange public API: `https://api.exchange.coinbase.com/products/{productId}/ticker`
- Coinbase Advanced Trade public market data: `https://api.coinbase.com/api/v3/brokerage/market/products/{productId}` (and any `/ticker` or `/best_bid_ask` variant you find in the official docs)

For each candidate:

1. `curl` it live. Save the exact raw response to
   `research/captures/{endpoint-slug}-{productId}-{ISO timestamp}.json`.
   Wrap it as `{ "source": "<full url>", "capturedAt": "<ISO>", "status": <http code>, "body": <raw> }`.
2. Record in `endpoints.md`: URL pattern, auth required (yes/no), which fields
   hold bid and ask, field types (string vs number — Coinbase often returns
   strings), CORS behavior from an extension context (check the official docs
   for `Access-Control-Allow-Origin`; note if the background service worker will
   need `host_permissions`), rate limit from official docs with the docs URL.
3. Pick one. Write `RECOMMENDED:` at the top of `endpoints.md` with the reason.
   If neither works unauthenticated, say so and mark R1 BLOCKED.

### 3.2 R2 — Advanced Trade fee schedule (`research/fees.md`, `research/fees.json`)

Goal: the current entry-tier maker and taker rate for Advanced Trade, from an
official Coinbase page only (help.coinbase.com or coinbase.com). Not from
third-party reviews, not from memory.

1. Find the official fee page. Save its URL and the date you read it.
2. Record the full tier table in `fees.md` with the URL.
3. Write `fees.json`:

```json
{
  "takerRate": <number from the page>,
  "makerRate": <number from the page>,
  "tierLabel": "<label from the page>",
  "source": "<official url>",
  "capturedAt": "<ISO date>"
}
```

4. Also note in `fees.md`: does the Simple trade preview show a fee line for
   Coinbase One users (expected $0)? Does the page disclose the Simple-trade
   spread anywhere? Quote the exact wording with URL if so.

### 3.3 R3 — DOM captures and selectors (`research/dom/`, `research/selectors.md`)

This needs a logged-in Coinbase session, which you cannot create. Write the
human instructions below into `research/dom/HOW_TO_CAPTURE.md`, mark R3 as
"WAITING ON HUMAN", and move on to R4/R5. When the HTML files appear, finish
`selectors.md`.

Human capture instructions:

1. On coinbase.com (web, logged in), start a Simple buy of $10 BTC. Stop on the
   preview/confirm screen. Do not confirm.
2. DevTools → Elements → right-click the smallest element that contains the
   asset name, amount, quoted price, fee, and Confirm button → Copy → Copy outerHTML.
3. Paste into `research/dom/preview-BTC-USD-{YYYY-MM-DD}.html`.
4. **Scrub before committing**: remove or replace your email, name, account IDs,
   balances, and any URLs containing tokens. Keep every structural attribute
   (class, data-testid, aria-label, role) untouched.
5. Repeat for ETH-USD and SOL-USD.

When captures exist, write `selectors.md`:

- For each of: preview container, asset/product name, fiat amount, quoted
  price, fee line, Confirm button — give a CSS selector, prefer `data-testid`
  or `aria-*` over class names, and note how stable it looks.
- Show the exact text format of each scraped field (e.g. `$67,410.00`,
  `Fee $2.99`) so the build agent's parser handles the real format.
- Note anything that differs between the three pairs.

### 3.4 R4 — Advanced Trade deep link (`research/deeplinks.md`)

Find the URL pattern that opens a specific spot pair on Advanced Trade on web
(e.g. something like `https://www.coinbase.com/advanced-trade/spot/BTC-USD` —
verify, do not assume). Record the working pattern for all three pairs and
whether it requires login.

### 3.5 R5 — Manifest V3 constraints (`research/mv3-notes.md`)

From official Chrome docs, record with URLs:

- Required `host_permissions` for fetching the chosen ticker endpoint from a
  service worker.
- `content_scripts.matches` pattern for coinbase.com trade pages.
- Whether content scripts can fetch cross-origin directly or must message the
  service worker (this decides whether `background/price.ts` is required or
  optional).
- Service worker lifetime and why a 2s in-memory cache is enough.

### 3.6 Done means

All five files exist, `STATUS.md` shows DONE (or WAITING ON HUMAN for R3), every
number and URL in them has a source and date, and everything is pushed to
`research`.

---

## 4. BUILD AGENT — start here after reading 0, 1, 2

You build against section 2 exactly. You consume `research/` outputs; you never
edit them. If a research deliverable is missing, do the phases that don't need
it and record the blocker in `BUILD_STATUS.md`.

### 4.0 Setup

1. Create `BUILD_STATUS.md` with phases P0–P6 below as checkboxes.
2. `git merge research` (or `git fetch origin research && git merge origin/research`)
   at the start of every phase to pick up new research files.

### 4.1 P0 — Scaffold (no research dependency)

- `package.json`, `build.mjs` (esbuild, three entry points: background,
  content, and a JSON import of `research/fees.json`), `tsconfig.json`, vitest.
- `src/manifest.json` with placeholders **only** for structural fields you'll
  fill from R5 (permissions/matches). Comment each with `// TODO R5`.
- `lib/types.ts` exactly as in 2.4.
- Empty modules with the exported function signatures from 2.4.
- `npm run build` produces a loadable unpacked extension that does nothing.
- Commit.

### 4.2 P1 — Calculator (no research dependency for the code; needs R1 capture + R2 for tests)

- Implement `lib/calc.ts` per 2.4.
- Tests in `tests/calc.test.ts` use:
  - a `Ticker` built from a file in `research/captures/` (real),
  - a `FeeTier` from `research/fees.json` (real),
  - a `Quote` whose numbers come from `research/dom/` captures (real). If R3
    isn't in yet, mark the test `todo` and record the blocker. Do not type in a
    quote by hand.
- Commit.

### 4.3 P2 — Price fetcher (needs R1, R5)

- `background/price.ts`: `getTicker(productId): Promise<Ticker>`. Fetch the
  RECOMMENDED endpoint from `research/endpoints.md`, parse the fields named
  there (handle string→number), compute `mid`, attach `source` and `fetchedAt`.
  2s in-memory cache keyed by productId.
- `scripts/capture-fixtures.ts`: calls the live endpoint for all three pairs and
  writes `fixtures/ticker-{productId}-{ISO}.json` with `source` and
  `capturedAt`. This is the **only** way files get into `fixtures/`.
- `tests/price.test.ts`: parses the recorded fixtures (real) and asserts
  `mid === (bid+ask)/2`, types are numbers, `source` is present.
- Fill manifest `host_permissions` from R5. Commit.

### 4.4 P3 — Detect + scrape (needs R3)

- `content/detect.ts`: MutationObserver on `document.body`; fires a callback
  when the preview container selector from `config.ts` appears; debounce 100ms.
- `content/scrape.ts`: `scrape(root: Element): Quote | null`. Uses only
  `config.SELECTORS`. Parses the exact text formats documented in
  `selectors.md`. Returns `null` on any miss (rule 2.5).
- `tests/scrape.test.ts`: loads each file in `research/dom/` into jsdom
  (vitest environment), runs `scrape`, asserts the numbers match what is
  visibly in that real HTML.
- Commit.

### 4.5 P4 — Badge + wiring (needs R4)

- `content/badge.ts`: `render(cb: CostBreakdown, anchor: Element)`. Inserts a
  single `<div data-spreadcheck>` adjacent to (not over) the Confirm button.
  Inline styles only. Includes the `Fee tier source` line with the URL and date
  from `feeTier`.
- `content/index.ts`: detect → scrape → `chrome.runtime.sendMessage` →
  background returns `Ticker` → `breakdown()` → `render()`. Re-run on each
  detect event; replace the existing badge, never stack.
- `ADVANCED_URL` in config from R4.
- Manual test in Chrome with $10 real orders (do not confirm them). Record what
  you saw in `BUILD_STATUS.md`.
- Commit.

### 4.6 P5 — Real-data guard

- `npm run check:realdata`: script that fails if any of these appear in `src/`,
  `tests/`, `fixtures/`, `scripts/`: `mock`, `fake`, `sample`, `dummy`,
  `placeholder`, `faker`, `Math.random`, or a `fixtures/*.json` without both
  `source` and `capturedAt`. Also fails if `config.ts` contains a numeric literal
  for a rate or price (rates must come from `research/fees.json`).
- Wire it into `npm test`. Commit.

### 4.7 P6 — README

- What it does, the mobile limitation, how to load unpacked, how to re-capture
  fixtures, how to update `research/` when Coinbase changes the DOM, privacy
  statement (nothing stored, nothing sent anywhere but Coinbase's public API).
- A GIF or screenshot of the badge on a real preview screen.
- Commit.

### 4.8 Definition of done

- `npm run build && npm test` green, including `check:realdata`.
- Badge renders correct numbers on real BTC/ETH/SOL preview screens.
- Every number visible to the user is traceable: DOM, live endpoint, or
  `research/fees.json`.
- No commit older than 5 minutes of work between it and the next.

---

## 5. Real-data policy — what counts, precisely

| Data                           | Allowed source                                                                                                  | Not allowed                                      |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Quoted price, fiat amount, fee | Scraped from the live Coinbase DOM at runtime; in tests, from scrubbed real HTML in `research/dom/`             | Typed by hand, edited numbers                    |
| Bid / ask / mid                | Live fetch from the R1 endpoint at runtime; in tests, from `fixtures/` written by `scripts/capture-fixtures.ts` | Hand-written JSON, "typical" values              |
| Advanced Trade fee rates       | `research/fees.json`, copied from an official Coinbase page with URL + date                                     | Numbers remembered from reviews or training data |
| Selectors                      | `research/selectors.md`, derived from real captures                                                             | Guessed class names                              |
| Deep link pattern              | `research/deeplinks.md`, verified in a browser                                                                  | Assumed URL shape                                |
| Timestamps                     | `new Date().toISOString()` at capture/fetch time, passed into `calc`                                            | Fixed strings                                    |

If a test cannot be written without real data that doesn't exist yet, mark it
`test.todo` with the blocker name (R1–R5). A todo test is honest; a fabricated
fixture is a policy violation.
