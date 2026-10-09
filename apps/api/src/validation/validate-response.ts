import type { AgentRequest, AgentResponse } from "@contextlayer/shared";
import { HttpError } from "../errors/api-error.js";
import { agentResponseSchema } from "./schemas.js";
import { excerptIsGrounded } from "./grounding.js";

const invalidModelResponse = () =>
  new HttpError(502, "MODEL_ERROR", "The AI pipeline returned an invalid response.");

export function validateAgentResponse(input: unknown, request: AgentRequest): AgentResponse {
  const result = agentResponseSchema.safeParse(input);
  if (!result.success) throw invalidModelResponse();

  const response = result.data;
  if (
    response.requestId !== request.requestId ||
    response.pageId !== request.page.pageId ||
    response.snapshotVersion !== request.page.snapshotVersion
  ) {
    throw invalidModelResponse();
  }

  const knownElements = new Map(request.page.elements.map((element) => [element.id, element]));
  for (const reference of response.references ?? []) {
    const element = knownElements.get(reference.elementId);
    if (!element || reference.excerpt === undefined || !excerptIsGrounded(reference.excerpt, element.text)) {
      throw invalidModelResponse();
    }
  }
  for (const action of response.actions) {
    if (action.type === "RESTORE_ALL") continue;
    if (action.targetElementIds.some((elementId) => !knownElements.has(elementId))) {
      throw invalidModelResponse();
    }
  }

  return response;
}
