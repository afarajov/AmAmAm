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

  it("finds a relevant element near the end of a large page and long text block", async () => {
    const distractors: SemanticElement[] = Array.from({ length: 160 }, (_, index) => ({
      id: `node-${String(index + 1).padStart(5, "0")}`,
      kind: "paragraph",
      text: `Unrelated navigation and weather content ${index}`,
      tagName: "P",
      visible: true
    }));
    const relevant: SemanticElement = {
      id: "node-00161",
      kind: "section",
      text: `${"Unrelated introduction. ".repeat(75)}Red Square is the official GameSummit partner.`,
      tagName: "SECTION",
      visible: true
    };
    const provider: EmbeddingProvider = {
      embed: async (inputs) => inputs.map((input, index) =>
        index === 0 || input.includes("official GameSummit partner") ? [1, 0] : [0, 1]
      )
    };

    const selected = await selectSemanticCandidateElements(
      "Кто официальный партнёр GameSummit?",
      [...distractors, relevant],
      provider
    );

    expect(selected[0]?.id).toBe("node-00161");
    expect(selected).toHaveLength(80);
  });

  it("keeps DOM order stable when semantic scores are equal", async () => {
    const provider: EmbeddingProvider = {
      embed: async (inputs) => inputs.map(() => [1, 0])
    };

    const first = await selectSemanticCandidateElements("нейтральный запрос", elements, provider);
    const second = await selectSemanticCandidateElements("нейтральный запрос", elements, provider);

    expect(first.map((element) => element.id)).toEqual(["node-00001", "node-00002"]);
    expect(second.map((element) => element.id)).toEqual(first.map((element) => element.id));
  });

  it("keeps the selected context inside the planner character budget", async () => {
    const largeElements: SemanticElement[] = Array.from({ length: 80 }, (_, index) => ({
      id: `node-${String(index + 1).padStart(5, "0")}`,
      kind: "paragraph",
      text: `${String(index).padStart(4, "0")} ${"bounded content ".repeat(70)}`,
      tagName: "P",
      visible: true
    }));
    const provider: EmbeddingProvider = {
      embed: async (inputs) => inputs.map(() => [1, 0])
    };

    const selected = await selectSemanticCandidateElements("bounded", largeElements, provider);
    const totalCharacters = selected.reduce((total, element) => total + element.text.length, 0);

    expect(totalCharacters).toBeLessThanOrEqual(30_000);
    expect(selected.length).toBeLessThan(80);
  });
});
