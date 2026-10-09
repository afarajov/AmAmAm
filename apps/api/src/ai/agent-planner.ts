import type { AgentActionType, SemanticElement } from "@contextlayer/shared";

export interface AgentPlanAction {
  type: AgentActionType;
  targetElementIds: string[];
  explanation: string;
}

export interface AgentPlan {
  grounding: "SUPPORTED" | "NOT_FOUND" | "NOT_APPLICABLE";
  message: string;
  references: { elementId: string; excerpt: string }[];
  actions: AgentPlanAction[];
  limitations: string[];
}

export interface AgentPlanInput {
  query: string;
  pageTitle: string;
  pageUrl: string;
  candidates: SemanticElement[];
}

export interface AgentPlanner {
  plan(input: AgentPlanInput): Promise<AgentPlan>;
}
