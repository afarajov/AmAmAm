import type { AgentRequest, AgentResponse } from "@contextlayer/shared";
import { HttpError } from "../errors/api-error.js";
import { agentResponseSchema } from "./schemas.js";

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

  const knownIds = new Set(request.page.elements.map((element) => element.id));
  if (response.references?.some((reference) => !knownIds.has(reference.elementId))) {
    throw invalidModelResponse();
  }
  for (const action of response.actions) {
    if (action.type === "RESTORE_ALL") continue;
    if (action.targetElementIds.some((elementId) => !knownIds.has(elementId))) {
      throw invalidModelResponse();
    }
  }

  return response;
}
