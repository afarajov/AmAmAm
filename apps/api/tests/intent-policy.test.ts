import { describe, expect, it } from "vitest";
import { classifyQueryIntent } from "../src/ai/intent-policy.js";

describe("query intent policy", () => {
  it.each([
    ["Highlight the privacy paragraph", ["HIGHLIGHT"]],
    ["Прокрути к разделу о безопасности", ["SCROLL_TO"]],
    ["Затемни нерелевантные блоки", ["DIM"]],
    ["Зачеркни устаревший текст", ["STRIKE"]],
    ["Скрой рекламный блок", ["HIDE"]],
    ["Убери эффект с абзаца о рисках", ["CLEAR_EFFECT"]],
    ["Верни всё", ["RESTORE_ALL"]],
    ["Show me the paragraph about privacy", ["HIGHLIGHT", "SCROLL_TO"]],
    ["Highlight and scroll to the privacy paragraph", ["HIGHLIGHT", "SCROLL_TO"]]
  ])("maps %s to the exact requested actions", (query, expected) => {
    const intent = classifyQueryIntent(query);
    expect(intent.kind).toBe("ACTION");
    expect(intent.requiredActions).toEqual(expected);
  });

  it.each([
    "What does this post say?",
    "Какие риски описаны на странице?",
    "Почему автор скрывает важные детали?",
    "Что выделяет эту модель среди остальных?",
    "Bu məqalə nə haqqındadır?"
  ])("keeps factual question action-free: %s", (query) => {
    expect(classifyQueryIntent(query)).toEqual({ kind: "FACTUAL", requiredActions: [] });
  });

  it.each(["Hide this", "Скрой это", "Vurğula bunu"])(
    "detects an unresolved action target: %s",
    (query) => expect(classifyQueryIntent(query).kind).toBe("AMBIGUOUS_ACTION")
  );
});
