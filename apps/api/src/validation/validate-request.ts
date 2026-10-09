import type { AgentRequest } from "@contextlayer/shared";
import { HttpError } from "../errors/api-error.js";
import { agentRequestSchema } from "./schemas.js";

export function validateAgentRequest(input: unknown): AgentRequest {
  const result = agentRequestSchema.safeParse(input);
  if (result.success) return result.data;

  const firstIssue = result.error.issues[0];
  const location = firstIssue?.path.length ? firstIssue.path.join(".") : "request";
  const detail = firstIssue ? `${location}: ${firstIssue.message}` : "Invalid request body.";
  throw new HttpError(400, "INVALID_REQUEST", detail);
}
