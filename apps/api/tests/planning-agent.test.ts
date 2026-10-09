import type { AgentRequest } from "@contextlayer/shared";
import { describe, expect, it, vi } from "vitest";
import type { AgentPlanner } from "../src/ai/agent-planner.js";
import { PlanningAgentService } from "../src/services/agent-service.js";

const request: AgentRequest = {
  requestId: "4ccf107d-a4c4-4da6-9d91-505a16c1ae71",
  query: "Highlight privacy",
  page: {
    contractVersion: "1",
    pageId: "page-test",
    snapshotVersion: 2,
    url: "https://example.com",
    title: "Example",
    capturedAt: 1,
    elements: [
      { id: "node-00001", kind: "paragraph", text: "General introduction", tagName: "P", visible: true },
      { id: "node-00002", kind: "paragraph", text: "Privacy risks are described here", tagName: "P", visible: true }
    ]
  }
};

describe("PlanningAgentService", () => {
  it("grounds the planner input and correlates the response", async () => {
    const plan = vi.fn<AgentPlanner["plan"]>(async () => ({
      message: "I found the privacy paragraph.",
      references: [{ elementId: "node-00002", excerpt: "Privacy risks" }],
      actions: [{ type: "HIGHLIGHT", targetElementIds: ["node-00002"], explanation: "Requested" }],
      limitations: []
    }));
    const response = await new PlanningAgentService({ plan }).query(request);

    expect(plan).toHaveBeenCalledOnce();
    expect(plan.mock.calls[0]?.[0].candidates[0]?.id).toBe("node-00002");
    expect(response).toMatchObject({
      requestId: request.requestId,
      pageId: request.page.pageId,
      snapshotVersion: 2,
      actions: [{ type: "HIGHLIGHT", targetElementIds: ["node-00002"] }]
    });
  });

  it("normalizes RESTORE_ALL without target IDs", async () => {
    const planner: AgentPlanner = { plan: async () => ({
      message: "Reset requested.", references: [], limitations: [],
      actions: [{ type: "RESTORE_ALL", targetElementIds: [], explanation: "Reset" }]
    }) };
    const response = await new PlanningAgentService(planner).query(request);
    expect(response.actions).toEqual([{ type: "RESTORE_ALL", explanation: "Reset" }]);
  });
});
