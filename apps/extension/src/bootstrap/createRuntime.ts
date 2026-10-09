import { createPageEngine } from "@contextlayer/page-engine";

import { ChromeAgentGateway } from "../adapters/ChromeAgentGateway";
import { createAgentSession, type AgentSession } from "../integration/agentSession";
import { MockAgentGateway } from "../mocks/MockAgentGateway";

export interface ExtensionRuntime {
  agentSession: AgentSession;
  modeLabel: string;
}

export function createRuntime(document: Document): ExtensionRuntime {
  const pageEngine = createPageEngine(document);

  if (import.meta.env.MODE === "api") {
    return {
      agentSession: createAgentSession(
        pageEngine,
        new ChromeAgentGateway()
      ),
      modeLabel: "API mode"
    };
  }

  return {
    agentSession: createAgentSession(pageEngine, new MockAgentGateway()),
    modeLabel: "Mock mode"
  };
}
