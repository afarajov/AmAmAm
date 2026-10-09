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
  PageObserver,
  type PageChangeListener,
  type PageChangeReason,
} from "./observer/page-observer.js";
import {
  waitForDynamicContent,
  type ScanWhenReadyOptions,
} from "./observer/wait-for-content.js";
import {
  resolveOptions,
  type PageEngineOptions,
  type ResolvedPageEngineOptions,
} from "./options.js";

export interface DynamicPageEngine extends PageEngine {
  scanWhenReady(options?: ScanWhenReadyOptions): Promise<PageSnapshot>;
  onPageChange(listener: PageChangeListener): () => void;
  dispose(): void;
}

export class SemanticPageEngine implements DynamicPageEngine {
  private readonly mapper = new ElementMapper();
  private readonly executor: ActionExecutor;
  private readonly options: ResolvedPageEngineOptions;
  private readonly pageId: string;
  private readonly observer: PageObserver;
  private readonly changeListeners = new Set<PageChangeListener>();
  private snapshotVersion = 0;
  private snapshotInvalidated = false;
  private lastSnapshotUrl = "";
  private lastSnapshotSignature = "";

  constructor(
    private readonly document: Document,
    options: PageEngineOptions = {},
  ) {
    this.options = resolveOptions(options);
    this.pageId = createPageId(document);
    this.executor = new ActionExecutor(document, this.mapper);
    this.observer = new PageObserver(
      document,
      this.options.ignoredUiAttribute,
      (reason) => this.invalidateSnapshot(reason),
    );
    if (this.options.observeMutations) this.observer.start();
  }

  scan(): PageSnapshot {
    this.observer.flushPendingChanges();
    if (this.lastSnapshotUrl && this.currentUrl() !== this.lastSnapshotUrl) {
      this.invalidateSnapshot("SPA_NAVIGATION");
    }
    this.observer.stop();
    this.executor.restorePage();
    this.mapper.reset();
    const elements = extractSemanticElements(this.document, this.mapper, this.options);
    const url = this.currentUrl();
    const signature = createSnapshotSignature(elements);

    if (this.snapshotVersion === 0) {
      this.snapshotVersion = 1;
    } else if (
      !this.snapshotInvalidated &&
      (url !== this.lastSnapshotUrl || signature !== this.lastSnapshotSignature)
    ) {
      this.snapshotVersion += 1;
    }
    this.snapshotInvalidated = false;
    this.lastSnapshotUrl = url;
    this.lastSnapshotSignature = signature;
    if (this.options.observeMutations) this.observer.start();

    return {
      contractVersion: CONTRACT_VERSION,
      pageId: this.pageId,
      snapshotVersion: this.snapshotVersion,
      url,
      title: this.document.title,
      capturedAt: Date.now(),
      elements,
    };
  }

  async scanWhenReady(options?: ScanWhenReadyOptions): Promise<PageSnapshot> {
    await waitForDynamicContent(
      this.document,
      this.options.ignoredUiAttribute,
      {
        timeoutMs: this.options.readinessTimeoutMs,
        settleMs: this.options.readinessSettleMs,
      },
      options,
    );
    return this.scan();
  }

  onPageChange(listener: PageChangeListener): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  dispose(): void {
    this.observer.stop();
    this.executor.restorePage();
    this.changeListeners.clear();
  }

  executeActions(request: ExecuteActionsRequest): ActionExecutionResult[] {
    this.observer.flushPendingChanges();
    if (this.lastSnapshotUrl && this.currentUrl() !== this.lastSnapshotUrl) {
      this.invalidateSnapshot("SPA_NAVIGATION");
    }
    if (request.pageId !== this.pageId || request.snapshotVersion !== this.snapshotVersion) {
      return request.actions.map((action) => staleResult(action));
    }
    return request.actions.map((action) => this.executor.execute(action));
  }

  private invalidateSnapshot(reason: PageChangeReason): void {
    if (this.snapshotVersion === 0 || this.snapshotInvalidated) return;
    const effectiveReason =
      this.lastSnapshotUrl && this.currentUrl() !== this.lastSnapshotUrl
        ? "SPA_NAVIGATION"
        : reason;
    this.snapshotVersion += 1;
    this.snapshotInvalidated = true;
    for (const listener of this.changeListeners) listener(effectiveReason);
  }

  private currentUrl(): string {
    return this.document.location?.href ?? "";
  }
}

function createSnapshotSignature(
  elements: PageSnapshot["elements"],
): string {
  return JSON.stringify(
    elements.map(({ kind, text, tagName, href, attributes, parentId }) => ({
      kind,
      text,
      tagName,
      href,
      attributes,
      parentId,
    })),
  );
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
