import type { AgentRequest, AgentResponse, ApiError } from "@contextlayer/shared";

export const AGENT_QUERY_MESSAGE = "CONTEXTLAYER_AGENT_QUERY" as const;

export interface AgentQueryMessage {
  type: typeof AGENT_QUERY_MESSAGE;
  payload: AgentRequest;
}

export type AgentQueryMessageResult =
  | { ok: true; payload: AgentResponse }
  | { ok: false; error: ApiError };

export function isAgentQueryMessage(value: unknown): value is AgentQueryMessage {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.type === AGENT_QUERY_MESSAGE && isAgentRequest(candidate.payload);
}

function isAgentRequest(value: unknown): value is AgentRequest {
  if (typeof value !== "object" || value === null) return false;
  const request = value as Record<string, unknown>;
  return (
    typeof request.requestId === "string" &&
    typeof request.query === "string" &&
    typeof request.page === "object" &&
    request.page !== null
  );
}
