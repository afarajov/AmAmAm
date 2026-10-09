import { createPageEngine } from "@contextlayer/page-engine";
import type {
  ActionExecutionResult,
  ExecuteActionsRequest,
  PageEngine,
  PageSnapshot
} from "@contextlayer/shared";

import type { PageScanCoordinator } from "../integration/agentSession";

const DOM_SETTLE_MS = 180;
const MAX_SETTLE_WAIT_MS = 1_500;
const NAVIGATION_CONTENT_WAIT_MS = 800;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class NavigationAwarePageEngine implements PageEngine, PageScanCoordinator {
  private delegate: PageEngine;
  private engineUrl: string;
  private lastMutationAt = Date.now();
  private readonly observer: MutationObserver | null;

  constructor(private readonly document: Document) {
    this.engineUrl = this.getCurrentUrl();
    this.delegate = createPageEngine(document);
    const MutationObserverConstructor = document.defaultView?.MutationObserver;
    this.observer = MutationObserverConstructor
      ? new MutationObserverConstructor(() => {
          this.lastMutationAt = Date.now();
        })
      : null;
    this.observer?.observe(document.documentElement, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  getCurrentUrl(): string {
    return this.document.location?.href ?? "";
  }

  async prepareForScan(): Promise<void> {
    if (this.document.readyState === "loading") {
      await Promise.race([
        new Promise<void>((resolve) => {
          this.document.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
        }),
        delay(MAX_SETTLE_WAIT_MS)
      ]);
    }

    if (this.getCurrentUrl() !== this.engineUrl) {
      const mutationAtNavigation = this.lastMutationAt;
      const navigationWaitStartedAt = Date.now();
      while (
        this.lastMutationAt === mutationAtNavigation &&
        Date.now() - navigationWaitStartedAt < NAVIGATION_CONTENT_WAIT_MS
      ) {
        await delay(50);
      }
    }

    const startedAt = Date.now();
    while (
      Date.now() - this.lastMutationAt < DOM_SETTLE_MS &&
      Date.now() - startedAt < MAX_SETTLE_WAIT_MS
    ) {
      await delay(50);
    }
  }

  scan(): PageSnapshot {
    const currentUrl = this.getCurrentUrl();
    if (currentUrl !== this.engineUrl) {
      this.engineUrl = currentUrl;
      this.delegate = createPageEngine(this.document);
    }
    return this.delegate.scan();
  }

  executeActions(request: ExecuteActionsRequest): ActionExecutionResult[] {
    return this.delegate.executeActions(request);
  }
}
