import type {
  ActionExecutionResult,
  AgentReference
} from "@contextlayer/shared";

export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  references?: AgentReference[];
  executionResults?: ActionExecutionResult[];
}

export type RequestStatus = "idle" | "loading" | "error";
