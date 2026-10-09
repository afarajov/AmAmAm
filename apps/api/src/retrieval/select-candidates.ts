import type { SemanticElement } from "@contextlayer/shared";

const MAX_CANDIDATES = 80;
const MAX_CONTEXT_CHARACTERS = 30_000;
const TOKEN_PATTERN = /[\p{L}\p{N}]{2,}/gu;

function tokens(value: string): Set<string> {
  return new Set((value.toLocaleLowerCase().match(TOKEN_PATTERN) ?? []).filter((token) => token.length > 2));
}

export function selectCandidateElements(query: string, elements: SemanticElement[]): SemanticElement[] {
  const queryTokens = tokens(query);
  const ranked = elements
    .filter((element) => element.visible && element.text.trim().length > 0)
    .map((element, index) => {
      const elementTokens = tokens(element.text);
      let score = 0;
      for (const token of queryTokens) if (elementTokens.has(token)) score += 1;
      if (element.kind === "heading") score += 0.25;
      return { element, index, score };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index);

  const selected: SemanticElement[] = [];
  let characters = 0;
  for (const { element } of ranked) {
    if (selected.length >= MAX_CANDIDATES) break;
    const size = element.text.length;
    if (selected.length > 0 && characters + size > MAX_CONTEXT_CHARACTERS) continue;
    selected.push(element);
    characters += size;
  }
  return selected;
}
