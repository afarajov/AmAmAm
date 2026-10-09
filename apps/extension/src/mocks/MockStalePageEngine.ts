import type {
  ActionExecutionResult,
  AgentAction,
  ExecuteActionsRequest,
  PageEngine,
  PageSnapshot
} from "@contextlayer/shared";

export const MOCK_STALE_EVENT = "contextlayer:mock-stale-snapshot";

function staleResult(action: AgentAction): ActionExecutionResult {
  return {
    type: action.type,
    success: false,
    affectedElementIds: [],
    failures: [{
      code: "STALE_SNAPSHOT",
      message: "The mock snapshot became stale before execution."
    }]
  };
}

export class MockStalePageEngine implements PageEngine {
  private staleNextExecution = false;

  constructor(
    private readonly delegate: PageEngine,
    pageWindow: Window
  ) {
    pageWindow.addEventListener(MOCK_STALE_EVENT, () => {
      this.staleNextExecution = true;
    });
  }

  scan(): PageSnapshot {
    return this.delegate.scan();
  }

  executeActions(request: ExecuteActionsRequest): ActionExecutionResult[] {
    if (this.staleNextExecution) {
      this.staleNextExecution = false;
      return request.actions.map(staleResult);
    }
    return this.delegate.executeActions(request);
  }
}
