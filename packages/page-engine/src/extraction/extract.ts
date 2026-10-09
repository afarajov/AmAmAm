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
  suppressesDescendants: boolean;
  order: number;
  priority: number;
}

interface DiscoveredElement {
  element: Element;
  order: number;
  priority: number;
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
  "main span",
  "[role='main'] span",
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
  const discovered = discoverCandidateElements(document, options);

  for (const { element, order } of discovered) {
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
    if (candidates.some((candidate) => (
      candidate.suppressesDescendants && candidate.element.contains(element)
    ))) {
      continue;
    }

    const existingIndex = seenText.get(dedupeKey);
    if (existingIndex !== undefined) {
      const existing = candidates[existingIndex];
      if (
        existing &&
        existing.element.contains(element) &&
        (!existing.composite || !existing.suppressesDescendants)
      ) {
        candidates[existingIndex] = {
          element,
          text,
          order,
          priority: scoreCandidate(element, classification.kind, text),
          ...classification,
        };
      }
      continue;
    }

    seenText.set(dedupeKey, candidates.length);
    candidates.push({
      element,
      text,
      order,
      priority: scoreCandidate(element, classification.kind, text),
      ...classification,
    });
  }

  const deduplicated = candidates.filter((candidate) =>
    !hasMoreSpecificTextDescendant(candidate, candidates),
  );

  const ranked = [...deduplicated].sort(
    (left, right) => right.priority - left.priority || left.order - right.order,
  );
  const boundedByPriority: Candidate[] = [];
  let totalTextLength = 0;
  for (const candidate of ranked) {
    if (boundedByPriority.length >= options.maxElements) break;
    const available = options.maxTotalTextLength - totalTextLength;
    if (available < minimumLength(candidate.kind)) break;

    const text = truncateDeterministically(
      candidate.text,
      Math.min(options.maxElementTextLength, available),
    );
    if (!isMeaningful(text, candidate.kind)) continue;
    boundedByPriority.push({ ...candidate, text });
    totalTextLength += text.length;
  }

  const bounded = boundedByPriority.sort((left, right) => left.order - right.order);

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

function discoverCandidateElements(
  document: Document,
  options: ResolvedPageEngineOptions,
): DiscoveredElement[] {
  const root = document.body ?? document.documentElement;
  const view = document.defaultView;
  if (!root || !view) return [];

  const elements: DiscoveredElement[] = [];
  let visited = 0;
  const walker = document.createTreeWalker(
    root,
    view.NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        const element = node as Element;
        if (isStaticallyExcludedSubtree(element, options)) {
          return view.NodeFilter.FILTER_REJECT;
        }
        return view.NodeFilter.FILTER_ACCEPT;
      },
    },
  );

  let node = walker.nextNode();
  while (node && visited < options.maxDomNodes) {
    visited += 1;
    const element = node as Element;
    if (isCandidateElement(element)) {
      elements.push({
        element,
        order: visited,
        priority: discoveryPriority(element),
      });
    }
    node = walker.nextNode();
  }
  return elements
    .sort((left, right) => right.priority - left.priority || left.order - right.order)
    .slice(0, options.maxCandidates)
    .sort((left, right) => left.order - right.order);
}

function isCandidateElement(element: Element): boolean {
  if (element.matches(CANDIDATE_SELECTOR)) return true;
  const tag = element.tagName.toLowerCase();
  return tag.includes("-") && isRepeatedSibling(element);
}

function discoveryPriority(element: Element): number {
  const tag = element.tagName.toLowerCase();
  const inPrimaryContent = element.closest(
    "main,article,[role='main'],[role='article']",
  ) !== null;
  const semanticTag = /^(h[1-6]|p|blockquote|li|tr|article|section)$/.test(tag);
  const customCard = tag.includes("-") && isRepeatedSibling(element);
  return (
    (inPrimaryContent ? 1_000 : 0) +
    (semanticTag ? 100 : 0) +
    (customCard ? 80 : 0) +
    (tag === "a" ? 10 : 0)
  );
}

function isStaticallyExcludedSubtree(
  element: Element,
  options: ResolvedPageEngineOptions,
): boolean {
  if (element.matches("script,style,template,noscript,[hidden],[inert],[aria-hidden='true']")) {
    return true;
  }
  if (element.hasAttribute(options.ignoredUiAttribute)) return true;
  if (element.matches("nav,[role='navigation'],[role='menu'],[role='menubar']")) return true;

  const tag = element.tagName.toLowerCase();
  const outsidePrimaryContent = element.closest("main,article,[role='main'],[role='article']") === null;
  return outsidePrimaryContent && (
    tag === "header" ||
    tag === "footer" ||
    tag === "aside" ||
    element.getAttribute("role") === "banner" ||
    element.getAttribute("role") === "contentinfo" ||
    element.getAttribute("role") === "complementary"
  );
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

function classify(
  element: Element,
): Pick<Candidate, "kind" | "composite" | "suppressesDescendants"> | undefined {
  const tag = element.tagName.toLowerCase();
  const role = element.getAttribute("role")?.toLowerCase();
  const hint = `${element.id} ${element.className}`;
  const composite = COMPOSITE_HINT.test(hint);

  if (/^h[1-6]$/.test(tag)) {
    return { kind: "heading", composite: false, suppressesDescendants: false };
  }
  if (tag === "p" || tag === "blockquote") {
    return { kind: "paragraph", composite: false, suppressesDescendants: false };
  }
  if (isCaptionContainer(element)) {
    const explicit = isExplicitCaptionContainer(element);
    return { kind: "paragraph", composite: explicit, suppressesDescendants: explicit };
  }
  if (tag.includes("-") && isRepeatedSibling(element)) {
    return { kind: "card", composite: true, suppressesDescendants: true };
  }
  if (tag === "span" && element.children.length === 0) {
    return { kind: "paragraph", composite: false, suppressesDescendants: false };
  }
  if (tag === "li" || role === "listitem") {
    return { kind: "list-item", composite: false, suppressesDescendants: false };
  }
  if (tag === "tr" || role === "row") {
    return { kind: "table-row", composite: false, suppressesDescendants: false };
  }
  if (tag === "a") {
    return { kind: "link", composite: false, suppressesDescendants: false };
  }
  if (/comment|review/i.test(hint)) {
    return { kind: "comment", composite: true, suppressesDescendants: true };
  }
  if (composite) {
    return { kind: "card", composite: true, suppressesDescendants: true };
  }
  if (isRepeatedSibling(element)) {
    return { kind: "card", composite: true, suppressesDescendants: false };
  }
  if (tag === "article" || role === "article") {
    return { kind: "article", composite: false, suppressesDescendants: false };
  }
  if (tag === "main" || tag === "section") {
    return { kind: "section", composite: false, suppressesDescendants: false };
  }
  return undefined;
}

function isRepeatedSibling(element: Element): boolean {
  if (!element.parentElement) return false;
  const isCustomElement = element.tagName.includes("-");
  if (element.tagName !== "DIV" && !isCustomElement) return false;
  const signature = classSignature(element);
  if (!signature && !isCustomElement) return false;
  let matches = 0;
  for (const sibling of element.parentElement.children) {
    if (
      sibling.tagName === element.tagName &&
      (isCustomElement || classSignature(sibling) === signature)
    ) {
      matches += 1;
      if (matches >= 2) return true;
    }
  }
  return false;
}

function scoreCandidate(element: Element, kind: ElementKind, text: string): number {
  const base: Record<ElementKind, number> = {
    paragraph: 100,
    heading: 110,
    article: 90,
    comment: 90,
    card: 88,
    "list-item": 82,
    "table-row": 82,
    section: 70,
    link: 50,
    other: 40,
  };
  const inPrimaryContent = element.closest(
    "main,article,[role='main'],[role='article']",
  ) !== null;
  const textBonus = Math.min(10, Math.floor(text.length / 100));
  return base[kind] + (inPrimaryContent ? 25 : 0) + textBonus;
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
  if (candidate.suppressesDescendants) return false;
  return candidates.some((other) => {
    if (other === candidate || !candidate.element.contains(other.element)) {
      return false;
    }
    if (candidate.composite) return true;
    if (other.composite) return false;
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
  return text.length >= minimumLength(kind) && /[\p{L}\p{N}]/u.test(text);
}

function minimumLength(kind: ElementKind): number {
  return kind === "link" || kind === "heading" ? 2 : 8;
}

function truncateDeterministically(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const prefix = text.slice(0, limit);
  const lastWhitespace = prefix.lastIndexOf(" ");
  return (lastWhitespace >= Math.floor(limit * 0.8)
    ? prefix.slice(0, lastWhitespace)
    : prefix
  ).trimEnd();
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
