import type { SemanticElement } from "@contextlayer/shared";

const MAX_CANDIDATES = 80;
const MAX_CONTEXT_CHARACTERS = 30_000;
const MAX_EMBEDDING_TEXT_CHARACTERS = 1_000;
const TOKEN_PATTERN = /[\p{L}\p{N}]{2,}/gu;

export interface EmbeddingProvider {
  embed(inputs: string[]): Promise<number[][]>;
}

interface RankedElement {
  element: SemanticElement;
  index: number;
  score: number;
}

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

  return selectWithinBudget(ranked);
}

export async function selectSemanticCandidateElements(
  query: string,
  elements: SemanticElement[],
  provider: EmbeddingProvider
): Promise<SemanticElement[]> {
  const eligible = elements.filter((element) => element.visible && element.text.trim().length > 0);
  if (eligible.length === 0) return [];

  const inputs = [
    query,
    ...eligible.map((element) => `${element.kind}: ${element.text.slice(0, MAX_EMBEDDING_TEXT_CHARACTERS)}`)
  ];
  const vectors = await provider.embed(inputs);
  if (vectors.length !== inputs.length || vectors.some((vector) => vector.length === 0)) {
    throw new Error("Embedding provider returned an invalid vector set.");
  }

  const queryVector = vectors[0]!;
  const queryTokens = tokens(query);
  const ranked: RankedElement[] = eligible.map((element, index) => {
    const elementTokens = tokens(element.text);
    let lexicalMatches = 0;
    for (const token of queryTokens) if (elementTokens.has(token)) lexicalMatches += 1;
    return {
      element,
      index,
      score: cosineSimilarity(queryVector, vectors[index + 1]!)
        + Math.min(lexicalMatches, 5) * 0.02
        + (element.kind === "heading" ? 0.005 : 0)
    };
  }).sort((left, right) => right.score - left.score || left.index - right.index);

  return selectWithinBudget(ranked);
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length !== right.length) throw new Error("Embedding vectors must have equal dimensions.");
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index]!;
    const rightValue = right[index]!;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }
  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function selectWithinBudget(ranked: RankedElement[]): SemanticElement[] {
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
