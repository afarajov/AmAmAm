import type {
  ActionExecutionResult,
  AgentRequest,
  AgentResponse,
  PageEngine,
  PageSnapshot
} from "@contextlayer/shared";

export type AgentSessionProgress =
  | "scanning"
  | "waiting-for-content"
  | "requesting"
  | "rescanning";

export type AgentSessionErrorCode =
  | "PAGE_LOADING"
  | "PAGE_TEXT_NOT_FOUND"
  | "PAGE_CHANGED"
  | "RESCAN_REQUIRED";

export class AgentSessionError extends Error {
  constructor(
    readonly code: AgentSessionErrorCode,
    message: string
  ) {
    super(message);
    this.name = "AgentSessionError";
  }
}

export class AgentGatewayError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "AgentGatewayError";
  }
}

export interface AgentGateway {
  query(request: AgentRequest): Promise<AgentResponse>;
}

export interface PageScanCoordinator {
  prepareForScan(): Promise<void>;
  getCurrentUrl(): string;
}

export interface SubmitOptions {
  onProgress?: (progress: AgentSessionProgress) => void;
}

export interface AgentTurnResult {
  response: AgentResponse;
  executionResults: ActionExecutionResult[];
  hasPageModifications: boolean;
  recoveredFromStale: boolean;
}

export interface LocalActionResult {
  executionResults: ActionExecutionResult[];
  hasPageModifications: boolean;
}

export interface AgentSession {
  submit(query: string, options?: SubmitOptions): Promise<AgentTurnResult>;
  scrollToReference(elementId: string): LocalActionResult;
  reset(): LocalActionResult;
  invalidatePage(): void;
}

const MUTATING_ACTIONS = new Set(["HIGHLIGHT", "DIM", "STRIKE", "HIDE"]);
const MAX_EMPTY_SCANS = 3;
const EMPTY_SCAN_DELAY_MS = 300;
const MAX_STALE_RETRIES = 1;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function hasStaleFailure(results: ActionExecutionResult[]): boolean {
  return results.some((result) => (
    result.failures.some((failure) => failure.code === "STALE_SNAPSHOT")
  ));
}

function assertCorrelatedResponse(request: AgentRequest, response: AgentResponse): void {
  if (response.requestId !== request.requestId) {
    throw new AgentSessionError(
      "RESCAN_REQUIRED",
      "The agent returned an unexpected request identifier."
    );
  }

  if (
    response.pageId !== request.page.pageId ||
    response.snapshotVersion !== request.page.snapshotVersion
  ) {
    throw new AgentSessionError(
      "RESCAN_REQUIRED",
      "The response targets an outdated page snapshot."
    );
  }
}

export function createAgentSession(
  pageEngine: PageEngine,
  agentGateway: AgentGateway,
  scanCoordinator?: PageScanCoordinator
): AgentSession {
  let currentPage: PageSnapshot | null = null;
  let pageGeneration = 0;
  const modifiedElementIds = new Set<string>();

  const executeLocalActions = (
    actions: Parameters<PageEngine["executeActions"]>[0]["actions"]
  ): LocalActionResult => {
    if (!currentPage) {
      throw new AgentSessionError(
        "RESCAN_REQUIRED",
        "Scan the current page before running this action."
      );
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

  const scanForContent = async (options?: SubmitOptions): Promise<PageSnapshot> => {
    await scanCoordinator?.prepareForScan();

    for (let attempt = 0; attempt < MAX_EMPTY_SCANS; attempt += 1) {
      options?.onProgress?.(attempt === 0 ? "scanning" : "waiting-for-content");
      const page = pageEngine.scan();
      if (page.elements.length > 0) return page;
      if (attempt < MAX_EMPTY_SCANS - 1) await delay(EMPTY_SCAN_DELAY_MS);
    }

    throw new AgentSessionError(
      "PAGE_TEXT_NOT_FOUND",
      "No readable page text was found."
    );
  };

  return {
    async submit(query, options) {
      const submissionGeneration = pageGeneration;

      for (let retry = 0; retry <= MAX_STALE_RETRIES; retry += 1) {
        if (retry > 0) options?.onProgress?.("rescanning");

        const page = await scanForContent(options);
        currentPage = page;
        modifiedElementIds.clear();

        if (
          submissionGeneration !== pageGeneration ||
          (scanCoordinator && scanCoordinator.getCurrentUrl() !== page.url)
        ) {
          throw new AgentSessionError(
            "PAGE_CHANGED",
            "The page changed while the request was being prepared."
          );
        }

        const request: AgentRequest = {
          requestId: crypto.randomUUID(),
          query,
          page
        };

        options?.onProgress?.("requesting");
        const response = await agentGateway.query(request);

        if (
          submissionGeneration !== pageGeneration ||
          (scanCoordinator && scanCoordinator.getCurrentUrl() !== page.url)
        ) {
          throw new AgentSessionError(
            "PAGE_CHANGED",
            "The page changed before the agent response arrived."
          );
        }

        try {
          assertCorrelatedResponse(request, response);
        } catch (error) {
          if (retry < MAX_STALE_RETRIES) continue;
          throw error;
        }

        const actionResult = response.actions.length
          ? executeLocalActions(response.actions)
          : { executionResults: [], hasPageModifications: false };

        if (hasStaleFailure(actionResult.executionResults)) {
          currentPage = null;
          modifiedElementIds.clear();
          if (retry < MAX_STALE_RETRIES) continue;
          throw new AgentSessionError(
            "RESCAN_REQUIRED",
            "The page changed again. A new scan is required."
          );
        }

        return {
          response,
          ...actionResult,
          recoveredFromStale: retry > 0
        };
      }

      throw new AgentSessionError("RESCAN_REQUIRED", "A new page scan is required.");
    },

    scrollToReference(elementId) {
      return executeLocalActions([{ type: "SCROLL_TO", targetElementIds: [elementId] }]);
    },

    reset() {
      return executeLocalActions([{ type: "RESTORE_ALL" }]);
    },

    invalidatePage() {
      pageGeneration += 1;
      currentPage = null;
      modifiedElementIds.clear();
    }
  };
}
