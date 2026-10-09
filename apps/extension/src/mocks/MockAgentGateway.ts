import type { AgentRequest, AgentResponse } from "@contextlayer/shared";

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

    if (request.query === "Recover from stale snapshot" && !this.staleSimulationUsed) {
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
