import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  clearChatHistory,
  loadHistory,
  loadSettings,
  messagesForStorage,
  queryWithPreferences,
  saveChatSession,
  saveSettings
} from "../src/storage/userData";

describe("local user data", () => {
  beforeEach(async () => {
    localStorage.clear();
    await clearChatHistory();
  });

  it("persists settings locally", async () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      theme: "dark" as const,
      accentColor: "#3b82f6",
      textSize: "large" as const,
      buttonSize: "small" as const,
      buttonPosition: "left" as const,
      responseStyle: "professional" as const,
      answerLength: "detailed" as const,
      emoji: "none" as const,
      enterSends: false,
      saveHistory: false,
      customInstructions: "Use concise technical language."
    };
    await saveSettings(settings);
    await expect(loadSettings()).resolves.toEqual(settings);
  });

  it("persists chat sessions without DOM references or executor metadata", async () => {
    const messages = messagesForStorage([{
      id: "assistant-1",
      role: "assistant",
      text: "Grounded answer",
      references: [{ elementId: "node-00001", excerpt: "Evidence" }],
      executionResults: []
    }]);
    await saveChatSession({ id: "chat-1", url: "https://example.com", title: "Example", updatedAt: 10, messages });

    const history = await loadHistory();
    expect(history[0]?.messages).toEqual([{ role: "assistant", text: "Grounded answer" }]);
    expect(JSON.stringify(history)).not.toContain("node-00001");
  });

  it("bounds and sanitizes stored chat data", async () => {
    const messages = Array.from({ length: 60 }, (_, index) => ({
      id: `message-${index}`,
      role: index % 2 ? "assistant" as const : "user" as const,
      text: `node-00042 ${"x".repeat(5_000)}`
    }));
    await saveChatSession({
      id: "chat-1",
      url: "https://example.com/path",
      title: "T".repeat(300),
      updatedAt: 10,
      messages: messagesForStorage(messages)
    });

    const [session] = await loadHistory();
    expect(session?.messages).toHaveLength(50);
    expect(session?.messages[0]?.text.length).toBeLessThanOrEqual(4_000);
    expect(JSON.stringify(session)).not.toContain("node-00042");
    expect(session?.title).toHaveLength(200);
  });

  it("ignores malformed persisted values", async () => {
    localStorage.setItem("contextlayer.settings.v1", "not-json");
    localStorage.setItem("contextlayer.history.v1", JSON.stringify([{ rawSnapshot: true }]));
    await expect(loadSettings()).resolves.toEqual(DEFAULT_SETTINGS);
    await expect(loadHistory()).resolves.toEqual([]);
  });

  it("adds only non-default personalization to the backend query", () => {
    expect(queryWithPreferences("What is this?", DEFAULT_SETTINGS)).toBe("What is this?");
    expect(queryWithPreferences("What is this?", { ...DEFAULT_SETTINGS, answerLength: "short" }))
      .toContain("[CONTEXTLAYER_USER_PREFERENCES]");
  });
});
