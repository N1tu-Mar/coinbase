# Research status

- [x] R1 endpoints.md + captures/        DONE  api.exchange.coinbase.com/products/{id}/ticker recommended; bid+ask are strings; ACAO `*`
- [ ] R2 fees.md + fees.json             BLOCKED  all official Coinbase fee pages return Cloudflare 403; no browser available. fees.json NOT written. See research/fees.md for 3 unblock paths.
- [ ] R3 dom/ + selectors.md             NOT STARTED (needs human capture — see 3.3)
- [ ] R4 deeplinks.md                    NOT STARTED
- [ ] R5 mv3-notes.md                    NOT STARTED

## Blockers / missing data
(none yet)

## Blockers / missing data

### B1 — Advanced Trade fee rates (blocks R2, blocks `src/config.ts` FEE_TIER, blocks P1 tests)
Every official Coinbase page carrying the fee tier table is behind a Cloudflare managed
challenge (HTTP 403 to WebFetch and to curl). Claude-in-Chrome is not connected and Chrome
AppleScript JS is disabled. `research/fees.json` is intentionally absent rather than
invented. Unblock: connect the Claude-in-Chrome extension, or enable Chrome
View > Developer > Allow JavaScript from Apple Events, or paste the table into
`research/fees.md`. Detail in `research/fees.md`.
