# Research status

Last updated 2026-09-07. Branch: `research`.

- [x] **R1** `endpoints.md` + `captures/` — **DONE**
      RECOMMENDED `https://api.exchange.coinbase.com/products/{productId}/ticker`.
      Unauthenticated, 200 for all three pairs, returns `bid` and `ask` as **strings**
      (parse them), no `mid` (compute it), `access-control-allow-origin: *`,
      10 req/s per IP (burst 15). Nine raw live captures in `research/captures/`.
- [ ] **R2** `fees.md` + `fees.json` — **BLOCKED (B1)**
      `fees.json` deliberately NOT written. Every official Coinbase fee page is behind a
      Cloudflare managed challenge. Details and three unblock paths in `research/fees.md`.
- [ ] **R3** `dom/` + `selectors.md` — **WAITING ON HUMAN (B2)**
      Instructions written to `research/dom/HOW_TO_CAPTURE.md`. `selectors.md` cannot be
      written until the three scrubbed HTML captures exist.
- [~] **R4** `deeplinks.md` — **PARTIAL (B3)**
      `/advanced-trade/spot` and `exchange.coinbase.com/trade/{productId}` confirmed as real
      indexed URLs. The per-pair `/advanced-trade/spot/{productId}` shape is unverified —
      Cloudflare returns 403 to every path for a non-browser client, including bogus ones,
      so the 403 proves nothing. Needs a 30-second browser check.
- [x] **R5** `mv3-notes.md` — **DONE**
      `host_permissions: ["https://api.exchange.coinbase.com/*"]`.
      `content_scripts.matches: ["https://www.coinbase.com/*"]`.
      **Content scripts cannot fetch cross-origin even with `host_permissions`** — so
      `background/price.ts` is REQUIRED, not optional. Service worker dies after 30s idle
      and loses all globals, which is exactly why a 2s in-memory `Map` cache is right and
      `chrome.storage` would be wrong.

---

## What the build agent can start on right now

- **P2 price fetcher** is fully unblocked. R1 gives the endpoint and field types, R5 gives
  the manifest entries and the architecture ruling.
- **P0 scaffold** was never blocked.
- **P1 calculator code** is unblocked; its **tests** are not (they need R2 and R3 for real
  inputs — mark those `test.todo` with the blocker name, per PROMPT §5).
- **P3 detect/scrape** is blocked on R3.
- **P4 badge** needs R4's URL confirmed before it can ship a correct link, and needs R2 for
  the `advancedTradeEstUsd` line.

---

## Blockers / missing data

### B1 — Advanced Trade fee rates. Blocks R2, `config.ts` FEE_TIER, P1 tests, P4 badge.

Every official Coinbase page carrying the fee tier table returns HTTP 403 with a Cloudflare
"Just a moment…" managed-challenge body — to `WebFetch` and to `curl` with a full desktop
Chrome User-Agent alike. `exchange.coinbase.com/fees` returns 200 but is a React SPA shell
with no fee text in the HTML. `docs.cdp.coinbase.com` is reachable but carries no fee table.
Claude-in-Chrome reports "Browser extension is not connected"; Chrome's AppleScript bridge
reports "Executing JavaScript through AppleScript is turned off".

Rule 0.2 permits fee rates only when copied from an official Coinbase page with a URL and a
date, so no numbers were written. `research/fees.json` does not exist. **The build agent
must not invent it** — `src/config.ts` imports it, so P4 stays blocked until a human
supplies it.

Unblock, any one of:
1. Connect the Claude-in-Chrome extension (https://claude.ai/chrome).
2. Chrome → View → Developer → Allow JavaScript from Apple Events.
3. Open the fee page yourself and paste the table into `research/fees.md`.

### B2 — Simple-trade preview DOM. Blocks R3, P3 entirely, P1 tests.

Needs a logged-in Coinbase session; rule 0.3 keeps every agent off it. Human instructions
are in `research/dom/HOW_TO_CAPTURE.md`, including the scrubbing checklist and four
questions to answer by eye while on the preview screen.

### B3 — Advanced Trade per-pair URL. Blocks final confirmation of R4, soft-blocks P4.

Cloudflare 403s every `www.coinbase.com` path for non-browser clients, so the pattern can be
neither confirmed nor refuted from here. A confirmed fallback exists
(`https://exchange.coinbase.com/trade/{productId}`) but it points at Coinbase Exchange, a
different product with a different fee schedule, so it is not a drop-in substitute.
Unblock: paste the three URLs into a browser and record what happens
(`research/deeplinks.md` has the exact steps).

**B1, B2 and B3 all reduce to the same missing capability: this agent has no browser.**
Connecting Claude-in-Chrome clears B1 and B3 outright and leaves only B2, which genuinely
requires a human's logged-in session.
