export interface ScanWhenReadyOptions {
  timeoutMs?: number;
  settleMs?: number;
  minimumTextLength?: number;
}

interface ResolvedWaitOptions {
  timeoutMs: number;
  settleMs: number;
  minimumTextLength: number;
}

const CONTENT_SELECTOR = [
  "article",
  "main",
  "h1",
  "h2",
  "h3",
  "p",
  "li",
  "blockquote",
  "[data-caption]",
  "[data-testid*='caption' i]",
  "article [dir='auto']",
].join(",");

export function waitForDynamicContent(
  document: Document,
  ignoredUiAttribute: string,
  defaults: Pick<ResolvedWaitOptions, "timeoutMs" | "settleMs">,
  options: ScanWhenReadyOptions = {},
): Promise<void> {
  const resolved: ResolvedWaitOptions = {
    timeoutMs: nonNegativeInteger(options.timeoutMs, defaults.timeoutMs),
    settleMs: nonNegativeInteger(options.settleMs, defaults.settleMs),
    minimumTextLength: positiveInteger(options.minimumTextLength, 8),
  };

  if (isReady(document, ignoredUiAttribute, resolved.minimumTextLength) && resolved.settleMs === 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const view = document.defaultView;
    const MutationObserverConstructor = view?.MutationObserver;
    let settledTimer: ReturnType<typeof setTimeout> | undefined;
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
    let observer: MutationObserver | undefined;

    const finish = (): void => {
      if (settledTimer !== undefined) clearTimeout(settledTimer);
      if (timeoutTimer !== undefined) clearTimeout(timeoutTimer);
      observer?.disconnect();
      document.removeEventListener("DOMContentLoaded", scheduleIfReady);
      resolve();
    };

    const scheduleIfReady = (): void => {
      if (!isReady(document, ignoredUiAttribute, resolved.minimumTextLength)) return;
      if (settledTimer !== undefined) clearTimeout(settledTimer);
      settledTimer = setTimeout(finish, resolved.settleMs);
    };

    if (MutationObserverConstructor && document.documentElement) {
      observer = new MutationObserverConstructor(scheduleIfReady);
      observer.observe(document.documentElement, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    }
    document.addEventListener("DOMContentLoaded", scheduleIfReady);
    timeoutTimer = setTimeout(finish, resolved.timeoutMs);
    scheduleIfReady();
  });
}

function isReady(document: Document, ignoredUiAttribute: string, minimumTextLength: number): boolean {
  if (document.readyState === "loading") return false;
  for (const element of document.querySelectorAll(CONTENT_SELECTOR)) {
    if (element.closest(`[${cssEscape(ignoredUiAttribute)}]`)) continue;
    if (element.closest("[hidden], [inert], [aria-hidden='true']")) continue;
    if (visibleTextLength(element, ignoredUiAttribute) >= minimumTextLength) {
      return true;
    }
  }
  return false;
}

function visibleTextLength(element: Element, ignoredUiAttribute: string): number {
  const document = element.ownerDocument;
  const view = document.defaultView;
  if (!view) return 0;
  const walker = document.createTreeWalker(element, view.NodeFilter.SHOW_TEXT);
  let length = 0;
  let node = walker.nextNode();

  while (node) {
    const parent = node.parentElement;
    if (
      parent &&
      !parent.closest("[hidden], [inert], [aria-hidden='true'], script, style, template, noscript") &&
      !parent.closest(`[${cssEscape(ignoredUiAttribute)}]`) &&
      isRenderedBetween(parent, element, view)
    ) {
      length += (node.textContent ?? "").replace(/\s+/g, " ").trim().length;
    }
    node = walker.nextNode();
  }
  return length;
}

function isRenderedBetween(element: Element, boundary: Element, view: Window): boolean {
  let current: Element | null = element;
  while (current) {
    const style = view.getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      return false;
    }
    if (current === boundary) return true;
    current = current.parentElement;
  }
  return false;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && value !== undefined && value > 0 ? value : fallback;
}

function nonNegativeInteger(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && value !== undefined && value >= 0 ? value : fallback;
}

function cssEscape(value: string): string {
  const escape = globalThis.CSS?.escape;
  return escape ? escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}
