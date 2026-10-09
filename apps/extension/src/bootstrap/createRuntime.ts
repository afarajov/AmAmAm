import { ChromeAgentGateway } from "../adapters/ChromeAgentGateway";
import { createAgentSession, type AgentSession } from "../integration/agentSession";
import { createMockSession } from "../mocks/createMockSession";
import { MockPageEngine } from "../mocks/MockPageEngine";

export interface ExtensionRuntime {
  agentSession: AgentSession;
  modeLabel: string;
}

export function createRuntime(document: Document): ExtensionRuntime {
  if (import.meta.env.MODE === "api") {
    return {
      agentSession: createAgentSession(
        new MockPageEngine(document),
        new ChromeAgentGateway()
      ),
      modeLabel: "API mode"
    };
  }

  return {
    agentSession: createMockSession(document),
    modeLabel: "Mock mode"
  };
}
