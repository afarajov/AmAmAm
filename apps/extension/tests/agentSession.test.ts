import { createPageEngine } from "@contextlayer/page-engine";
import type { AgentRequest, AgentResponse } from "@contextlayer/shared";
import { beforeEach, describe, expect, it } from "vitest";

import {
  createAgentSession,
  type AgentGateway
} from "../src/integration/agentSession";

class HighlightFirstElementGateway implements AgentGateway {
  async query(request: AgentRequest): Promise<AgentResponse> {
    const target = request.page.elements[0];
    if (!target) throw new Error("The test page did not produce a semantic element.");

    return {
      requestId: request.requestId,
      pageId: request.page.pageId,
      snapshotVersion: request.page.snapshotVersion,
      message: "Highlighted the matching content.",
      references: [{ elementId: target.id, excerpt: target.text }],
      actions: [{ type: "HIGHLIGHT", targetElementIds: [target.id] }]
    };
  }
}

describe("AgentSession with the semantic page engine", () => {
  beforeEach(() => {
    document.documentElement.innerHTML = `
      <head><title>Integration fixture</title></head>
      <body><p>Privacy controls are available for every account on this page.</p></body>
    `;
  });

  it("executes a correlated agent action against the live DOM", async () => {
    const session = createAgentSession(
      createPageEngine(document),
      new HighlightFirstElementGateway()
    );

    const result = await session.submit("Show me the privacy controls");

    expect(result.response.references).toHaveLength(1);
    expect(result.executionResults[0]).toMatchObject({
      type: "HIGHLIGHT",
      success: true
    });
    expect(document.querySelector("p")?.classList).toContain(
      "contextlayer-engine-highlight"
    );
  });
});
