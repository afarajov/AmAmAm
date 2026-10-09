import type {
  ActionExecutionResult,
  AgentRequest,
  AgentResponse,
  PageEngine
} from "@contextlayer/shared";

export interface AgentGateway {
  query(request: AgentRequest): Promise<AgentResponse>;
}

export interface AgentTurnResult {
  response: AgentResponse;
  executionResults: ActionExecutionResult[];
}

export interface AgentSession {
  submit(query: string): Promise<AgentTurnResult>;
}

function assertCorrelatedResponse(request: AgentRequest, response: AgentResponse): void {
  if (response.requestId !== request.requestId) {
    throw new Error("The agent returned an unexpected request identifier.");
  }

  if (
    response.pageId !== request.page.pageId ||
    response.snapshotVersion !== request.page.snapshotVersion
  ) {
    throw new Error("The page changed before the agent response was received.");
  }
}

export function createAgentSession(
  pageEngine: PageEngine,
  agentGateway: AgentGateway
): AgentSession {
  return {
    async submit(query) {
      const page = pageEngine.scan();
      const request: AgentRequest = {
        requestId: crypto.randomUUID(),
        query,
        page
      };

      const response = await agentGateway.query(request);
      assertCorrelatedResponse(request, response);

      const executionResults = response.actions.length
        ? pageEngine.executeActions({
            pageId: response.pageId,
            snapshotVersion: response.snapshotVersion,
            actions: response.actions
          })
        : [];

      return { response, executionResults };
    }
  };
}
