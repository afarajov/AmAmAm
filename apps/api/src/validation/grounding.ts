import type { SemanticElement } from "@contextlayer/shared";
import type { AgentPlan } from "../ai/agent-planner.js";
import { HttpError } from "../errors/api-error.js";

const invalidGrounding = () =>
  new HttpError(502, "MODEL_ERROR", "The AI pipeline returned an ungrounded response.");
const MAX_GROUNDED_REFERENCES = 5;

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
      plan.actions.length !== 1 ||
      plan.actions[0]?.type !== "RESTORE_ALL" ||
      plan.actions[0].targetElementIds.length !== 0
    ) {
      throw invalidGrounding();
    }
    return plan;
  }

  if (plan.references.length === 0) throw invalidGrounding();

  plan = expandHideTargetsToContainers(plan, elements);

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

  return compactSupportedPlan({ ...plan, references }, elements);
}

function expandHideTargetsToContainers(
  plan: AgentPlan,
  elements: Map<string, SemanticElement>
): AgentPlan {
  const replacements = new Map<string, string>();
  const actions = plan.actions.map((action) => {
    if (action.type !== "HIDE") return action;
    const targetElementIds = [...new Set(action.targetElementIds.map((id) => {
      const containerId = nearestHideContainer(id, elements);
      if (containerId !== id) replacements.set(id, containerId);
      return containerId;
    }))];
    return { ...action, targetElementIds };
  });
  if (replacements.size === 0) return plan;

  const stillTargeted = new Set(actions.flatMap((action) =>
    action.type === "RESTORE_ALL" ? [] : action.targetElementIds
  ));
  const references = plan.references.filter((reference) =>
    !replacements.has(reference.elementId) || stillTargeted.has(reference.elementId)
  );
  for (const containerId of new Set(replacements.values())) {
    const element = elements.get(containerId)!;
    references.push({ elementId: containerId, excerpt: element.text.slice(0, 500) });
  }
  return { ...plan, references, actions };
}

function nearestHideContainer(
  id: string,
  elements: Map<string, SemanticElement>
): string {
  let element = elements.get(id);
  const visited = new Set<string>();
  while (element?.parentId && !visited.has(element.parentId)) {
    visited.add(element.parentId);
    const parent = elements.get(element.parentId);
    if (!parent) break;
    if (["card", "article", "list-item"].includes(parent.kind)) return parent.id;
    element = parent;
  }
  return id;
}

function compactSupportedPlan(plan: AgentPlan, elements: Map<string, SemanticElement>): AgentPlan {
  const targetedIds = new Set(
    plan.actions.flatMap((action) => action.type === "RESTORE_ALL" ? [] : action.targetElementIds)
  );
  const prioritized = [
    ...plan.references.filter((reference) => targetedIds.has(reference.elementId)),
    ...plan.references.filter((reference) => !targetedIds.has(reference.elementId))
  ];
  const kept: AgentPlan["references"] = [];
  const aliases = new Map<string, string>();

  for (const reference of prioritized) {
    if (aliases.has(reference.elementId)) continue;
    const element = elements.get(reference.elementId)!;
    const redundantIndex = kept.findIndex((candidate) =>
      referencesOverlap(element, elements.get(candidate.elementId)!)
    );

    if (redundantIndex === -1) {
      if (kept.length < MAX_GROUNDED_REFERENCES) {
        kept.push(reference);
        aliases.set(reference.elementId, reference.elementId);
      }
      continue;
    }

    const existing = kept[redundantIndex]!;
    const existingElement = elements.get(existing.elementId)!;
    if (isMoreSpecific(element, existingElement)) {
      kept[redundantIndex] = reference;
      for (const [source, target] of aliases) {
        if (target === existing.elementId) aliases.set(source, reference.elementId);
      }
      aliases.set(existing.elementId, reference.elementId);
      aliases.set(reference.elementId, reference.elementId);
    } else {
      aliases.set(reference.elementId, existing.elementId);
    }
  }

  const keptIds = new Set(kept.map((reference) => reference.elementId));
  const normalizedActions = plan.actions.flatMap((action) => {
    if (action.type === "RESTORE_ALL") return [action];
    const targetElementIds = [...new Set(action.targetElementIds
      .map((id) => aliases.get(id))
      .filter((id): id is string => id !== undefined && keptIds.has(id)))];
    return targetElementIds.length > 0 ? [{ ...action, targetElementIds }] : [];
  });

  const actions: AgentPlan["actions"] = [];
  for (const action of normalizedActions) {
    const existing = actions.find((candidate) => candidate.type === action.type);
    if (!existing || action.type === "RESTORE_ALL") {
      actions.push(action);
      continue;
    }
    existing.targetElementIds = [...new Set([
      ...existing.targetElementIds,
      ...action.targetElementIds
    ])].slice(0, MAX_GROUNDED_REFERENCES);
  }

  return { ...plan, references: kept, actions };
}

function referencesOverlap(left: SemanticElement, right: SemanticElement): boolean {
  if (left.id === right.id || left.parentId === right.id || right.parentId === left.id) return true;
  const leftText = normalizeEvidence(left.text);
  const rightText = normalizeEvidence(right.text);
  if (leftText === rightText) return true;
  if (Math.min(leftText.length, rightText.length) < 32) return false;
  return leftText.includes(rightText) || rightText.includes(leftText);
}

function isMoreSpecific(candidate: SemanticElement, existing: SemanticElement): boolean {
  if (candidate.parentId === existing.id) return true;
  if (existing.parentId === candidate.id) return false;
  return normalizeEvidence(candidate.text).length < normalizeEvidence(existing.text).length;
}
