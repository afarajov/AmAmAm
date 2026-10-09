import type { AgentRequest } from "@contextlayer/shared";
import { HttpError } from "../errors/api-error.js";
import { agentRequestSchema } from "./schemas.js";

export interface AgentRequestLimits {
  maxSnapshotElements: number;
  maxSnapshotTextCharacters: number;
}

const DEFAULT_LIMITS: AgentRequestLimits = {
  maxSnapshotElements: 300,
  maxSnapshotTextCharacters: 120_000
};

export function validateAgentRequest(
  input: unknown,
  limits: AgentRequestLimits = DEFAULT_LIMITS
): AgentRequest {
  const result = agentRequestSchema.safeParse(input);
  if (result.success) {
    if (result.data.page.elements.length > limits.maxSnapshotElements) {
      throw contextTooLarge("The page snapshot contains too many semantic elements.");
    }
    const textCharacters = result.data.page.elements.reduce(
      (total, element) => total + element.text.length,
      0
    );
    if (textCharacters > limits.maxSnapshotTextCharacters) {
      throw contextTooLarge("The page snapshot contains too much text.");
    }
    return result.data;
  }

  const firstIssue = result.error.issues[0];
  const location = firstIssue?.path.length ? firstIssue.path.join(".") : "request";
  const detail = firstIssue ? `${location}: ${firstIssue.message}` : "Invalid request body.";
  throw new HttpError(400, "INVALID_REQUEST", detail);
}

function contextTooLarge(message: string): HttpError {
  return new HttpError(413, "CONTEXT_TOO_LARGE", message);
}
