import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env.js";

describe("API configuration", () => {
  it("provides explicit local defaults", () => {
    expect(loadConfig({})).toEqual({
      nodeEnv: "development",
      host: "127.0.0.1",
      port: 8787,
      logLevel: "info",
      jsonBodyLimit: "512kb",
      shutdownTimeoutMs: 10_000,
      openaiModel: "gpt-4.1-mini",
      openaiEmbeddingModel: "text-embedding-3-small",
      openaiTimeoutMs: 20_000,
      openaiMaxRetries: 1,
      corsAllowedOrigins: [],
      maxSnapshotElements: 300,
      maxSnapshotTextCharacters: 120_000
    });
  });

  it("rejects invalid numeric and logging settings", () => {
    expect(() => loadConfig({ PORT: "zero" })).toThrow("PORT must be an integer between 1 and 65535.");
    expect(() => loadConfig({ PORT: "65536" })).toThrow("PORT must be an integer between 1 and 65535.");
    expect(() => loadConfig({ JSON_BODY_LIMIT: "unlimited" })).toThrow("JSON_BODY_LIMIT");
    expect(() => loadConfig({ LOG_LEVEL: "verbose" })).toThrow("LOG_LEVEL must be debug, info, warn, or error.");
    expect(() => loadConfig({ OPENAI_TIMEOUT_MS: "0" })).toThrow("OPENAI_TIMEOUT_MS must be a positive integer.");
    expect(() => loadConfig({ OPENAI_MAX_RETRIES: "3" })).toThrow("OPENAI_MAX_RETRIES");
    expect(() => loadConfig({ MAX_SNAPSHOT_ELEMENTS: "301" })).toThrow("MAX_SNAPSHOT_ELEMENTS");
    expect(() => loadConfig({ NODE_ENV: "staging" })).toThrow("NODE_ENV");
  });

  it("loads AI settings without exposing a default credential", () => {
    expect(loadConfig({
      OPENAI_API_KEY: " secret ",
      OPENAI_MODEL: "gpt-test",
      OPENAI_EMBEDDING_MODEL: "embedding-test"
    })).toMatchObject({
      openaiApiKey: "secret",
      openaiModel: "gpt-test",
      openaiEmbeddingModel: "embedding-test"
    });
    expect(loadConfig({}).openaiApiKey).toBeUndefined();
  });

  it("parses an explicit allowlist of browser origins", () => {
    expect(loadConfig({ CORS_ALLOWED_ORIGINS: "chrome-extension://one, https://app.example " })
      .corsAllowedOrigins).toEqual(["chrome-extension://one", "https://app.example"]);
    expect(() => loadConfig({ CORS_ALLOWED_ORIGINS: "*" })).toThrow("explicit HTTP(S)");
    expect(() => loadConfig({ CORS_ALLOWED_ORIGINS: "https://app.example/path" })).toThrow("explicit HTTP(S)");
  });

  it("requires credentials and an origin allowlist in production", () => {
    expect(() => loadConfig({ NODE_ENV: "production" })).toThrow("OPENAI_API_KEY");
    expect(() => loadConfig({ NODE_ENV: "production", OPENAI_API_KEY: "secret" }))
      .toThrow("CORS_ALLOWED_ORIGINS");
    expect(loadConfig({
      NODE_ENV: "production",
      OPENAI_API_KEY: "secret",
      CORS_ALLOWED_ORIGINS: "chrome-extension://release"
    })).toMatchObject({ nodeEnv: "production", openaiApiKey: "secret" });
  });
});
