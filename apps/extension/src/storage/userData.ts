import type { ChatMessage } from "../ui/types";

const SETTINGS_KEY = "contextlayer.settings.v1";
const HISTORY_KEY = "contextlayer.history.v1";
const MAX_SESSIONS = 20;
const MAX_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 4_000;
const MAX_TITLE_LENGTH = 200;
const MAX_URL_LENGTH = 2_048;
let historyMutation: Promise<unknown> = Promise.resolve();

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
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
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
  if (!stored || typeof stored !== "object") return DEFAULT_SETTINGS;
  const merged = { ...DEFAULT_SETTINGS, ...stored };
  return {
    theme: ["system", "light", "dark"].includes(merged.theme) ? merged.theme : DEFAULT_SETTINGS.theme,
    accentColor: /^#[0-9a-f]{6}$/i.test(merged.accentColor) ? merged.accentColor : DEFAULT_SETTINGS.accentColor,
    textSize: ["small", "medium", "large"].includes(merged.textSize) ? merged.textSize : DEFAULT_SETTINGS.textSize,
    buttonSize: ["small", "medium", "large"].includes(merged.buttonSize) ? merged.buttonSize : DEFAULT_SETTINGS.buttonSize,
    buttonPosition: ["left", "right"].includes(merged.buttonPosition) ? merged.buttonPosition : DEFAULT_SETTINGS.buttonPosition,
    responseStyle: ["normal", "warm", "friendly", "professional", "direct"].includes(merged.responseStyle) ? merged.responseStyle : DEFAULT_SETTINGS.responseStyle,
    answerLength: ["short", "normal", "detailed"].includes(merged.answerLength) ? merged.answerLength : DEFAULT_SETTINGS.answerLength,
    emoji: ["none", "few", "lots"].includes(merged.emoji) ? merged.emoji : DEFAULT_SETTINGS.emoji,
    enterSends: typeof merged.enterSends === "boolean" ? merged.enterSends : DEFAULT_SETTINGS.enterSends,
    saveHistory: typeof merged.saveHistory === "boolean" ? merged.saveHistory : DEFAULT_SETTINGS.saveHistory,
    customInstructions: typeof merged.customInstructions === "string" ? merged.customInstructions.slice(0, 500) : ""
  } as UserSettings;
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  await writeValue(SETTINGS_KEY, settings);
}

export async function loadHistory(): Promise<ChatSession[]> {
  const stored = await readValue<unknown>(HISTORY_KEY);
  if (!Array.isArray(stored)) return [];
  return stored
    .filter(isSafeSession)
    .map(normalizeSession)
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_SESSIONS);
}

function enqueueHistoryMutation<T>(mutation: () => Promise<T>): Promise<T> {
  const next = historyMutation.then(mutation, mutation);
  historyMutation = next.then(() => undefined, () => undefined);
  return next;
}

export async function saveChatSession(session: ChatSession): Promise<ChatSession[]> {
  return enqueueHistoryMutation(async () => {
    const history = await loadHistory();
    const normalized = normalizeSession(session);
    const next = [normalized, ...history.filter((item) => item.id !== session.id)]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_SESSIONS);
    await writeValue(HISTORY_KEY, next);
    return next;
  });
}

export async function deleteChatSession(id: string): Promise<ChatSession[]> {
  return enqueueHistoryMutation(async () => {
    const next = (await loadHistory()).filter((session) => session.id !== id);
    await writeValue(HISTORY_KEY, next);
    return next;
  });
}

export async function clearChatHistory(): Promise<void> {
  await enqueueHistoryMutation(() => writeValue(HISTORY_KEY, []));
}

export function messagesForStorage(messages: ChatMessage[]): StoredMessage[] {
  return messages.map(({ role, text }) => ({
    role,
    text: sanitizeText(text, MAX_MESSAGE_LENGTH)
  })).slice(-MAX_MESSAGES);
}

function sanitizeText(value: string, maxLength: number): string {
  return value.replace(/\bnode-\d+\b/gi, "referenced element").slice(0, maxLength);
}

function isSafeSession(value: unknown): value is ChatSession {
  if (typeof value !== "object" || value === null) return false;
  const session = value as Record<string, unknown>;
  return typeof session.id === "string" && typeof session.url === "string" &&
    typeof session.title === "string" && typeof session.updatedAt === "number" &&
    Array.isArray(session.messages) && session.messages.every((message) => {
      if (typeof message !== "object" || message === null) return false;
      const candidate = message as Record<string, unknown>;
      return (candidate.role === "user" || candidate.role === "assistant") &&
        typeof candidate.text === "string";
    });
}

function normalizeSession(session: ChatSession): ChatSession {
  let url = "";
  try {
    const parsed = new URL(session.url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") url = parsed.href;
  } catch {
    url = "";
  }
  return {
    id: session.id.slice(0, 100),
    url: url.slice(0, MAX_URL_LENGTH),
    title: sanitizeText(session.title, MAX_TITLE_LENGTH) || "Untitled page",
    updatedAt: Number.isFinite(session.updatedAt) ? session.updatedAt : Date.now(),
    messages: session.messages.map(({ role, text }) => ({
      role,
      text: sanitizeText(text, MAX_MESSAGE_LENGTH)
    })).slice(-MAX_MESSAGES)
  };
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
