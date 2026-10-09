import { ChromeAgentGateway } from "../adapters/ChromeAgentGateway";
import { NavigationAwarePageEngine } from "../adapters/NavigationAwarePageEngine";
import { createAgentSession, type AgentSession } from "../integration/agentSession";
import { MockAgentGateway } from "../mocks/MockAgentGateway";
import { MockStalePageEngine } from "../mocks/MockStalePageEngine";
import { AGENT_HEALTH_MESSAGE } from "../messages/agentMessages";
import type { ConnectionCheckResult } from "../background/apiClient";

export interface ExtensionRuntime {
  agentSession: AgentSession;
  modeLabel: string;
  checkConnection: () => Promise<ConnectionCheckResult>;
}

export function createRuntime(document: Document): ExtensionRuntime {
  const pageEngine = new NavigationAwarePageEngine(document);

  if (import.meta.env.MODE === "api") {
    return {
      agentSession: createAgentSession(
        pageEngine,
        new ChromeAgentGateway(),
        pageEngine
      ),
      modeLabel: "API mode",
      checkConnection: async () => {
        const result: unknown = await chrome.runtime.sendMessage({ type: AGENT_HEALTH_MESSAGE });
        if (typeof result !== "object" || result === null || !("status" in result)) {
          return { status: "invalid" };
        }
        const status = (result as { status: string }).status;
        return status === "ready" || status === "offline" || status === "timeout" || status === "invalid"
          ? { status }
          : { status: "invalid" };
      }
    };
  }

  const mockPageEngine = new MockStalePageEngine(
    pageEngine,
    document.defaultView ?? window
  );

  return {
    agentSession: createAgentSession(mockPageEngine, new MockAgentGateway(), pageEngine),
    modeLabel: "Mock mode",
    checkConnection: async () => ({ status: "ready" })
  };
}
