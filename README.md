# spread-check

A Chrome extension that shows the real all-in cost of a Coinbase **Simple**
trade — the spread over mid-market plus the displayed fee — before you press
Confirm, and links you to the same pair on Advanced Trade.

## What it does

On the Simple buy preview screen it adds a small badge next to (never over) the
Confirm button:

```
Quoted: <price>   Mid-market now: <price>
Spread: <pct>  +  Fee: <usd>   =   <usd> over market on this <usd> buy
Same order on Advanced Trade ≈ <usd>      [Open BTC-USD in Advanced Trade →]
Fee tier source: <official url>, captured <date>
```

Every number is either scraped from the page you are already looking at,
fetched live from a public Coinbase endpoint, or traced to an official Coinbase
fee page. Nothing is estimated from memory.

## Limitations

- **Desktop web only.** Chrome extensions do not run inside the Coinbase mobile
  app, so this cannot help you there.
- Chrome only. Buy side only. BTC-USD, ETH-USD, SOL-USD only.

## Privacy

No backend, no storage, no analytics. The extension reads the DOM of the page
you have open and makes one unauthenticated request to Coinbase's public market
data endpoint. It never touches your session, cookies, balances or order
history, and it never clicks, fills or submits anything on your behalf.

## Load it unpacked

```sh
npm install
npm run build
```

Then in Chrome: `chrome://extensions` → enable Developer mode → **Load
unpacked** → select the `dist/` directory.

Until the `research/` deliverables land the extension loads and deliberately
renders nothing — see `BUILD_STATUS.md` for which inputs are missing.

## Re-capture ticker fixtures

```sh
npm run capture:fixtures
```

Hits the live endpoint for all three pairs and writes
`fixtures/ticker-<productId>-<ISO>.json` with the source URL and capture time
attached. This is the only way files may enter `fixtures/`.

## When Coinbase changes the DOM

The badge stops rendering rather than showing a wrong number. To fix it:

1. Re-capture the preview screen following `research/dom/HOW_TO_CAPTURE.md`.
2. Update `research/selectors.md` from the new capture.
3. Copy the new selectors into `src/config.ts` with a `// captured:` date.
   `config.ts` is the only file that holds selectors.
4. `npm test`.

Same shape for the other inputs: the fee tier lives only in
`research/fees.json`, the endpoint only in `research/endpoints.md`, the deep
link only in `research/deeplinks.md`.

## Checks

```sh
npm test   # check:realdata, then tsc --noEmit, then vitest
```

`npm run check:realdata` fails the build on:

- banned identifiers anywhere in `src/`, `tests/`, `fixtures/`, `scripts/` or
  `research/` — `research/dom/` and `research/captures/` are exempt, because
  they hold pages and API responses recorded verbatim and a real Coinbase page
  legitimately contains those words;
- any `fixtures/*.json` or `research/captures/*.json` lacking `source` and
  `capturedAt`;
- any numeric literal in `src/config.ts`;
- a `research/fees.json` whose rates are not traceable to an official Coinbase
  page: the source must be an https URL on `coinbase.com`, `research/fees.md`
  must cite that same URL, the capture date must parse and not be in the
  future, and the rates must be decimal fractions in a plausible band — so a
  percentage transcribed without dividing by 100 is caught.

To run it before every commit:

```sh
git config core.hooksPath .githooks
```

## Screenshot

TODO — needs a real preview screen on a logged-in session, same manual step as
research item R3.
