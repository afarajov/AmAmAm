import {
  CONTRACT_VERSION,
  type ActionExecutionResult,
  type AgentAction,
  type ExecuteActionsRequest,
  type PageEngine,
  type PageSnapshot,
} from "@contextlayer/shared";
import { ActionExecutor } from "./actions/executor.js";
import { extractSemanticElements } from "./extraction/extract.js";
import { ElementMapper } from "./mapping/element-mapper.js";
import {
  resolveOptions,
  type PageEngineOptions,
  type ResolvedPageEngineOptions,
} from "./options.js";

export class SemanticPageEngine implements PageEngine {
  private readonly mapper = new ElementMapper();
  private readonly executor: ActionExecutor;
  private readonly options: ResolvedPageEngineOptions;
  private readonly pageId: string;
  private snapshotVersion = 0;

  constructor(
    private readonly document: Document,
    options: PageEngineOptions = {},
  ) {
    this.options = resolveOptions(options);
    this.pageId = createPageId(document);
    this.executor = new ActionExecutor(document, this.mapper);
  }

  scan(): PageSnapshot {
    this.executor.restorePage();
    this.mapper.reset();
    this.snapshotVersion += 1;

    return {
      contractVersion: CONTRACT_VERSION,
      pageId: this.pageId,
      snapshotVersion: this.snapshotVersion,
      url: this.document.location?.href ?? "",
      title: this.document.title,
      capturedAt: Date.now(),
      elements: extractSemanticElements(this.document, this.mapper, this.options),
    };
  }

  executeActions(request: ExecuteActionsRequest): ActionExecutionResult[] {
    if (request.pageId !== this.pageId || request.snapshotVersion !== this.snapshotVersion) {
      return request.actions.map((action) => staleResult(action));
    }
    return request.actions.map((action) => this.executor.execute(action));
  }
}

export function createPageEngine(
  document: Document,
  options?: PageEngineOptions,
): SemanticPageEngine {
  return new SemanticPageEngine(document, options);
}

function createPageId(document: Document): string {
  const crypto = document.defaultView?.crypto ?? globalThis.crypto;
  if (crypto && "randomUUID" in crypto) return `page-${crypto.randomUUID()}`;
  return `page-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function staleResult(action: AgentAction): ActionExecutionResult {
  return {
    type: action.type,
    success: false,
    affectedElementIds: [],
    failures: [
      {
        code: "STALE_SNAPSHOT",
        message: "The action targets a different page or snapshot version.",
      },
    ],
  };
}
