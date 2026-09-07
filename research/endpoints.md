# R1 — Public ticker endpoint

All calls below were made live with `curl` from a normal (unauthenticated) client on
**2026-09-07T07:26Z**. Raw responses are wrapped with `source` / `capturedAt` / `status`
and stored in `research/captures/`.

---

## RECOMMENDED

```
https://api.exchange.coinbase.com/products/{productId}/ticker
```

Reasons, in order of weight:

1. **It is the only candidate that returns `bid` and `ask` in one flat object.** `mid`
   can be computed as `(bid + ask) / 2` with no second request and no array walking.
2. **It is the only candidate that sends `access-control-allow-origin: *`.** Verified
   by sending `Origin: chrome-extension://…` (see CORS section). This makes the response
   readable from any origin, which removes a whole class of failure. It does **not** mean
   we may fetch from the content script — R5 settles that we must not; see
   `research/mv3-notes.md` §3.
3. Unauthenticated, 200, no API key, no `CB-ACCESS-*` headers.
4. 10 req/s per IP (burst 15) is far above what a 2s-cached, one-badge-at-a-time
   extension will use.

Runner-up: `https://api.coinbase.com/api/v3/brokerage/market/product_book?product_id={productId}&limit=1`.
It also returns bid and ask unauthenticated and even pre-computes `mid_market`, but it
sends **no** `access-control-allow-origin` header at all, so it only works from a
service worker with `host_permissions`. Keep it as the documented fallback.

---

## Candidate 1 — Coinbase Exchange public ticker

- **URL pattern:** `https://api.exchange.coinbase.com/products/{productId}/ticker`
- **Auth required:** no
- **HTTP status observed:** 200 for BTC-USD, ETH-USD, SOL-USD
- **Docs:** https://docs.cdp.coinbase.com/exchange/rest-api/rate-limits (read 2026-09-07)

Live BTC-USD body (captured 2026-09-07T07:26:31Z, full copy in `captures/`):

```json
{"ask":"79540.05","bid":"79540.04","volume":"2425.48311563","trade_id":1089753385,
 "price":"79540.05","size":"0.00023846","time":"2026-09-07T07:26:13.721780188Z",
 "rfq_volume":"20.622389"}
```

Field map for the build agent:

| Need | Field  | JSON type | Note                                          |
| ---- | ------ | --------- | --------------------------------------------- |
| bid  | `bid`  | **string** | must be `Number()` / `parseFloat`'d           |
| ask  | `ask`  | **string** | must be `Number()` / `parseFloat`'d           |
| mid  | —      | —          | not returned; compute `(bid + ask) / 2`       |
| time | `time` | string     | exchange-side trade time, ISO 8601 with nanos |

`trade_id` is the only numeric-typed field. **Everything price-shaped is a string.**
`price` is the last trade, not the mid — do not use it for `mid`.

## Candidate 2 — Advanced Trade public market data

The section-3.1 URL `https://api.coinbase.com/api/v3/brokerage/market/products/{productId}`
returns 200 unauthenticated but has **no bid/ask**: it carries `price`, 24h volume,
increments and product metadata, and its `mid_market_price` field came back as the
empty string `""` for all three pairs. Not usable on its own.

Two `/market/` variants that do carry bid and ask, both 200 unauthenticated:

**2a. `…/market/product_book?product_id={productId}&limit=1`**

```json
{"pricebook":{"product_id":"BTC-USD","bids":[{"price":"79540.04","size":"0.00441442"}],
 "asks":[{"price":"79540.05","size":"0.69659557"}],"time":"2026-09-07T07:26:13.546843Z"},
 "last":"79540.045","mid_market":"79540.045","spread_bps":"0.001257228277",
 "spread_absolute":"0.01"}
```

bid = `pricebook.bids[0].price` (string), ask = `pricebook.asks[0].price` (string),
and `mid_market` (string) is supplied. Requires the array index and a `limit=1` query
param, and `bids`/`asks` are empty arrays if the book is ever empty — an extra null
check the Exchange endpoint does not need.

**2b. `…/market/products/{productId}/ticker?limit=1`**

```json
{"trades":[{…}],"best_bid":"79540.04","best_ask":"79540.05"}
```

bid = `best_bid`, ask = `best_ask`, both strings, both at the top level. Clean shape,
but it drags a whole `trades` array along and shares candidate 2's CORS problem. The
per-trade `bid`/`ask` fields inside `trades[]` come back as empty strings — do not read
those by mistake.

---

## CORS behavior from an extension context

Verified live on 2026-09-07 with `curl -D - -H "Origin: chrome-extension://<id>"`:

| Host                       | `access-control-allow-origin` | Consequence                                                                  |
| -------------------------- | ----------------------------- | ---------------------------------------------------------------------------- |
| `api.exchange.coinbase.com` | `*`                           | fetchable from a content script **and** from the service worker              |
| `api.coinbase.com`          | *(header absent)*             | service worker + `host_permissions` only; a content-script fetch would be blocked |

`api.exchange.coinbase.com` also advertises
`access-control-allow-methods: GET,POST,DELETE,PUT` and `access-control-max-age: 7200`.

Either way the extension must declare the host in `host_permissions` and must issue the
fetch from the **service worker**, not from the content script. Chrome's docs are explicit
that `host_permissions` does not exempt a content script from the same-origin policy;
`background/price.ts` is therefore required, not optional. Full quotes in
`research/mv3-notes.md` §3.

## Rate limits

Source: https://docs.cdp.coinbase.com/exchange/rest-api/rate-limits — read 2026-09-07.

> Requests per second per IP: 10
> Requests per second per IP in bursts: Up to 15

Exceeding it returns `429 Too Many Requests`.

For Advanced Trade (candidate 2), Coinbase documents public endpoints as throttled by
IP at 10 requests/second — https://docs.cloud.coinbase.com/advanced-trade/docs/rest-api-rate-limits
(read 2026-09-07).

The 2s in-memory cache in `background/price.ts` caps us at 0.5 req/s per pair, ~1.5 req/s
with all three pairs live. Twenty times under the limit.

## Not blocked

R1 is **DONE**. Both candidate families work unauthenticated; the Exchange ticker is
recommended.
