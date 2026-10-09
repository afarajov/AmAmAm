import type { AgentRequest, ApiError } from "@contextlayer/shared";

import type { AgentQueryMessageResult } from "../messages/agentMessages";
import { isAgentResponse, isApiError } from "../validation/apiContracts";

const API_BASE_URL = (
  import.meta.env.VITE_CONTEXTLAYER_API_BASE_URL || "http://127.0.0.1:8787"
).replace(/\/$/, "");
const REQUEST_TIMEOUT_MS = 20_000;

function errorResult(code: ApiError["code"], message: string, requestId?: string): AgentQueryMessageResult {
  return {
    ok: false,
    error: { code, message, ...(requestId ? { requestId } : {}) }
  };
}

export async function queryAgentApi(request: AgentRequest): Promise<AgentQueryMessageResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}/api/agent/query`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": request.requestId
      },
      body: JSON.stringify(request),
      signal: controller.signal
    });

    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      return isApiError(body)
        ? { ok: false, error: body }
        : errorResult("INTERNAL_ERROR", `The backend returned HTTP ${response.status}.`, request.requestId);
    }

    return isAgentResponse(body)
      ? { ok: true, payload: body }
      : errorResult("MODEL_ERROR", "The backend returned an invalid agent response.", request.requestId);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return errorResult("MODEL_TIMEOUT", "The agent request timed out.", request.requestId);
    }
    return errorResult("INTERNAL_ERROR", "The AI backend is unavailable.", request.requestId);
  } finally {
    clearTimeout(timeoutId);
  }
}
