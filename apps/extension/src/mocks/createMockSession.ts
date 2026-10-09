import { createAgentSession, type AgentSession } from "../integration/agentSession";
import { MockAgentGateway } from "./MockAgentGateway";
import { MockPageEngine } from "./MockPageEngine";

export function createMockSession(document: Document): AgentSession {
  return createAgentSession(new MockPageEngine(document), new MockAgentGateway());
}
