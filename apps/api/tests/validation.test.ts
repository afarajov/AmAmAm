import type { AgentRequest, AgentResponse } from "@contextlayer/shared";
import { describe, expect, it } from "vitest";
import { HttpError } from "../src/errors/api-error.js";
import { agentActionSchema, actionExecutionResultSchema, apiErrorSchema } from "../src/validation/schemas.js";
import { validateAgentRequest } from "../src/validation/validate-request.js";
import { validateAgentResponse } from "../src/validation/validate-response.js";
import { validateGroundedPlan } from "../src/validation/grounding.js";

const request: AgentRequest = {
  requestId: "4ccf107d-a4c4-4da6-9d91-505a16c1ae71",
  query: "Highlight the privacy paragraph.",
  page: {
    contractVersion: "1",
    pageId: "page-validation",
    snapshotVersion: 2,
    url: "https://example.com/article",
    title: "Example",
    capturedAt: 1,
    elements: [{
      id: "node-00001",
      kind: "paragraph",
      text: "Privacy is an important limitation of the system.",
      tagName: "p",
      visible: true
    }]
  }
};

const response: AgentResponse = {
  requestId: request.requestId,
  pageId: request.page.pageId,
  snapshotVersion: request.page.snapshotVersion,
  message: "I found the privacy paragraph.",
  references: [{ elementId: "node-00001", excerpt: "Privacy is an important limitation" }],
  actions: [{ type: "HIGHLIGHT", targetElementIds: ["node-00001"] }]
};

describe("runtime contracts", () => {
  it("accepts a complete AgentRequest", () => {
    expect(validateAgentRequest(request)).toEqual(request);
  });

  it("rejects unknown fields and malformed node IDs", () => {
    expect(() => validateAgentRequest({ ...request, extra: true })).toThrow(HttpError);
    expect(() => validateAgentRequest({
      ...request,
      page: { ...request.page, elements: [{ ...request.page.elements[0], id: "element-1" }] }
    })).toThrow(HttpError);
  });

  it("accepts a correlated response containing only known IDs", () => {
    expect(validateAgentResponse(response, request)).toEqual(response);
  });

  it("rejects response correlation mismatches", () => {
    expect(() => validateAgentResponse({ ...response, snapshotVersion: 3 }, request)).toThrow(HttpError);
    expect(() => validateAgentResponse({ ...response, requestId: "b65fa4c9-ebf3-4f1a-9bf8-30cf90390f68" }, request)).toThrow(HttpError);
  });

  it("rejects invented references and action targets", () => {
    expect(() => validateAgentResponse({
      ...response,
      references: [{ elementId: "node-99999" }]
    }, request)).toThrow(HttpError);
    expect(() => validateAgentResponse({
      ...response,
      actions: [{ type: "HIGHLIGHT", targetElementIds: ["node-99999"] }]
    }, request)).toThrow(HttpError);
  });

  it("rejects a reference whose excerpt is not present in the element text", () => {
    expect(() => validateAgentResponse({
      ...response,
      references: [{ elementId: "node-00001", excerpt: "A fabricated supporting quote" }]
    }, request)).toThrowError(expect.objectContaining({
      status: 502,
      code: "MODEL_ERROR"
    }));
  });

  it("repairs only a terminal ellipsis on an otherwise exact quote", () => {
    const plan = validateGroundedPlan({
      grounding: "SUPPORTED",
      message: "Found it.",
      references: [{
        elementId: "node-00001",
        excerpt: "Privacy is an important limitation..."
      }],
      actions: [],
      limitations: []
    }, request.page.elements);

    expect(plan.references[0]?.excerpt).toBe("Privacy is an important limitation");
  });

  it("enforces the discriminated action contract", () => {
    expect(agentActionSchema.safeParse({ type: "RESTORE_ALL" }).success).toBe(true);
    expect(agentActionSchema.safeParse({ type: "RESTORE_ALL", targetElementIds: ["node-00001"] }).success).toBe(false);
    expect(agentActionSchema.safeParse({ type: "HIGHLIGHT", targetElementIds: [] }).success).toBe(false);
    expect(agentActionSchema.safeParse({ type: "EVAL", targetElementIds: ["node-00001"] }).success).toBe(false);
  });

  it("validates the executor and API error boundary schemas", () => {
    expect(actionExecutionResultSchema.safeParse({
      type: "HIGHLIGHT",
      success: true,
      affectedElementIds: ["node-00001"],
      failures: []
    }).success).toBe(true);
    expect(apiErrorSchema.safeParse({ code: "INVALID_REQUEST", message: "Invalid", requestId: request.requestId }).success).toBe(true);
  });
});
