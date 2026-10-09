import type { AgentRequest } from "@contextlayer/shared";

import {
  AgentGatewayError,
  type AgentGateway
} from "../integration/agentSession";
import {
  AGENT_QUERY_MESSAGE,
  type AgentQueryMessage,
  type AgentQueryMessageResult
} from "../messages/agentMessages";
import { isAgentResponse, isApiError } from "../validation/apiContracts";

function isMessageResult(value: unknown): value is AgentQueryMessageResult {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Record<string, unknown>;
  if (result.ok === true) return isAgentResponse(result.payload);
  if (result.ok === false) return isApiError(result.error);
  return false;
}

export class ChromeAgentGateway implements AgentGateway {
  async query(request: AgentRequest) {
    const message: AgentQueryMessage = {
      type: AGENT_QUERY_MESSAGE,
      payload: request
    };
    const result: unknown = await chrome.runtime.sendMessage(message);

    if (!isMessageResult(result)) {
      throw new AgentGatewayError(
        "INVALID_RESPONSE",
        "The extension background returned an invalid response."
      );
    }
    if (!result.ok) throw new AgentGatewayError(result.error.code, result.error.message);
    return result.payload;
  }
}
