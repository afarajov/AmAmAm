import type { AgentRequest, AgentResponse } from "@contextlayer/shared";
import { HttpError } from "../errors/api-error.js";
import { selectCandidateElements } from "../retrieval/select-candidates.js";
import type { AgentPlan, AgentPlanner } from "../ai/agent-planner.js";

/** Boundary implemented by the AI pipeline in later stages. */
export interface AgentService {
  query(request: AgentRequest): Promise<AgentResponse>;
}

/** Production-safe default: never pretends that AI reasoning happened. */
export class UnavailableAgentService implements AgentService {
  async query(_request: AgentRequest): Promise<AgentResponse> {
    throw new HttpError(503, "MODEL_ERROR", "The AI pipeline is not configured yet.");
  }
}

export class PlanningAgentService implements AgentService {
  constructor(private readonly planner: AgentPlanner) {}

  async query(request: AgentRequest): Promise<AgentResponse> {
    const candidates = selectCandidateElements(request.query, request.page.elements);
    const plan: AgentPlan = await this.planner.plan({
      query: request.query,
      pageTitle: request.page.title,
      pageUrl: request.page.url,
      candidates
    });

    return {
      requestId: request.requestId,
      pageId: request.page.pageId,
      snapshotVersion: request.page.snapshotVersion,
      message: plan.message,
      references: plan.references.map(({ elementId, excerpt }) => ({ elementId, excerpt })),
      actions: plan.actions.map((action) => action.type === "RESTORE_ALL"
        ? { type: "RESTORE_ALL", explanation: action.explanation }
        : {
            type: action.type,
            targetElementIds: action.targetElementIds,
            explanation: action.explanation
          }),
      limitations: plan.limitations
    };
  }
}
