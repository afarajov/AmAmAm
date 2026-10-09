import { ChromeAgentGateway } from "../adapters/ChromeAgentGateway";
import { NavigationAwarePageEngine } from "../adapters/NavigationAwarePageEngine";
import { createAgentSession, type AgentSession } from "../integration/agentSession";
import { MockAgentGateway } from "../mocks/MockAgentGateway";
import { MockStalePageEngine } from "../mocks/MockStalePageEngine";

export interface ExtensionRuntime {
  agentSession: AgentSession;
  modeLabel: string;
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
      modeLabel: "API mode"
    };
  }

  const mockPageEngine = new MockStalePageEngine(
    pageEngine,
    document.defaultView ?? window
  );

  return {
    agentSession: createAgentSession(mockPageEngine, new MockAgentGateway(), pageEngine),
    modeLabel: "Mock mode"
  };
}
