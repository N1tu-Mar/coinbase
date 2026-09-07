import { SELECTORS } from "../config.js";
import { BADGE_SELECTOR } from "./badge.js";

const DEBOUNCE_MS = 100;

/**
 * Watch document.body for the Simple-trade preview container appearing.
 * Read-only: never clicks, fills or submits anything (PROMPT.md rule 0.3).
 *
 * `selector` defaults to the config value; it is a parameter only so the
 * behaviour can be tested before R3 lands the real selector.
 */
export function observePreview(
  onPreview: (root: Element) => void,
  selector: string = SELECTORS.previewContainer,
): () => void {
  if (!selector) {
    // Blocked on R3. Observing with an empty selector would match nothing
    // useful, so stay inert rather than firing on every mutation.
    return () => {};
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const check = () => {
    if (stopped) return;
    const root = document.querySelector(selector);
    if (root) onPreview(root);
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(check, DEBOUNCE_MS);
  };

  const observer = new MutationObserver((records) => {
    // Rendering the badge mutates the very subtree we are observing. Without
    // this filter each render schedules the next one and the extension spins
    // on the preview screen forever.
    if (records.every(isOurOwnMutation)) return;
    schedule();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  schedule();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    observer.disconnect();
  };
}

/** True when a mutation record was caused by the badge and nothing else. */
function isOurOwnMutation(record: MutationRecord): boolean {
  if (isBadge(record.target)) return true;

  const touched = [
    ...Array.prototype.slice.call(record.addedNodes),
    ...Array.prototype.slice.call(record.removedNodes),
  ] as Node[];
  return touched.length > 0 && touched.every(isBadge);
}

function isBadge(node: Node): boolean {
  const el =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;
  return el !== null && el.closest(BADGE_SELECTOR) !== null;
}
