import type { AgentRequest, AgentResponse } from "@contextlayer/shared";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import type { Logger } from "../src/logging/logger.js";
import type { AgentService } from "../src/services/agent-service.js";
import { UnavailableAgentService } from "../src/services/agent-service.js";

const logger: Logger = {
  debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()
};

const requestId = "4ccf107d-a4c4-4da6-9d91-505a16c1ae71";
const agentRequest: AgentRequest = {
  requestId,
  query: "What is this page about?",
  page: {
    contractVersion: "1",
    pageId: "page-test",
    snapshotVersion: 1,
    url: "https://example.com/article",
    title: "Example",
    capturedAt: 1,
    elements: []
  }
};

function appWith(agentService: AgentService) {
  return createApp({ config: { jsonBodyLimit: "32kb" }, logger, agentService });
}

describe("API foundation", () => {
  it("reports service health and omits framework disclosure", async () => {
    const response = await request(appWith(new UnavailableAgentService())).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", service: "contextlayer-api" });
    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("forwards an AgentRequest to the injected service", async () => {
    const expected: AgentResponse = {
      requestId,
      pageId: "page-test",
      snapshotVersion: 1,
      message: "Foundation response",
      actions: []
    };
    const query = vi.fn(async () => expected);
    const response = await request(appWith({ query })).post("/api/agent/query").send(agentRequest);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expected);
    expect(query).toHaveBeenCalledWith(agentRequest);
    expect(response.headers["x-request-id"]).toBe(requestId);
  });

  it("fails honestly while the AI pipeline is unavailable", async () => {
    const response = await request(appWith(new UnavailableAgentService()))
      .post("/api/agent/query")
      .send(agentRequest);
    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      code: "MODEL_ERROR",
      message: "The AI pipeline is not configured yet.",
      requestId
    });
  });

  it("returns the common error envelope for unknown routes", async () => {
    const response = await request(appWith(new UnavailableAgentService())).get("/missing");
    expect(response.status).toBe(404);
    expect(response.body.code).toBe("INVALID_REQUEST");
    expect(response.body.requestId).toBe(response.headers["x-request-id"]);
  });
});
