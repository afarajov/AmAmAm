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
  for (const reference of plan.references) {
    const element = elements.get(reference.elementId);
    if (!element || !excerptIsGrounded(reference.excerpt, element.text)) throw invalidGrounding();
    referencedIds.add(reference.elementId);
  }

  for (const action of plan.actions) {
    if (action.type === "RESTORE_ALL") throw invalidGrounding();
    if (action.targetElementIds.length === 0) throw invalidGrounding();
    if (action.targetElementIds.some((id) => !referencedIds.has(id))) throw invalidGrounding();
  }

  return plan;
}
