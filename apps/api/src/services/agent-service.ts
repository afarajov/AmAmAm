import type { AgentRequest, AgentResponse } from "@contextlayer/shared";
import { HttpError } from "../errors/api-error.js";
import { selectCandidateElements } from "../retrieval/select-candidates.js";
import type { AgentPlan, AgentPlanner } from "../ai/agent-planner.js";
import { validateGroundedPlan } from "../validation/grounding.js";

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
    const rawPlan: AgentPlan = await this.planner.plan({
      query: request.query,
      pageTitle: request.page.title,
      pageUrl: request.page.url,
      candidates
    });
    const plan = validateGroundedPlan(rawPlan, candidates);

    return {
      requestId: request.requestId,
      pageId: request.page.pageId,
      snapshotVersion: request.page.snapshotVersion,
      message: responseMessage(request.query, plan),
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

function responseMessage(query: string, plan: AgentPlan): string {
  if (plan.grounding === "NOT_FOUND") return notFoundMessage(query);
  if (plan.actions.length > 0) return proposedActionMessage(query);
  return plan.message;
}

function languageOf(query: string): "ru" | "az" | "en" {
  if (/[а-яё]/iu.test(query)) return "ru";
  if (/[əğıöşüç]/iu.test(query)) return "az";
  return "en";
}

function notFoundMessage(query: string): string {
  const language = languageOf(query);
  if (language === "ru") return "Я не нашёл эту информацию на текущей странице.";
  if (language === "az") return "Bu məlumatı cari səhifədə tapa bilmədim.";
  return "I couldn't find this information on the current page.";
}

function proposedActionMessage(query: string): string {
  const language = languageOf(query);
  if (language === "ru") return "Я нашёл подтверждающие фрагменты и подготовил действие для браузера.";
  if (language === "az") return "Təsdiqləyici hissələri tapdım və brauzer üçün əməliyyat hazırladım.";
  return "I found supporting page content and prepared the requested browser action.";
}
