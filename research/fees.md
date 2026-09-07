# R2 — Advanced Trade fee schedule

**STATUS: BLOCKED. `research/fees.json` has deliberately NOT been written.**

Rule 0.2 allows fee rates only if copied from an official Coinbase page by this agent
with a source URL and capture date. I could not read any official Coinbase fee page, so
per rule 0.2 I am recording the gap instead of inventing numbers.

## What the official page is

`https://help.coinbase.com/en/coinbase/trading-and-funding/advanced-trade/advanced-trade-fees`
— titled "Coinbase Advanced fees". This is the page `fees.json` must be copied from.
Secondary candidate: `https://www.coinbase.com/advanced-trade/spot/fees`.

## Why it could not be read (all attempted 2026-09-07)

| Attempt                                                         | Result                                                          |
| --------------------------------------------------------------- | --------------------------------------------------------------- |
| `WebFetch` on the help.coinbase.com fees article                  | HTTP 403                                                        |
| `WebFetch` on `www.coinbase.com/advanced-trade/spot/fees`         | HTTP 403                                                        |
| `curl` with a full desktop-Chrome User-Agent, both URLs           | HTTP 403, body is a Cloudflare "Just a moment…" managed challenge |
| `curl` on `help.coinbase.com/sitemap.xml` and its article API     | HTTP 403, same challenge                                        |
| `curl` on `https://exchange.coinbase.com/fees`                    | HTTP 200 but it is a React SPA shell; no fee text in the HTML    |
| `WebFetch` on `https://docs.cdp.coinbase.com/exchange/docs/fees`  | 200, but the page carries no fee tier table                     |
| Claude-in-Chrome browser tools                                    | "Browser extension is not connected"                            |
| Chrome via AppleScript                                            | "Executing JavaScript through AppleScript is turned off"        |

Every Coinbase surface that carries the fee table sits behind a Cloudflare managed
challenge that needs a real, JavaScript-executing browser.

## How to unblock (any one of these is enough)

1. **Connect the Claude-in-Chrome extension** (https://claude.ai/chrome), then this agent
   can open the help article and read the table itself.
2. **Chrome menu → View → Developer → Allow JavaScript from Apple Events**, then this
   agent can read the page out of the running browser.
3. **Human paste.** Open the help article, copy the whole fee tier table, and drop it in
   this file under "Captured table" below along with the URL and the date you read it.

## Captured table

_(empty — waiting on unblock)_

Fill it in this shape, one row per pricing tier exactly as the page lists them:

| Pricing tier | 30-day volume (USD) | Taker | Maker |
| ------------ | ------------------- | ----- | ----- |

Then write `research/fees.json`:

```json
{
  "takerRate": <entry-tier taker as a decimal, e.g. 0.6% -> 0.006>,
  "makerRate": <entry-tier maker as a decimal>,
  "tierLabel": "<the label the page uses for the entry tier>",
  "source": "https://help.coinbase.com/en/coinbase/trading-and-funding/advanced-trade/advanced-trade-fees",
  "capturedAt": "<ISO date you read the page>"
}
```

Note for whoever fills this in: the page states rates as **percentages** (`0.60%`).
`FeeTier.takerRate` in `src/lib/types.ts` is a **decimal fraction** (`0.006`). Divide by 100.

## Open sub-questions from PROMPT 3.2 step 4

Both still unanswered, blocked by the same paywall of a Cloudflare challenge:

- **Does the Simple trade preview show a fee line for Coinbase One users (expected $0)?**
  Not verifiable from a public page; it needs the R3 human DOM capture from a Coinbase One
  account. Note for the build agent: `Quote.feeDisplayed` is documented as "0 is valid" in
  PROMPT 2.4, so a $0 fee line must parse to `0`, not to `null`. If a Coinbase One account
  omits the fee row entirely rather than showing `$0.00`, `scrape()` returns `null` under
  rule 2.5 and no badge renders — flag this when R3 captures arrive.
- **Does Coinbase disclose the Simple-trade spread anywhere?** No official wording captured.
  Do not paraphrase from memory; quote it exactly with the URL or leave it blank.
