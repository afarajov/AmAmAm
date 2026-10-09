export type LogLevel = "debug" | "info" | "warn" | "error";

export interface ApiConfig {
  host: string;
  port: number;
  logLevel: LogLevel;
  jsonBodyLimit: string;
  shutdownTimeoutMs: number;
  openaiApiKey?: string;
  openaiModel: string;
  openaiTimeoutMs: number;
  corsAllowedOrigins: string[];
}

function positiveInteger(name: string, value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function logLevel(value: string | undefined): LogLevel {
  const candidate = value ?? "info";
  if (["debug", "info", "warn", "error"].includes(candidate)) return candidate as LogLevel;
  throw new Error("LOG_LEVEL must be debug, info, warn, or error.");
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  const openaiApiKey = environment.OPENAI_API_KEY?.trim();
  return {
    host: environment.HOST?.trim() || "127.0.0.1",
    port: positiveInteger("PORT", environment.PORT, 8787),
    logLevel: logLevel(environment.LOG_LEVEL),
    jsonBodyLimit: environment.JSON_BODY_LIMIT?.trim() || "512kb",
    shutdownTimeoutMs: positiveInteger("SHUTDOWN_TIMEOUT_MS", environment.SHUTDOWN_TIMEOUT_MS, 10_000),
    ...(openaiApiKey ? { openaiApiKey } : {}),
    openaiModel: environment.OPENAI_MODEL?.trim() || "gpt-4.1-mini",
    openaiTimeoutMs: positiveInteger("OPENAI_TIMEOUT_MS", environment.OPENAI_TIMEOUT_MS, 20_000),
    corsAllowedOrigins: (environment.CORS_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  };
}
