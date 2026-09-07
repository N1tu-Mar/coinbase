# How to capture the Simple-trade preview DOM

This is the one research deliverable an agent cannot produce: it needs a logged-in
Coinbase session, and rule 0.3 keeps every agent off the authenticated session entirely.
It blocks `research/selectors.md`, which blocks `src/config.ts` SELECTORS, `content/scrape.ts`
and `tests/scrape.test.ts` (build phase P3).

**You will not place an order.** You stop on the preview screen and never press Confirm.

---

## Steps — repeat for BTC, ETH, SOL

1. On **coinbase.com in a desktop browser, logged in**, start a Simple buy of **$10 of BTC**.
2. Go to the **preview / confirm screen and stop there. Do not confirm.**
3. Open DevTools → **Elements**.
4. Find the **smallest single element that contains all of**: the asset name, the amount,
   the quoted price, the fee line, and the Confirm button. Hover up the tree until the
   highlight covers all five and nothing more.
5. Right-click that element → **Copy → Copy outerHTML**.
6. Paste into `research/dom/preview-BTC-USD-YYYY-MM-DD.html` (today's date).
7. **Scrub it before committing** — see the next section. This is the step that matters.
8. Repeat for **ETH-USD** and **SOL-USD**, $10 each, into
   `preview-ETH-USD-YYYY-MM-DD.html` and `preview-SOL-USD-YYYY-MM-DD.html`.

## Scrubbing — do this before `git add`

These files get committed to a repo. Remove or replace:

- your email address and your name
- account IDs, user UUIDs, wallet/portfolio IDs, order IDs, idempotency keys
- **balances** and any "available to spend" figure
- any URL containing a token, `session`, `jwt`, `auth`, or a long random string
- avatar image URLs and `srcset`s pointing at your profile picture

Replace each with a same-shaped constant, e.g. `you@example.com`,
`00000000-0000-0000-0000-000000000000`. Do not delete the attribute — its presence is
structural information.

**Keep every structural attribute untouched:** `class`, `data-testid`, `data-*`, `aria-*`,
`role`, `id`, and the element tree itself. Those are the entire point of the capture.

**Keep the trade numbers exactly as shown** — the quoted price, the $10 amount, the fee. They
are not personal data, they are the real data the parser gets tested against, and rule 0.2
forbids editing them. A hand-edited price is a policy violation; an unscrubbed balance is a
privacy leak. Both are avoidable and neither is acceptable.

Quick self-check before committing:

```bash
grep -inE "@|balance|available|uuid|bearer|token=|session" research/dom/preview-*.html
```

Read every hit and confirm it is structural, not personal.

## Then tell the research agent

Once the three files are in, `research/selectors.md` gets written from them: a CSS selector
for each of the six targets, the exact text format of each scraped field, and any difference
between the three pairs.

## What to also note by hand while you are on the screen

Small things the outerHTML will not tell us, worth one line each in your message:

- Is the **fee** shown as a separate line item, or folded into a total? What is its exact
  label text (e.g. `Coinbase fee`, `Fee`)?
- If your account has **Coinbase One**: does the fee line show `$0.00`, or does the row
  disappear entirely? These need different handling — `Quote.feeDisplayed` treats `0` as a
  valid value, but a missing row makes `scrape()` return `null` and no badge renders.
- Is the **quoted price** shown per-unit (`$79,540.05`) or only as a total, and is it
  labelled (e.g. `Price`, `BTC price`)?
- Does the preview screen **refresh its price on a timer** (a countdown, a "price updates
  in Ns" line)? If it does, `content/detect.ts` will see repeated mutations and the badge
  must replace rather than stack — the build agent needs to know.
