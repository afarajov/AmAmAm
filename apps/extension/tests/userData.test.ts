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
    await saveSettings({ ...DEFAULT_SETTINGS, theme: "dark", accentColor: "#3b82f6" });
    await expect(loadSettings()).resolves.toMatchObject({ theme: "dark", accentColor: "#3b82f6" });
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

  it("adds only non-default personalization to the backend query", () => {
    expect(queryWithPreferences("What is this?", DEFAULT_SETTINGS)).toBe("What is this?");
    expect(queryWithPreferences("What is this?", { ...DEFAULT_SETTINGS, answerLength: "short" }))
      .toContain("[CONTEXTLAYER_USER_PREFERENCES]");
  });
});
