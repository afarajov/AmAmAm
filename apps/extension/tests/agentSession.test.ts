import { createPageEngine } from "@contextlayer/page-engine";
import type {
  ActionExecutionResult,
  AgentRequest,
  AgentResponse,
  ExecuteActionsRequest,
  PageEngine,
  PageSnapshot
} from "@contextlayer/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAgentSession,
  type AgentGateway
} from "../src/integration/agentSession";

class HighlightFirstElementGateway implements AgentGateway {
  readonly snapshotVersions: number[] = [];

  async query(request: AgentRequest): Promise<AgentResponse> {
    this.snapshotVersions.push(request.page.snapshotVersion);
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

class StaleOncePageEngine implements PageEngine {
  scanCount = 0;
  private stale = true;

  constructor(
    private readonly delegate: PageEngine,
    private readonly document: Document
  ) {}

  scan(): PageSnapshot {
    this.scanCount += 1;
    return this.delegate.scan();
  }

  executeActions(request: ExecuteActionsRequest): ActionExecutionResult[] {
    if (this.stale) {
      this.stale = false;
      const paragraph = this.document.querySelector("p");
      if (paragraph) paragraph.textContent = `${paragraph.textContent} Updated.`;
      return request.actions.map((action) => ({
        type: action.type,
        success: false,
        affectedElementIds: [],
        failures: [{
          code: "STALE_SNAPSHOT",
          message: "The page changed before execution."
        }]
      }));
    }
    return this.delegate.executeActions(request);
  }
}

class ScanCountingPageEngine implements PageEngine {
  scanCount = 0;

  constructor(private readonly delegate: PageEngine) {}

  scan(): PageSnapshot {
    this.scanCount += 1;
    return this.delegate.scan();
  }

  executeActions(request: ExecuteActionsRequest): ActionExecutionResult[] {
    return this.delegate.executeActions(request);
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

    const referenceResult = await session.scrollToReference(
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

  it("scans for every request while preserving an unchanged snapshot version", async () => {
    const gateway = new HighlightFirstElementGateway();
    const pageEngine = new ScanCountingPageEngine(createPageEngine(document));
    const session = createAgentSession(pageEngine, gateway);

    await session.submit("First question");
    await session.submit("Second question");

    expect(pageEngine.scanCount).toBe(2);
    expect(gateway.snapshotVersions).toEqual([1, 1]);
  });

  it("rescans and retries once after a stale snapshot", async () => {
    const pageEngine = new StaleOncePageEngine(createPageEngine(document), document);
    const gateway = new HighlightFirstElementGateway();
    const session = createAgentSession(pageEngine, gateway);

    const result = await session.submit("Recover the action");

    expect(pageEngine.scanCount).toBe(2);
    expect(gateway.snapshotVersions).toEqual([1, 2]);
    expect(result.recoveredFromStale).toBe(true);
    expect(result.executionResults[0]).toMatchObject({
      type: "HIGHLIGHT",
      success: true
    });
  });

  it("rescans a dynamic page before navigating to an existing reference", async () => {
    const paragraph = document.querySelector("p")!;
    paragraph.scrollIntoView = vi.fn();
    const pageEngine = createPageEngine(document);
    const session = createAgentSession(pageEngine, new HighlightFirstElementGateway());
    const turn = await session.submit("Find the privacy controls");

    const liveRegion = document.createElement("span");
    liveRegion.textContent = "A live notification unrelated to the referenced paragraph.";
    document.body.append(liveRegion);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const result = await session.scrollToReference(
      turn.response.references![0]!.elementId
    );

    expect(result.executionResults).toHaveLength(1);
    expect(result.executionResults[0]).toMatchObject({
      type: "SCROLL_TO",
      success: true
    });
    expect(paragraph.scrollIntoView).toHaveBeenCalledOnce();
  });
});
