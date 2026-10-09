export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
}

export type RequestStatus = "idle" | "loading" | "error";
