import type {
  ElementKind,
  ElementRect,
  SemanticElement,
} from "@contextlayer/shared";
import type { ElementMapper } from "../mapping/element-mapper.js";
import type { ResolvedPageEngineOptions } from "../options.js";

interface Candidate {
  element: Element;
  kind: ElementKind;
  text: string;
  composite: boolean;
}

const CANDIDATE_SELECTOR = [
  "main",
  "article",
  "section",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "blockquote",
  "li",
  "tr",
  "a[href]",
  "[role='article']",
  "[role='listitem']",
  "[role='row']",
  "[data-caption]",
  "[data-testid*='caption' i]",
  "[class*='caption' i]",
  "article [dir='auto']",
  "article span",
  "div[class]",
].join(",");

const ALWAYS_EXCLUDED_SELECTOR = [
  "script",
  "style",
  "template",
  "noscript",
  "input",
  "textarea",
  "select",
  "option",
  "button",
  "[contenteditable='true']",
  "[hidden]",
  "[inert]",
  "[aria-hidden='true']",
].join(",");

const COMPOSITE_HINT = /(?:^|[-_\s])(card|comment|review|post|result|listing|thread)(?:$|[-_\s])/i;
const SAFE_ATTRIBUTES = ["role", "aria-label", "title", "datetime", "lang", "dir", "itemprop"];

export function extractSemanticElements(
  document: Document,
  mapper: ElementMapper,
  options: ResolvedPageEngineOptions,
): SemanticElement[] {
  const candidates: Candidate[] = [];
  const seenText = new Map<string, number>();

  for (const element of document.querySelectorAll(CANDIDATE_SELECTOR)) {
    if (!isEligible(element, document, options)) continue;

    const classification = classify(element);
    if (!classification) continue;
    if (
      isStructural(classification.kind) &&
      !classification.composite &&
      hasSemanticDescendants(element) &&
      !hasMeaningfulDirectText(element)
    ) {
      continue;
    }

    const text = normalizeText(extractSafeText(element, options));
    if (!isMeaningful(text, classification.kind)) continue;

    const dedupeKey = text.toLocaleLowerCase();
    if (candidates.some((candidate) => candidate.composite && candidate.element.contains(element))) {
      continue;
    }

    const existingIndex = seenText.get(dedupeKey);
    if (existingIndex !== undefined) {
      const existing = candidates[existingIndex];
      if (existing && !existing.composite && existing.element.contains(element)) {
        candidates[existingIndex] = { element, text, ...classification };
      }
      continue;
    }

    seenText.set(dedupeKey, candidates.length);
    candidates.push({ element, text, ...classification });
  }

  const deduplicated = candidates.filter((candidate) =>
    !hasMoreSpecificTextDescendant(candidate, candidates),
  );

  const bounded: Candidate[] = [];
  let totalTextLength = 0;
  for (const candidate of deduplicated) {
    if (bounded.length >= options.maxElements) break;
    const available = options.maxTotalTextLength - totalTextLength;
    if (available <= 0) break;

    const text = candidate.text.slice(
      0,
      Math.min(options.maxElementTextLength, available),
    );
    if (!text) continue;
    bounded.push({ ...candidate, text });
    totalTextLength += text.length;
  }

  for (const candidate of bounded) mapper.getOrAssign(candidate.element);

  return bounded.map(({ element, kind, text }) => {
    const attributes = extractSafeAttributes(element);
    const parentId = findSemanticParentId(element, mapper);
    const rect = extractRect(element);
    const href = element instanceof document.defaultView!.HTMLAnchorElement
      ? sanitizeHref(element, document)
      : undefined;

    return {
      id: mapper.getOrAssign(element),
      kind,
      text,
      tagName: element.tagName.toLowerCase(),
      ...(href ? { href } : {}),
      ...(Object.keys(attributes).length > 0 ? { attributes } : {}),
      ...(parentId ? { parentId } : {}),
      visible: true,
      ...(rect ? { rect } : {}),
    };
  });
}

function isEligible(
  element: Element,
  document: Document,
  options: ResolvedPageEngineOptions,
): boolean {
  if (!element.isConnected || element.matches(ALWAYS_EXCLUDED_SELECTOR)) return false;
  if (element.closest(`[${cssEscape(options.ignoredUiAttribute)}]`)) return false;
  if (element.closest("script, style, template, noscript, [hidden], [inert], [aria-hidden='true']")) {
    return false;
  }

  const view = document.defaultView;
  if (!view) return false;
  return isRendered(element, view);
}

function classify(element: Element): Pick<Candidate, "kind" | "composite"> | undefined {
  const tag = element.tagName.toLowerCase();
  const role = element.getAttribute("role")?.toLowerCase();
  const hint = `${element.id} ${element.className}`;
  const composite = COMPOSITE_HINT.test(hint);

  if (/^h[1-6]$/.test(tag)) return { kind: "heading", composite: false };
  if (tag === "p" || tag === "blockquote") return { kind: "paragraph", composite: false };
  if (isCaptionContainer(element)) {
    return { kind: "paragraph", composite: isExplicitCaptionContainer(element) };
  }
  if (tag === "li" || role === "listitem") return { kind: "list-item", composite: false };
  if (tag === "tr" || role === "row") return { kind: "table-row", composite: false };
  if (tag === "a") return { kind: "link", composite: false };
  if (/comment|review/i.test(hint)) return { kind: "comment", composite: true };
  if (composite || isRepeatedSibling(element)) return { kind: "card", composite: true };
  if (tag === "article" || role === "article") return { kind: "article", composite: false };
  if (tag === "main" || tag === "section") return { kind: "section", composite: false };
  return undefined;
}

function isRepeatedSibling(element: Element): boolean {
  if (element.tagName !== "DIV" || !element.parentElement) return false;
  const signature = classSignature(element);
  if (!signature) return false;
  let matches = 0;
  for (const sibling of element.parentElement.children) {
    if (sibling.tagName === element.tagName && classSignature(sibling) === signature) {
      matches += 1;
      if (matches >= 2) return true;
    }
  }
  return false;
}

function classSignature(element: Element): string {
  return Array.from(element.classList).sort().join(".");
}

function isStructural(kind: ElementKind): boolean {
  return kind === "section" || kind === "article";
}

function hasSemanticDescendants(element: Element): boolean {
  return element.querySelector([
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "blockquote",
    "li",
    "tr",
    "a[href]",
    "[data-caption]",
    "[data-testid*='caption' i]",
    "[class*='caption' i]",
    "[dir='auto']",
    "span",
  ].join(",")) !== null;
}

function isCaptionContainer(element: Element): boolean {
  const tag = element.tagName.toLowerCase();
  const hint = `${element.id} ${element.className} ${element.getAttribute("data-testid") ?? ""}`;
  if (element.hasAttribute("data-caption") || /caption/i.test(hint)) return true;
  if (element.closest("article") && element.getAttribute("dir") === "auto") return true;
  return (
    tag === "span" &&
    element.closest("article") !== null &&
    element.closest("a,button,time,nav,header,footer") === null
  );
}

function isExplicitCaptionContainer(element: Element): boolean {
  const hint = `${element.id} ${element.className} ${element.getAttribute("data-testid") ?? ""}`;
  return (
    element.hasAttribute("data-caption") ||
    /caption/i.test(hint) ||
    element.getAttribute("dir") === "auto"
  );
}

function hasMoreSpecificTextDescendant(candidate: Candidate, candidates: Candidate[]): boolean {
  if (candidate.composite) return false;
  return candidates.some((other) => {
    if (other === candidate || other.composite || !candidate.element.contains(other.element)) {
      return false;
    }
    if (!candidate.text.includes(other.text)) return false;
    const omittedLength = candidate.text.length - other.text.length;
    return other.text.length / candidate.text.length >= 0.65 && omittedLength <= 60;
  });
}

function hasMeaningfulDirectText(element: Element): boolean {
  return Array.from(element.childNodes).some(
    (node) => node.nodeType === node.TEXT_NODE && normalizeText(node.textContent ?? "").length >= 20,
  );
}

function extractSafeText(element: Element, options: ResolvedPageEngineOptions): string {
  const document = element.ownerDocument;
  const walker = document.createTreeWalker(element, document.defaultView!.NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  let node = walker.nextNode();

  while (node) {
    const parent = node.parentElement;
    if (
      parent &&
      !parent.closest(ALWAYS_EXCLUDED_SELECTOR) &&
      !parent.closest(`[${cssEscape(options.ignoredUiAttribute)}]`) &&
      document.defaultView &&
      isRenderedBetween(parent, element, document.defaultView)
    ) {
      parts.push(node.textContent ?? "");
    }
    node = walker.nextNode();
  }
  return parts.join(" ");
}

function isRendered(element: Element, view: Window): boolean {
  let current: Element | null = element;
  while (current) {
    const style = view.getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      return false;
    }
    current = current.parentElement;
  }
  return true;
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

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function isMeaningful(text: string, kind: ElementKind): boolean {
  const minimum = kind === "link" || kind === "heading" ? 2 : 8;
  return text.length >= minimum && /[\p{L}\p{N}]/u.test(text);
}

function extractSafeAttributes(element: Element): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of SAFE_ATTRIBUTES) {
    const value = normalizeText(element.getAttribute(name) ?? "");
    if (value) result[name] = value.slice(0, 300);
  }
  return result;
}

function sanitizeHref(anchor: HTMLAnchorElement, document: Document): string | undefined {
  const raw = anchor.getAttribute("href");
  if (!raw) return undefined;
  try {
    const url = new URL(raw, document.baseURI);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol)
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

function findSemanticParentId(element: Element, mapper: ElementMapper): string | undefined {
  let parent = element.parentElement;
  while (parent) {
    const id = mapper.getId(parent);
    if (id) return id;
    parent = parent.parentElement;
  }
  return undefined;
}

function extractRect(element: Element): ElementRect | undefined {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 && rect.height <= 0) return undefined;
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
}

function cssEscape(value: string): string {
  const escape = globalThis.CSS?.escape;
  return escape ? escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}
