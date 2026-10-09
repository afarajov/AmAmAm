import { createPageEngine } from "@contextlayer/page-engine";
import type { AgentRequest, AgentResponse } from "@contextlayer/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

class MissingElementGateway implements AgentGateway {
  async query(request: AgentRequest): Promise<AgentResponse> {
    return {
      requestId: request.requestId,
      pageId: request.page.pageId,
      snapshotVersion: request.page.snapshotVersion,
      message: "Highlighted the matching content.",
      actions: [{ type: "HIGHLIGHT", targetElementIds: ["node-99999"] }]
    };
  }
}

class PartialHighlightGateway implements AgentGateway {
  async query(request: AgentRequest): Promise<AgentResponse> {
    const target = request.page.elements[0]!;
    return {
      requestId: request.requestId,
      pageId: request.page.pageId,
      snapshotVersion: request.page.snapshotVersion,
      message: "Highlighted all matching content.",
      actions: [{
        type: "HIGHLIGHT",
        targetElementIds: [target.id, "node-99999"]
      }]
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
    const paragraph = document.querySelector("p")!;
    paragraph.scrollIntoView = vi.fn();
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
    expect(result.hasPageModifications).toBe(true);
    expect(paragraph.classList).toContain("contextlayer-engine-highlight");

    const referenceResult = session.scrollToReference(
      result.response.references![0]!.elementId
    );
    expect(referenceResult.executionResults[0]).toMatchObject({
      type: "SCROLL_TO",
      success: true
    });
    expect(paragraph.scrollIntoView).toHaveBeenCalledOnce();
    expect(referenceResult.hasPageModifications).toBe(true);

    const resetResult = session.reset();
    expect(resetResult.executionResults[0]).toMatchObject({
      type: "RESTORE_ALL",
      success: true
    });
    expect(resetResult.hasPageModifications).toBe(false);
    expect(paragraph.classList).not.toContain("contextlayer-engine-highlight");
  });

  it("does not report a failed action as a page modification", async () => {
    const session = createAgentSession(
      createPageEngine(document),
      new MissingElementGateway()
    );

    const result = await session.submit("Highlight a missing element");

    expect(result.executionResults[0]).toMatchObject({
      type: "HIGHLIGHT",
      success: false
    });
    expect(result.executionResults[0]?.failures[0]?.code).toBe("UNKNOWN_ID");
    expect(result.hasPageModifications).toBe(false);
  });

  it("keeps reset available after a partially successful action", async () => {
    const session = createAgentSession(
      createPageEngine(document),
      new PartialHighlightGateway()
    );

    const result = await session.submit("Highlight every match");

    expect(result.executionResults[0]).toMatchObject({
      type: "HIGHLIGHT",
      success: false
    });
    expect(result.executionResults[0]?.affectedElementIds).toHaveLength(1);
    expect(result.hasPageModifications).toBe(true);
    expect(document.querySelector("p")?.classList).toContain(
      "contextlayer-engine-highlight"
    );
  });
});
