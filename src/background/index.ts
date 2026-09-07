import { getTicker } from "./price.js";
import type { TickerRequest, TickerResponse } from "../lib/types.js";

chrome.runtime.onMessage.addListener(
  (msg: TickerRequest, _sender, sendResponse: (r: TickerResponse) => void) => {
    if (msg?.type !== "spreadcheck:ticker") return false;

    getTicker(msg.productId)
      .then((ticker) => sendResponse({ ok: true, ticker }))
      .catch((e: unknown) => sendResponse({ ok: false, error: String(e) }));

    return true; // keep the message channel open for the async response
  },
);
