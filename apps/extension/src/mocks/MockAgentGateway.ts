import type { AgentRequest, AgentResponse } from "@contextlayer/shared";

import type { AgentGateway } from "../integration/agentSession";

const MOCK_LATENCY_MS = 650;

export class MockAgentGateway implements AgentGateway {
  async query(request: AgentRequest): Promise<AgentResponse> {
    await new Promise((resolve) => window.setTimeout(resolve, MOCK_LATENCY_MS));

    return {
      requestId: request.requestId,
      pageId: request.page.pageId,
      snapshotVersion: request.page.snapshotVersion,
      message: `Mock response received for “${request.query}”. Real AI processing is not connected yet.`,
      actions: [],
      limitations: ["Development mock: no backend request was made."]
    };
  }
}
