import type { ChatMessage } from "../ui/types";

const SETTINGS_KEY = "contextlayer.settings.v1";
const HISTORY_KEY = "contextlayer.history.v1";
const MAX_SESSIONS = 20;
const MAX_MESSAGES = 50;

export interface UserSettings {
  theme: "system" | "light" | "dark";
  accentColor: string;
  textSize: "small" | "medium" | "large";
  buttonSize: "small" | "medium" | "large";
  buttonPosition: "left" | "right";
  responseStyle: "normal" | "warm" | "friendly" | "professional" | "direct";
  answerLength: "short" | "normal" | "detailed";
  emoji: "none" | "few" | "lots";
  enterSends: boolean;
  saveHistory: boolean;
  customInstructions: string;
}

export interface StoredMessage {
  role: "user" | "assistant";
  text: string;
}

export interface ChatSession {
  id: string;
  url: string;
  title: string;
  updatedAt: number;
  messages: StoredMessage[];
}

export const DEFAULT_SETTINGS: UserSettings = {
  theme: "system",
  accentColor: "#f97316",
  textSize: "medium",
  buttonSize: "medium",
  buttonPosition: "right",
  responseStyle: "normal",
  answerLength: "normal",
  emoji: "few",
  enterSends: true,
  saveHistory: true,
  customInstructions: ""
};

function localStorageAvailable(): boolean {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

async function readValue<T>(key: string): Promise<T | undefined> {
  if (globalThis.chrome?.storage?.local) {
    const result = await chrome.storage.local.get(key);
    return result[key] as T | undefined;
  }
  if (!localStorageAvailable()) return undefined;
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) as T : undefined;
}

async function writeValue(key: string, value: unknown): Promise<void> {
  if (globalThis.chrome?.storage?.local) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }
  if (localStorageAvailable()) localStorage.setItem(key, JSON.stringify(value));
}

export async function loadSettings(): Promise<UserSettings> {
  const stored = await readValue<Partial<UserSettings>>(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  await writeValue(SETTINGS_KEY, settings);
}

export async function loadHistory(): Promise<ChatSession[]> {
  return (await readValue<ChatSession[]>(HISTORY_KEY) ?? [])
    .filter((session) => Array.isArray(session.messages))
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_SESSIONS);
}

export async function saveChatSession(session: ChatSession): Promise<ChatSession[]> {
  const history = await loadHistory();
  const normalized = {
    ...session,
    messages: session.messages.slice(-MAX_MESSAGES)
  };
  const next = [normalized, ...history.filter((item) => item.id !== session.id)]
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_SESSIONS);
  await writeValue(HISTORY_KEY, next);
  return next;
}

export async function deleteChatSession(id: string): Promise<ChatSession[]> {
  const next = (await loadHistory()).filter((session) => session.id !== id);
  await writeValue(HISTORY_KEY, next);
  return next;
}

export async function clearChatHistory(): Promise<void> {
  await writeValue(HISTORY_KEY, []);
}

export function messagesForStorage(messages: ChatMessage[]): StoredMessage[] {
  return messages.map(({ role, text }) => ({ role, text })).slice(-MAX_MESSAGES);
}

export function messagesFromStorage(messages: StoredMessage[]): ChatMessage[] {
  return messages.map(({ role, text }) => ({ id: crypto.randomUUID(), role, text }));
}

export function queryWithPreferences(query: string, settings: UserSettings): string {
  if (
    settings.responseStyle === DEFAULT_SETTINGS.responseStyle &&
    settings.answerLength === DEFAULT_SETTINGS.answerLength &&
    settings.emoji === DEFAULT_SETTINGS.emoji &&
    !settings.customInstructions.trim()
  ) return query;

  const preferences = [
    `Response style: ${settings.responseStyle}`,
    `Answer length: ${settings.answerLength}`,
    `Emoji usage: ${settings.emoji}`,
    settings.customInstructions.trim()
      ? `Custom instructions: ${settings.customInstructions.trim()}`
      : ""
  ].filter(Boolean);
  if (preferences.length === 0) return query;
  return `${query}\n\n[CONTEXTLAYER_USER_PREFERENCES]\n${preferences.join("\n")}`;
}
