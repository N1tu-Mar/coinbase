# R5 — Manifest V3 constraints

All quotes below are from official Chrome extension docs, read **2026-09-07**.

---

## 1. `host_permissions` for the ticker fetch

Required entry in `src/manifest.json`, given the R1 RECOMMENDED endpoint:

```json
"host_permissions": ["https://api.exchange.coinbase.com/*"]
```

If the build agent ever falls back to R1 candidate 2, add
`"https://api.coinbase.com/*"` as well.

Source: https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns
(read 2026-09-07). Pattern grammar is `<scheme>://<host>:<port>/<path>`, and:

> For host permissions, the path is required but ignored. The wildcard (`/*`) should be
> used by convention.

So the trailing `/*` is mandatory syntax, not an over-broad grant — the path is ignored
either way. Do **not** widen the host to `*.coinbase.com`: a leading `*` is legal only as
the first character followed by a `.`, and here it would buy nothing but a scarier
permission prompt.

Keep `permissions` empty. This extension needs no `storage`, no `tabs`, no `activeTab` —
it reads the DOM from a declared content script and fetches one public URL.

## 2. `content_scripts.matches` for Coinbase trade pages

```json
"content_scripts": [{
  "matches": ["https://www.coinbase.com/*"],
  "js": ["content.js"],
  "run_at": "document_idle"
}]
```

Notes on the choice:

- **`https` only, not `*://`.** `*` in the scheme position matches `http` *and* `https`;
  there is no reason to run on a plaintext Coinbase.
- **`www.coinbase.com`, not `*.coinbase.com`.** The Simple buy flow lives on the www host.
  A subdomain wildcard would also inject into `help.coinbase.com`, `exchange.coinbase.com`,
  `accounts.coinbase.com` and every marketing subdomain, for no gain.
- **Path is `/*`, not a narrower prefix.** The Simple buy flow is a client-side-routed SPA:
  the user can land on `/` and reach the buy preview without a full page load, so a path
  filter keyed on the trade route would miss those sessions. The narrowing happens in
  `content/detect.ts` instead — the MutationObserver only fires when the preview-container
  selector actually appears, so on every other Coinbase page the content script costs one
  observer and nothing else.
- **Locale prefixes.** Coinbase serves localized paths such as `/en-gb/…`. `/*` covers
  those; a hand-written path filter would not.

Source: https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns
(read 2026-09-07).

## 3. Can the content script fetch cross-origin directly?

**No. `background/price.ts` is REQUIRED, not optional.**

Source: https://developer.chrome.com/docs/extensions/develop/concepts/network-requests
(read 2026-09-07), quoting verbatim:

> Content scripts initiate requests on behalf of the web origin that the content script has
> been injected into and therefore content scripts are also subject to the same origin policy.

> Cross-origin requests are always treated as such in content scripts, even if the extension
> has host permissions.

> A script executing in an extension service worker or foreground tab can talk to remote
> servers outside of its origin, as long as the extension requests host permissions.

Read that carefully, because it decides the architecture:

- A content-script fetch to `api.exchange.coinbase.com` goes out as an ordinary
  cross-origin request **from the `https://www.coinbase.com` origin**, and
  `host_permissions` does not exempt it.
- It is not automatically doomed — that endpoint does return
  `access-control-allow-origin: *` (see R1), so plain CORS would let the response through.
- But it would then be a request made from Coinbase's own origin, subject to whatever
  Coinbase's page-level policy and future CSP changes do to it, and it would put our
  traffic on the user's Coinbase origin. Both are fragile and both are avoidable.
- The service worker path has no such coupling: with `host_permissions` declared, the fetch
  is made from the extension's own origin and CORS is not in play at all.

Conclusion: keep the PROMPT 2.3 data flow exactly as specified —
`content/index.ts` → `chrome.runtime.sendMessage` → `background/price.ts` → `fetch` → back.
Never fetch from `content/`.

## 4. Service worker lifetime, and why 2 seconds of cache is enough

Source: https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle
(read 2026-09-07), quoting verbatim:

> After 30 seconds of inactivity. Receiving an event or calling an extension API resets this timer.

> When a single request, such as an event or API call, takes longer than 5 minutes to process.

> When a `fetch()` response takes more than 30 seconds to arrive.

And on state:

> Any global variables are lost when the service worker shuts down.

What this means for `background/price.ts`:

- The cache is a plain module-scope `Map`. When the worker is torn down the Map dies with
  it. That is **fine and intended**: a dead cache costs exactly one extra HTTP request on
  the next message, and a stale price is worse than a fresh one for this product.
- Do not "fix" this with `chrome.storage`. Persisting prices across worker restarts would
  hand the badge a price from an unknown number of minutes ago — the opposite of what a
  live spread comparison needs — and it would add a storage permission we otherwise don't
  need.
- The 30s idle timeout is 15× the 2s TTL, so within any single burst of user activity
  (open preview, adjust amount, re-preview) the worker stays alive and the cache does its
  job. Across a longer gap the worker is gone anyway and we refetch, which is correct.
- Set a fetch timeout below 30s (`AbortController`) so a hung request fails our way rather
  than by worker termination. On failure, render nothing and log once — PROMPT 2.5.
- The 2s TTL is also what keeps us far inside the R1 rate limit: 0.5 req/s per pair against
  a documented 10 req/s per IP.

## 5. Manifest skeleton implied by the above

```json
{
  "manifest_version": 3,
  "name": "spread-check",
  "version": "0.1.0",
  "background": { "service_worker": "background.js", "type": "module" },
  "host_permissions": ["https://api.exchange.coinbase.com/*"],
  "content_scripts": [{
    "matches": ["https://www.coinbase.com/*"],
    "js": ["content.js"],
    "run_at": "document_idle"
  }]
}
```

R5 is **DONE**. Nothing here is blocked.
