import { SELECTORS } from "../config.js";

const DEBOUNCE_MS = 100;

/**
 * Watch document.body for the Simple-trade preview container appearing.
 * Read-only: never clicks, fills or submits anything (PROMPT.md rule 0.3).
 */
export function observePreview(onPreview: (root: Element) => void): () => void {
  if (!SELECTORS.previewContainer) {
    // Blocked on R3. Observing with an empty selector would match nothing
    // useful, so stay inert rather than firing on every mutation.
    return () => {};
  }

  let timer: ReturnType<typeof setTimeout> | undefined;

  const check = () => {
    const root = document.querySelector(SELECTORS.previewContainer);
    if (root) onPreview(root);
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(check, DEBOUNCE_MS);
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  schedule();

  return () => {
    if (timer) clearTimeout(timer);
    observer.disconnect();
  };
}
