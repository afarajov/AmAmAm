import type { AgentRequest, AgentResponse } from "@contextlayer/shared";
import { HttpError } from "../errors/api-error.js";
import type { SemanticElement } from "@contextlayer/shared";
import { selectCandidateElements } from "../retrieval/select-candidates.js";
import type { AgentPlan, AgentPlanner } from "../ai/agent-planner.js";
import { validateGroundedPlan } from "../validation/grounding.js";

/** Boundary implemented by the AI pipeline in later stages. */
export interface AgentService {
  query(request: AgentRequest): Promise<AgentResponse>;
}

export type CandidateSelector = (
  query: string,
  elements: SemanticElement[]
) => Promise<SemanticElement[]>;

const lexicalCandidateSelector: CandidateSelector = async (query, elements) =>
  selectCandidateElements(query, elements);
const MAX_GROUNDED_PLAN_ATTEMPTS = 2;

/** Production-safe default: never pretends that AI reasoning happened. */
export class UnavailableAgentService implements AgentService {
  async query(_request: AgentRequest): Promise<AgentResponse> {
    throw new HttpError(503, "MODEL_ERROR", "The AI pipeline is not configured yet.");
  }
}

export class PlanningAgentService implements AgentService {
  constructor(
    private readonly planner: AgentPlanner,
    private readonly candidateSelector: CandidateSelector = lexicalCandidateSelector
  ) {}

  async query(request: AgentRequest): Promise<AgentResponse> {
    const candidates = await this.candidateSelector(request.query, request.page.elements);
    const planInput = {
      query: request.query,
      pageTitle: request.page.title,
      pageUrl: request.page.url,
      candidates
    };
    let plan: AgentPlan | undefined;
    let validationError: unknown;
    for (let attempt = 0; attempt < MAX_GROUNDED_PLAN_ATTEMPTS; attempt += 1) {
      const rawPlan = await this.planner.plan(planInput);
      try {
        plan = validateGroundedPlan(rawPlan, candidates);
        break;
      } catch (error) {
        validationError = error;
        if (!(error instanceof HttpError) || error.code !== "MODEL_ERROR") throw error;
      }
    }
    if (plan === undefined) throw validationError;

    return {
      requestId: request.requestId,
      pageId: request.page.pageId,
      snapshotVersion: request.page.snapshotVersion,
      message: responseMessage(request.query, plan),
      references: plan.references.map(({ elementId, excerpt }) => ({
        elementId,
        // Grounding is already verified, so a prefix remains an exact quote
        // while keeping the public response inside its contract limit.
        excerpt: excerpt.slice(0, 500)
      })),
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
