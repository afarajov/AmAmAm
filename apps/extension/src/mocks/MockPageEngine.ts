import {
  CONTRACT_VERSION,
  type ActionExecutionResult,
  type ExecuteActionsRequest,
  type PageEngine,
  type PageSnapshot
} from "@contextlayer/shared";

export class MockPageEngine implements PageEngine {
  readonly #pageId = `mock-page-${crypto.randomUUID()}`;

  constructor(private readonly document: Document) {}

  scan(): PageSnapshot {
    return {
      contractVersion: CONTRACT_VERSION,
      pageId: this.#pageId,
      snapshotVersion: 1,
      url: this.document.location.href,
      title: this.document.title,
      capturedAt: Date.now(),
      elements: []
    };
  }

  executeActions(request: ExecuteActionsRequest): ActionExecutionResult[] {
    return request.actions.map((action) => ({
      type: action.type,
      success: false,
      affectedElementIds: [],
      failures: [
        {
          code: "UNSUPPORTED_ACTION",
          message: "The mock page engine does not modify the host page."
        }
      ]
    }));
  }
}
