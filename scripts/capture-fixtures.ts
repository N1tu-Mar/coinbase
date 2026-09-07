/**
 * The ONLY way a file gets into fixtures/. Hits the live endpoint named
 * RECOMMENDED in research/endpoints.md for all three pairs and records the raw
 * response with its source URL and capture time attached.
 *
 * Run: npm run capture:fixtures
 */
import { mkdir, writeFile } from "node:fs/promises";
import { PRODUCTS, TICKER_URL, TICKER_URL_TEMPLATE } from "../src/config.js";

async function main(): Promise<void> {
  if (!TICKER_URL_TEMPLATE) {
    console.error(
      "capture:fixtures blocked on R1 — research/endpoints.md has no RECOMMENDED endpoint yet.\n" +
        "Record the blocker in BUILD_STATUS.md rather than writing a fixture by hand.",
    );
    process.exit(1);
  }

  await mkdir("fixtures", { recursive: true });

  for (const productId of PRODUCTS) {
    const url = TICKER_URL(productId);
    const capturedAt = new Date().toISOString();
    const res = await fetch(url);
    const body = await res.json();

    const file = `fixtures/ticker-${productId}-${capturedAt.replace(/:/g, "-")}.json`;
    await writeFile(
      file,
      JSON.stringify({ source: url, capturedAt, status: res.status, body }, null, 2),
    );
    console.log(`wrote ${file} (${res.status})`);
  }
}

await main();
