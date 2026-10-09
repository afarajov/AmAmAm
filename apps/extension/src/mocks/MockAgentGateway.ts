import type {
  AgentAction,
  AgentReference,
  AgentRequest,
  AgentResponse
} from "@contextlayer/shared";

import {
  AgentGatewayError,
  type AgentGateway
} from "../integration/agentSession";
import { MOCK_STALE_EVENT } from "./MockStalePageEngine";

const MOCK_LATENCY_MS = 650;

export class MockAgentGateway implements AgentGateway {
  private staleSimulationUsed = false;

  async query(request: AgentRequest): Promise<AgentResponse> {
    await new Promise((resolve) => window.setTimeout(resolve, MOCK_LATENCY_MS));

    if (request.query === "Simulate backend timeout") {
      throw new AgentGatewayError("MODEL_TIMEOUT", "The mock backend timed out.");
    }

    if (request.query === "Simulate malformed response") {
      throw new AgentGatewayError(
        "INVALID_RESPONSE",
        "The backend returned a malformed response."
      );
    }

    if (request.query === "Simulate backend error") {
      throw new AgentGatewayError("MODEL_ERROR", "The mock backend failed.");
    }

    if (
      request.query === "Repeat stale snapshot" ||
      (request.query === "Recover from stale snapshot" && !this.staleSimulationUsed)
    ) {
      this.staleSimulationUsed = true;
      window.dispatchEvent(new CustomEvent(MOCK_STALE_EVENT));
    }

    const reference = request.page.elements[0];
    const simulateMissingElement = request.query === "Highlight a missing element";

    if (simulateMissingElement) {
      return {
        requestId: request.requestId,
        pageId: request.page.pageId,
        snapshotVersion: request.page.snapshotVersion,
        message: "Highlighted the matching content.",
        actions: [{ type: "HIGHLIGHT", targetElementIds: ["node-99999"] }],
        limitations: ["Development mock: simulated missing element."]
      };
    }

    if (!reference) {
      return createResponse(request, "No page content matched the request.", [], []);
    }

    const secondReference = request.page.elements[1] ?? reference;
    const references: AgentReference[] = [{
      elementId: reference.id,
      excerpt: reference.text
    }];

    switch (request.query) {
      case "Factual query":
        return createResponse(request, "This is a grounded factual answer.", references, []);
      case "Highlight target":
        return actionResponse(request, references, [{
          type: "HIGHLIGHT",
          targetElementIds: [reference.id]
        }]);
      case "Dim target":
        return actionResponse(request, references, [{
          type: "DIM",
          targetElementIds: [reference.id]
        }]);
      case "Strike target":
        return actionResponse(request, references, [{
          type: "STRIKE",
          targetElementIds: [reference.id]
        }]);
      case "Hide target":
        return actionResponse(request, references, [{
          type: "HIDE",
          targetElementIds: [reference.id]
        }]);
      case "Clear effect target":
        return actionResponse(request, references, [{
          type: "HIGHLIGHT",
          targetElementIds: [reference.id]
        }, {
          type: "CLEAR_EFFECT",
          targetElementIds: [reference.id]
        }]);
      case "Restore all effects":
        return actionResponse(request, references, [{
          type: "HIGHLIGHT",
          targetElementIds: [reference.id]
        }, {
          type: "DIM",
          targetElementIds: [secondReference.id]
        }, {
          type: "RESTORE_ALL"
        }]);
      case "Partial highlight":
        return actionResponse(request, references, [{
          type: "HIGHLIGHT",
          targetElementIds: [reference.id, "node-99999"]
        }]);
    }

    return {
      requestId: request.requestId,
      pageId: request.page.pageId,
      snapshotVersion: request.page.snapshotVersion,
      message: reference
        ? `I found relevant content for “${request.query}”.`
        : `No page content matched “${request.query}”.`,
      references: reference
        ? [{ elementId: reference.id, excerpt: reference.text }]
        : [],
      actions: reference
        ? [{ type: "HIGHLIGHT", targetElementIds: [reference.id] }]
        : [],
      limitations: ["Development mock: no backend request was made."]
    };
  }
}

function createResponse(
  request: AgentRequest,
  message: string,
  references: AgentReference[],
  actions: AgentAction[]
): AgentResponse {
  return {
    requestId: request.requestId,
    pageId: request.page.pageId,
    snapshotVersion: request.page.snapshotVersion,
    message,
    references,
    actions,
    limitations: ["Development mock: no backend request was made."]
  };
}

function actionResponse(
  request: AgentRequest,
  references: AgentReference[],
  actions: AgentAction[]
): AgentResponse {
  return createResponse(
    request,
    "Found the matching page content and prepared the requested action.",
    references,
    actions
  );
}
