import type { SemanticElement } from "@contextlayer/shared";
import { describe, expect, it } from "vitest";
import {
  selectCandidateElements,
  selectSemanticCandidateElements,
  type EmbeddingProvider
} from "../src/retrieval/select-candidates.js";

const elements: SemanticElement[] = [
  {
    id: "node-00001",
    kind: "paragraph",
    text: "The weather will be sunny tomorrow.",
    tagName: "P",
    visible: true
  },
  {
    id: "node-00002",
    kind: "paragraph",
    text: "Red Square is the official gaming peripherals partner of GameSummit 2026.",
    tagName: "P",
    visible: true
  }
];

describe("candidate retrieval", () => {
  it("uses multilingual semantic similarity when query and page languages differ", async () => {
    const provider: EmbeddingProvider = {
      embed: async () => [
        [1, 0],
        [0, 1],
        [0.99, 0.01]
      ]
    };

    const selected = await selectSemanticCandidateElements(
      "Кто является партнёром мероприятия?",
      elements,
      provider
    );

    expect(selected[0]?.id).toBe("node-00002");
  });

  it("retains deterministic lexical retrieval as the offline fallback", () => {
    const selected = selectCandidateElements("weather sunny", elements);
    expect(selected[0]?.id).toBe("node-00001");
  });

  it("rejects malformed embedding responses", async () => {
    const provider: EmbeddingProvider = { embed: async () => [[1, 0]] };
    await expect(selectSemanticCandidateElements("партнёр", elements, provider))
      .rejects.toThrow("invalid vector set");
  });
});
