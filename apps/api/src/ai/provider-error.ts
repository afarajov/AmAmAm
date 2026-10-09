import { HttpError } from "../errors/api-error.js";

export function mapOpenAIProviderError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;

  const status = numericProperty(error, "status");
  const code = stringProperty(error, "code");
  const name = error instanceof Error ? error.name : "";

  if (status === 429) {
    return new HttpError(429, "RATE_LIMITED", "The AI provider rate limit was reached.");
  }
  if (
    status === 408 ||
    name.includes("Timeout") ||
    code === "ETIMEDOUT" ||
    code === "request_timeout"
  ) {
    return new HttpError(504, "MODEL_TIMEOUT", "The AI provider timed out.");
  }
  return new HttpError(502, "MODEL_ERROR", "The AI provider request failed.");
}

function numericProperty(value: unknown, key: string): number | undefined {
  if (typeof value !== "object" || value === null || !(key in value)) return undefined;
  const candidate = value[key as keyof typeof value];
  return typeof candidate === "number" ? candidate : undefined;
}

function stringProperty(value: unknown, key: string): string | undefined {
  if (typeof value !== "object" || value === null || !(key in value)) return undefined;
  const candidate = value[key as keyof typeof value];
  return typeof candidate === "string" ? candidate : undefined;
}
