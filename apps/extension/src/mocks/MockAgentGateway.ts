import type { AgentRequest, AgentResponse } from "@contextlayer/shared";

import type { AgentGateway } from "../integration/agentSession";

const MOCK_LATENCY_MS = 650;

export class MockAgentGateway implements AgentGateway {
  async query(request: AgentRequest): Promise<AgentResponse> {
    await new Promise((resolve) => window.setTimeout(resolve, MOCK_LATENCY_MS));
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
