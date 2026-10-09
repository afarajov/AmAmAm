import type { ActionExecutionResult, AgentActionType } from "@contextlayer/shared";
import { describe, expect, it } from "vitest";

import { presentActionResult } from "../src/ui/actionPresentation";

const actionTypes: AgentActionType[] = [
  "SCROLL_TO",
  "HIGHLIGHT",
  "DIM",
  "STRIKE",
  "HIDE",
  "CLEAR_EFFECT",
  "RESTORE_ALL"
];

describe("action result presentation", () => {
  it.each(actionTypes)("presents a successful %s result", (type) => {
    const result: ActionExecutionResult = {
      type,
      success: true,
      affectedElementIds: ["node-00001"],
      failures: []
    };

    const presentation = presentActionResult(result);

    expect(presentation.tone).toBe("success");
    expect(presentation.summary).toContain("1 element");
    expect(JSON.stringify(presentation)).not.toContain("node-00001");
  });

  it("reports partial completion with safe failure text", () => {
    const presentation = presentActionResult({
      type: "HIGHLIGHT",
      success: false,
      affectedElementIds: ["node-00001", "node-00002"],
      failures: [{
        code: "UNKNOWN_ID",
        elementId: "node-99999",
        message: "Unknown element ID: node-99999"
      }]
    });

    expect(presentation).toMatchObject({
      tone: "partial",
      summary: "Highlighted 2 elements; 1 failed."
    });
    expect(presentation.detail).toBe("A target was not found in the current page.");
    expect(JSON.stringify(presentation)).not.toContain("node-");
  });
});
