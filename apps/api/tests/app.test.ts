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
  return createApp({
    config: {
      jsonBodyLimit: "32kb",
      corsAllowedOrigins: ["chrome-extension://contextlayer-test"]
    },
    logger,
    agentService
  });
}

describe("API foundation", () => {
  it("reports service health and omits framework disclosure", async () => {
    const response = await request(appWith(new UnavailableAgentService())).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", service: "contextlayer-api" });
    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("answers an allowed extension CORS preflight", async () => {
    const response = await request(appWith(new UnavailableAgentService()))
      .options("/api/agent/query")
      .set("Origin", "chrome-extension://contextlayer-test")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type,x-request-id");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("chrome-extension://contextlayer-test");
    expect(response.headers["access-control-allow-headers"]).toContain("x-request-id");
  });

  it("rejects a CORS preflight from an unlisted origin", async () => {
    const response = await request(appWith(new UnavailableAgentService()))
      .options("/api/agent/query")
      .set("Origin", "https://untrusted.example")
      .set("Access-Control-Request-Method", "POST");

    expect(response.status).toBe(403);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
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

  it("rejects a request that does not match the runtime contract", async () => {
    const query = vi.fn();
    const response = await request(appWith({ query })).post("/api/agent/query").send({ query: "missing page" });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_REQUEST");
    expect(query).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON with the common error envelope", async () => {
    const response = await request(appWith(new UnavailableAgentService()))
      .post("/api/agent/query")
      .set("content-type", "application/json")
      .send("{");
    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_REQUEST");
    expect(response.body.requestId).toBe(response.headers["x-request-id"]);
  });

  it("rejects oversized request bodies before the service runs", async () => {
    const query = vi.fn();
    const response = await request(appWith({ query }))
      .post("/api/agent/query")
      .send({ ...agentRequest, query: "x".repeat(40_000) });
    expect(response.status).toBe(413);
    expect(response.body.code).toBe("CONTEXT_TOO_LARGE");
    expect(query).not.toHaveBeenCalled();
  });

  it("rejects an invalid service response before sending it to the client", async () => {
    const query = vi.fn(async () => ({
      requestId,
      pageId: "page-test",
      snapshotVersion: 1,
      message: "Unsafe response",
      actions: [{ type: "HIGHLIGHT", targetElementIds: ["node-99999"] }]
    } as AgentResponse));
    const response = await request(appWith({ query })).post("/api/agent/query").send(agentRequest);
    expect(response.status).toBe(502);
    expect(response.body.code).toBe("MODEL_ERROR");
  });
});
