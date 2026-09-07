// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseMoney, scrape } from "../src/content/scrape.js";
import { domCaptures } from "./real-data.js";

const pages = domCaptures();

describe("parseMoney", () => {
  it.skipIf(pages.length > 0)("has no DOM captures yet — blocked on R3", () => {
    expect(pages).toHaveLength(0);
  });

  it("rejects text with no number rather than guessing", () => {
    expect(parseMoney("Fee")).toBeNull();
    expect(parseMoney("")).toBeNull();
  });
});

describe("scrape over real preview HTML", () => {
  if (pages.length === 0) {
    it.todo("extracts a Quote from each capture in research/dom/ — blocked on R3");
  }

  for (const page of pages) {
    it(`extracts a Quote from ${page.file}`, () => {
      document.body.innerHTML = page.html;
      const quote = scrape(document.body);
      // Every asserted number must be visible in that real HTML.
      expect(quote).not.toBeNull();
      expect(quote!.fiatAmount).toBeGreaterThan(0);
      expect(quote!.quotedPrice).toBeGreaterThan(0);
      expect(quote!.feeDisplayed).toBeGreaterThanOrEqual(0);
    });
  }
});
