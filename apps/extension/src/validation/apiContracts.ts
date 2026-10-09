import type {
  AgentAction,
  AgentActionType,
  AgentResponse,
  ApiError
} from "@contextlayer/shared";

const ACTION_TYPES = new Set<AgentActionType>([
  "SCROLL_TO",
  "HIGHLIGHT",
  "DIM",
  "STRIKE",
  "HIDE",
  "RESTORE_ALL",
  "CLEAR_EFFECT"
]);

const API_ERROR_CODES = new Set<ApiError["code"]>([
  "INVALID_REQUEST",
  "CONTEXT_TOO_LARGE",
  "RATE_LIMITED",
  "MODEL_ERROR",
  "MODEL_TIMEOUT",
  "INTERNAL_ERROR"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isAgentAction(value: unknown): value is AgentAction {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  if (!ACTION_TYPES.has(value.type as AgentActionType)) return false;
  if (value.explanation !== undefined && typeof value.explanation !== "string") return false;

  if (value.type === "RESTORE_ALL") {
    return value.targetElementIds === undefined;
  }

  return isStringArray(value.targetElementIds);
}

export function isAgentResponse(value: unknown): value is AgentResponse {
  if (!isRecord(value)) return false;
  if (
    typeof value.requestId !== "string" ||
    typeof value.pageId !== "string" ||
    !Number.isSafeInteger(value.snapshotVersion) ||
    typeof value.message !== "string" ||
    !Array.isArray(value.actions) ||
    !value.actions.every(isAgentAction)
  ) {
    return false;
  }

  if (
    value.references !== undefined &&
    (!Array.isArray(value.references) ||
      !value.references.every(
        (reference) =>
          isRecord(reference) &&
          typeof reference.elementId === "string" &&
          (reference.excerpt === undefined || typeof reference.excerpt === "string")
      ))
  ) {
    return false;
  }

  return value.limitations === undefined || isStringArray(value.limitations);
}

export function isApiError(value: unknown): value is ApiError {
  if (!isRecord(value) || typeof value.code !== "string") return false;
  return (
    API_ERROR_CODES.has(value.code as ApiError["code"]) &&
    typeof value.message === "string" &&
    (value.requestId === undefined || typeof value.requestId === "string")
  );
}
