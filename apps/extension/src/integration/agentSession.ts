import type {
  ActionExecutionResult,
  AgentRequest,
  AgentResponse,
  PageEngine,
  PageSnapshot
} from "@contextlayer/shared";

export interface AgentGateway {
  query(request: AgentRequest): Promise<AgentResponse>;
}

export interface AgentTurnResult {
  response: AgentResponse;
  executionResults: ActionExecutionResult[];
  hasPageModifications: boolean;
}

export interface LocalActionResult {
  executionResults: ActionExecutionResult[];
  hasPageModifications: boolean;
}

export interface AgentSession {
  submit(query: string): Promise<AgentTurnResult>;
  scrollToReference(elementId: string): LocalActionResult;
  reset(): LocalActionResult;
}

const MUTATING_ACTIONS = new Set(["HIGHLIGHT", "DIM", "STRIKE", "HIDE"]);

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
  let currentPage: PageSnapshot | null = null;
  const modifiedElementIds = new Set<string>();

  const executeLocalActions = (
    actions: Parameters<PageEngine["executeActions"]>[0]["actions"]
  ): LocalActionResult => {
    if (!currentPage) {
      throw new Error("No page snapshot is available for this action.");
    }

    const executionResults = pageEngine.executeActions({
      pageId: currentPage.pageId,
      snapshotVersion: currentPage.snapshotVersion,
      actions
    });

    for (const result of executionResults) {
      if (MUTATING_ACTIONS.has(result.type)) {
        result.affectedElementIds.forEach((elementId) => modifiedElementIds.add(elementId));
      } else if (result.type === "CLEAR_EFFECT") {
        result.affectedElementIds.forEach((elementId) => modifiedElementIds.delete(elementId));
      } else if (result.type === "RESTORE_ALL" && result.success) {
        modifiedElementIds.clear();
      }
    }

    return {
      executionResults,
      hasPageModifications: modifiedElementIds.size > 0
    };
  };

  return {
    async submit(query) {
      const page = pageEngine.scan();
      currentPage = page;
      modifiedElementIds.clear();
      const request: AgentRequest = {
        requestId: crypto.randomUUID(),
        query,
        page
      };

      const response = await agentGateway.query(request);
      assertCorrelatedResponse(request, response);

      const actionResult = response.actions.length
        ? executeLocalActions(response.actions)
        : { executionResults: [], hasPageModifications: false };

      return { response, ...actionResult };
    },

    scrollToReference(elementId) {
      return executeLocalActions([{ type: "SCROLL_TO", targetElementIds: [elementId] }]);
    },

    reset() {
      return executeLocalActions([{ type: "RESTORE_ALL" }]);
    }
  };
}
