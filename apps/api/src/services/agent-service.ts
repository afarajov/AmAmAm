import type { AgentRequest, AgentResponse } from "@contextlayer/shared";
import { HttpError } from "../errors/api-error.js";

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
