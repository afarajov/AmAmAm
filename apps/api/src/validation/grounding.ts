import type { SemanticElement } from "@contextlayer/shared";
import type { AgentPlan } from "../ai/agent-planner.js";
import { HttpError } from "../errors/api-error.js";

const invalidGrounding = () =>
  new HttpError(502, "MODEL_ERROR", "The AI pipeline returned an ungrounded response.");

export function normalizeEvidence(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLocaleLowerCase();
}

export function excerptIsGrounded(excerpt: string, elementText: string): boolean {
  const normalizedExcerpt = normalizeEvidence(excerpt);
  return normalizedExcerpt.length > 0 && normalizeEvidence(elementText).includes(normalizedExcerpt);
}

function exactExcerpt(excerpt: string, elementText: string): string | undefined {
  if (excerptIsGrounded(excerpt, elementText)) return excerpt;

  // Models sometimes append an ellipsis while honoring a maximum length.
  // Removing only a terminal ellipsis is safe when the remaining quote is
  // still a literal substring; all other altered evidence remains invalid.
  const withoutEllipsis = excerpt.replace(/(?:\.{3}|…)[\s]*$/u, "").trimEnd();
  if (withoutEllipsis !== excerpt && excerptIsGrounded(withoutEllipsis, elementText)) {
    return withoutEllipsis;
  }
  return undefined;
}

export function validateGroundedPlan(plan: AgentPlan, candidates: readonly SemanticElement[]): AgentPlan {
  const elements = new Map(candidates.map((element) => [element.id, element]));

  if (plan.grounding === "NOT_FOUND") {
    if (plan.references.length !== 0 || plan.actions.length !== 0) throw invalidGrounding();
    return plan;
  }

  if (plan.grounding === "NOT_APPLICABLE") {
    if (
      plan.references.length !== 0 ||
      plan.actions.length === 0 ||
      plan.actions.some((action) => action.type !== "RESTORE_ALL")
    ) {
      throw invalidGrounding();
    }
    return plan;
  }

  if (plan.references.length === 0) throw invalidGrounding();

  const referencedIds = new Set<string>();
  const references = plan.references.map((reference) => {
    const element = elements.get(reference.elementId);
    if (!element) throw invalidGrounding();
    const excerpt = exactExcerpt(reference.excerpt, element.text);
    if (excerpt === undefined) throw invalidGrounding();
    referencedIds.add(reference.elementId);
    return { ...reference, excerpt };
  });

  for (const action of plan.actions) {
    if (action.type === "RESTORE_ALL") throw invalidGrounding();
    if (action.targetElementIds.length === 0) throw invalidGrounding();
    if (action.targetElementIds.some((id) => !referencedIds.has(id))) throw invalidGrounding();
  }

  return { ...plan, references };
}
