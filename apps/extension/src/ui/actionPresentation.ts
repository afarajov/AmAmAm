import type {
  ActionExecutionResult,
  ActionFailureCode,
  AgentActionType
} from "@contextlayer/shared";

export interface ActionResultPresentation {
  label: string;
  summary: string;
  detail?: string;
  tone: "success" | "partial" | "failure";
}

const LABELS: Record<AgentActionType, string> = {
  SCROLL_TO: "SCROLL TO",
  HIGHLIGHT: "HIGHLIGHT",
  DIM: "DIM",
  STRIKE: "STRIKE",
  HIDE: "HIDE",
  CLEAR_EFFECT: "CLEAR EFFECT",
  RESTORE_ALL: "RESTORE ALL"
};

const SUCCESS_VERBS: Record<AgentActionType, string> = {
  SCROLL_TO: "Scrolled to",
  HIGHLIGHT: "Highlighted",
  DIM: "Dimmed",
  STRIKE: "Struck through",
  HIDE: "Hidden",
  CLEAR_EFFECT: "Cleared effects from",
  RESTORE_ALL: "Restored"
};

const FAILURE_MESSAGES: Record<ActionFailureCode, string> = {
  UNKNOWN_ID: "A target was not found in the current page.",
  STALE_SNAPSHOT: "The page changed before the action could run.",
  DETACHED_NODE: "A target disappeared from the page.",
  UNSAFE_TARGET: "The target is protected from this action.",
  UNSUPPORTED_ACTION: "This action is not supported on the page.",
  EXECUTION_FAILED: "The browser could not complete the action."
};

function elementCount(count: number): string {
  return `${count} element${count === 1 ? "" : "s"}`;
}

function failureDetail(result: ActionExecutionResult): string | undefined {
  const messages = [...new Set(result.failures.map((failure) => (
    FAILURE_MESSAGES[failure.code]
  )))];
  return messages.length > 0 ? messages.join(" ") : undefined;
}

export function presentActionResult(
  result: ActionExecutionResult
): ActionResultPresentation {
  const affectedCount = result.affectedElementIds.length;
  const failedCount = result.failures.length;
  const label = LABELS[result.type];

  if (result.success) {
    const summary = result.type === "RESTORE_ALL" && affectedCount === 0
      ? "No active page effects remained."
      : `${SUCCESS_VERBS[result.type]} ${elementCount(affectedCount)}.`;
    return { label, summary, tone: "success" };
  }

  if (affectedCount > 0) {
    return {
      label,
      summary: `${SUCCESS_VERBS[result.type]} ${elementCount(affectedCount)}; ${failedCount} failed.`,
      detail: failureDetail(result),
      tone: "partial"
    };
  }

  return {
    label,
    summary: `Action failed for ${failedCount || 1} target${failedCount === 1 ? "" : "s"}.`,
    detail: failureDetail(result),
    tone: "failure"
  };
}
