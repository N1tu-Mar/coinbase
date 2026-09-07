import type { CostBreakdown } from "../lib/types.js";

/**
 * Marks our own injected element. Exported so content/detect.ts can tell our
 * mutations apart from Coinbase's — inserting the badge into the observed
 * subtree would otherwise retrigger the observer forever.
 */
export const BADGE_ATTR = "data-spreadcheck";

export const BADGE_SELECTOR = `[${BADGE_ATTR}]`;

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const pct = (n: number) =>
  n.toLocaleString("en-US", { style: "percent", minimumFractionDigits: 2 });

/**
 * Insert a single badge next to (never over) the Confirm button. Inline styles
 * only — no stylesheet injection. Replaces any existing badge, never stacks.
 */
export function render(cb: CostBreakdown, anchor: Element): void {
  remove();

  const el = document.createElement("div");
  el.setAttribute(BADGE_ATTR, "");
  el.style.cssText = [
    "margin:8px 0",
    "padding:10px 12px",
    "border:1px solid rgba(0,0,0,.15)",
    "border-radius:8px",
    "font:13px/1.45 system-ui,-apple-system,sans-serif",
    "color:#1a1a1a",
    "background:#fff",
  ].join(";");

  const line = (text: string, style = "") => {
    const d = document.createElement("div");
    d.textContent = text;
    if (style) d.style.cssText = style;
    el.appendChild(d);
  };

  line(`Quoted: ${usd(cb.quote.quotedPrice)}   Mid-market now: ${usd(cb.ticker.mid)}`);
  line(
    `Spread: ${pct(cb.spreadPct)}  +  Fee: ${usd(cb.feeUsd)}   =   ` +
      `${usd(cb.allInUsd)} over market on this ${usd(cb.quote.fiatAmount)} buy`,
    "font-weight:600",
  );
  line(`Same order on Advanced Trade ≈ ${usd(cb.advancedTradeEstUsd)}`);

  const link = document.createElement("a");
  link.href = cb.advancedTradeUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = `Open ${cb.quote.productId} in Advanced Trade →`;
  el.appendChild(link);

  line(
    `Fee tier source: ${cb.feeTier.source}, captured ${cb.feeTier.capturedAt}`,
    "margin-top:6px;font-size:11px;opacity:.7",
  );

  anchor.insertAdjacentElement("beforebegin", el);
}

export function remove(): void {
  document.querySelector(BADGE_SELECTOR)?.remove();
}
