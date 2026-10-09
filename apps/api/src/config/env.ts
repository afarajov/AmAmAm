export type LogLevel = "debug" | "info" | "warn" | "error";
export type NodeEnvironment = "development" | "test" | "production";

export interface ApiConfig {
  nodeEnv: NodeEnvironment;
  host: string;
  port: number;
  logLevel: LogLevel;
  jsonBodyLimit: string;
  shutdownTimeoutMs: number;
  openaiApiKey?: string;
  openaiModel: string;
  openaiEmbeddingModel: string;
  openaiTimeoutMs: number;
  openaiMaxRetries: number;
  corsAllowedOrigins: string[];
  maxSnapshotElements: number;
  maxSnapshotTextCharacters: number;
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

function bodyLimit(value: string | undefined): string {
  const candidate = value?.trim() || "512kb";
  if (!/^[1-9]\d*(?:b|kb|mb)$/iu.test(candidate)) {
    throw new Error("JSON_BODY_LIMIT must be a positive byte, kb, or mb value.");
  }
  return candidate;
}

function nodeEnvironment(value: string | undefined): NodeEnvironment {
  const candidate = value?.trim() || "development";
  if (["development", "test", "production"].includes(candidate)) {
    return candidate as NodeEnvironment;
  }
  throw new Error("NODE_ENV must be development, test, or production.");
}

function boundedInteger(
  name: string,
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

function allowedOrigins(value: string | undefined): string[] {
  const origins = (value ?? "").split(",").map((origin) => origin.trim()).filter(Boolean);
  for (const origin of origins) {
    if (origin === "*" || !/^(https?:\/\/|chrome-extension:\/\/)[^/]+$/u.test(origin)) {
      throw new Error("CORS_ALLOWED_ORIGINS must contain explicit HTTP(S) or chrome-extension origins.");
    }
  }
  return [...new Set(origins)];
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  const currentNodeEnvironment = nodeEnvironment(environment.NODE_ENV);
  const openaiApiKey = environment.OPENAI_API_KEY?.trim();
  const corsAllowedOrigins = allowedOrigins(environment.CORS_ALLOWED_ORIGINS);
  if (currentNodeEnvironment === "production" && !openaiApiKey) {
    throw new Error("OPENAI_API_KEY is required in production.");
  }
  if (currentNodeEnvironment === "production" && corsAllowedOrigins.length === 0) {
    throw new Error("CORS_ALLOWED_ORIGINS is required in production.");
  }
  return {
    nodeEnv: currentNodeEnvironment,
    host: environment.HOST?.trim() || "127.0.0.1",
    port: boundedInteger("PORT", environment.PORT, 8787, 1, 65_535),
    logLevel: logLevel(environment.LOG_LEVEL),
    jsonBodyLimit: bodyLimit(environment.JSON_BODY_LIMIT),
    shutdownTimeoutMs: positiveInteger("SHUTDOWN_TIMEOUT_MS", environment.SHUTDOWN_TIMEOUT_MS, 10_000),
    ...(openaiApiKey ? { openaiApiKey } : {}),
    openaiModel: environment.OPENAI_MODEL?.trim() || "gpt-4.1-mini",
    openaiEmbeddingModel: environment.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small",
    openaiTimeoutMs: positiveInteger("OPENAI_TIMEOUT_MS", environment.OPENAI_TIMEOUT_MS, 20_000),
    openaiMaxRetries: boundedInteger("OPENAI_MAX_RETRIES", environment.OPENAI_MAX_RETRIES, 1, 0, 2),
    corsAllowedOrigins,
    maxSnapshotElements: boundedInteger(
      "MAX_SNAPSHOT_ELEMENTS", environment.MAX_SNAPSHOT_ELEMENTS, 300, 1, 300
    ),
    maxSnapshotTextCharacters: boundedInteger(
      "MAX_SNAPSHOT_TEXT_CHARACTERS", environment.MAX_SNAPSHOT_TEXT_CHARACTERS, 120_000, 1_000, 1_200_000
    )
  };
}
