export type PageChangeReason = "DOM_MUTATION" | "SPA_NAVIGATION";
export type PageChangeListener = (reason: PageChangeReason) => void;

const OWNED_SELECTOR = [
  "[data-contextlayer-engine-styles]",
  "[data-contextlayer-strike-overlay]",
].join(",");

export class PageObserver {
  private observer?: MutationObserver;
  private listening = false;

  constructor(
    private readonly document: Document,
    private readonly ignoredUiAttribute: string,
    private readonly onChange: PageChangeListener,
  ) {}

  start(): void {
    if (this.listening) return;
    const MutationObserverConstructor = this.document.defaultView?.MutationObserver;
    const root = this.document.documentElement;
    if (!MutationObserverConstructor || !root) return;

    this.observer = new MutationObserverConstructor((records) => {
      if (records.some((record) => this.isMeaningful(record))) {
        this.onChange("DOM_MUTATION");
      }
    });
    this.observer.observe(root, {
      childList: true,
      characterData: true,
      characterDataOldValue: true,
      subtree: true,
    });
    this.listening = true;
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = undefined;
    this.listening = false;
  }

  flushPendingChanges(): boolean {
    const records = this.observer?.takeRecords() ?? [];
    const changed = records.some((record) => this.isMeaningful(record));
    if (changed) this.onChange("DOM_MUTATION");
    return changed;
  }

  private isMeaningful(record: MutationRecord): boolean {
    const target = asElement(record.target);
    if (target && this.isIgnored(target)) return false;

    if (record.type === "characterData") {
      return Boolean(record.target.textContent?.trim() || record.oldValue?.trim());
    }

    const changedNodes = [...record.addedNodes, ...record.removedNodes];
    return changedNodes.some((node) => !this.isIgnoredNode(node) && hasMeaningfulNodeContent(node));
  }

  private isIgnoredNode(node: Node): boolean {
    const element = asElement(node);
    return element ? this.isIgnored(element) : false;
  }

  private isIgnored(element: Element): boolean {
    return (
      element.matches(OWNED_SELECTOR) ||
      element.closest(OWNED_SELECTOR) !== null ||
      element.hasAttribute(this.ignoredUiAttribute) ||
      element.closest(`[${cssEscape(this.ignoredUiAttribute)}]`) !== null
    );
  }
}

function asElement(node: Node): Element | null {
  return node.nodeType === node.ELEMENT_NODE
    ? (node as Element)
    : node.parentElement;
}

function hasMeaningfulNodeContent(node: Node): boolean {
  if (node.nodeType === node.TEXT_NODE) return Boolean(node.textContent?.trim());
  if (node.nodeType !== node.ELEMENT_NODE) return false;
  const element = node as Element;
  if (["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT"].includes(element.tagName)) return false;
  return Boolean(element.textContent?.trim()) || element.children.length > 0;
}

function cssEscape(value: string): string {
  const escape = globalThis.CSS?.escape;
  return escape ? escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}
