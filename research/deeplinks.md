# R4 — Advanced Trade deep link

**STATUS: PARTIAL. One pattern is confirmed for all three pairs; the preferred pattern is
unverified and needs 30 seconds in a browser.**

---

## RECOMMENDED (pending one human check)

```
https://www.coinbase.com/advanced-trade/spot/{productId}
```

`productId` is used verbatim, uppercase, with the hyphen — the same string as
`Quote.productId` and as the R1 endpoint path, so `ADVANCED_URL` in `src/config.ts` is a
straight interpolation with no mapping table:

| Pair    | URL                                                  |
| ------- | ---------------------------------------------------- |
| BTC-USD | `https://www.coinbase.com/advanced-trade/spot/BTC-USD` |
| ETH-USD | `https://www.coinbase.com/advanced-trade/spot/ETH-USD` |
| SOL-USD | `https://www.coinbase.com/advanced-trade/spot/SOL-USD` |

### What is actually verified

- `https://www.coinbase.com/advanced-trade/spot` is a real, publicly indexed Coinbase page
  titled "Crypto Spot Markets". Confirmed 2026-09-07 as an indexed URL on `coinbase.com`.
- `https://www.coinbase.com/advanced-trade` is a real, publicly indexed Coinbase page
  titled "Advanced Trade". Confirmed 2026-09-07.

### What is NOT verified, and why

The per-pair `/{productId}` segment. `curl` against
`https://www.coinbase.com/advanced-trade/spot/BTC-USD` returns **HTTP 403 with a Cloudflare
"Just a moment…" managed-challenge body**. A control test settles what that 403 is worth:

| URL                                                        | Status |
| ---------------------------------------------------------- | ------ |
| `www.coinbase.com/advanced-trade/spot/BTC-USD`               | 403    |
| `www.coinbase.com/advanced-trade/spot/ZZZZ-NOPE` (bogus pair) | 403    |
| `www.coinbase.com/this/path/does/not/exist-xyz` (bogus path)  | 403    |

Cloudflare challenges before Coinbase routes, so **every** path on `www.coinbase.com`
returns 403 to a non-browser client. The 403 on the real URL is therefore not evidence of
anything — it neither confirms nor denies the pattern. Rule 0.2 says do not assume, so this
stays marked unverified rather than being written up as fact.

Claude-in-Chrome is not connected and Chrome's AppleScript JavaScript bridge is disabled,
so this agent has no browser to check with. Same root cause as the R2 blocker.

### Human verification step (about 30 seconds)

1. Paste `https://www.coinbase.com/advanced-trade/spot/BTC-USD` into a browser.
2. If it lands on the BTC-USD Advanced Trade chart, this file is confirmed — change
   this heading to CONFIRMED and note the date.
3. If it redirects, **write the URL it redirects to** here; that redirect target is the
   real pattern.
4. Repeat for ETH-USD and SOL-USD, and note whether the page renders while **logged out**.

### Login requirement

Unverified for the same reason. Behaviour to record when checking: does a logged-out visit
show the chart read-only, or does it bounce to `https://www.coinbase.com/signin`?

This matters for the badge copy, not for correctness. The badge link is a plain anchor the
user clicks; if Coinbase bounces them to sign-in, they are already signed in on the Simple
flow in the same browser, so they land on the pair either way. **Do not** add sign-in
handling to the extension — rule 0.3 keeps us off the authenticated session entirely.

---

## CONFIRMED FALLBACK — Coinbase Exchange

```
https://exchange.coinbase.com/trade/{productId}
```

`https://exchange.coinbase.com/trade/BTC-USD` is a publicly indexed Coinbase URL, confirmed
2026-09-07, titled "BTC to USD Coinbase Exchange | Institutional Trading Platform".

Use this **only** if the human check above shows `/advanced-trade/spot/{productId}` does not
work. It is not equivalent: Coinbase Exchange is the institutional platform with its own fee
schedule, so linking there while the badge quotes an *Advanced Trade* fee estimate would put
two different products on one line. If we ever fall back to it, the badge's fee-estimate copy
has to change with it.

---

## For `src/config.ts`

```ts
// source: research/deeplinks.md, R4, 2026-09-07 — pattern PENDING human verification
export const ADVANCED_URL = (productId: ProductId) =>
  `https://www.coinbase.com/advanced-trade/spot/${productId}`;
```

Keep it a single function in `config.ts` so that if the human check turns up a different
shape, exactly one line changes.
