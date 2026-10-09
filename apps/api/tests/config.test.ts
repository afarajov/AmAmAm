import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env.js";

describe("API configuration", () => {
  it("provides explicit local defaults", () => {
    expect(loadConfig({})).toEqual({
      host: "127.0.0.1",
      port: 8787,
      logLevel: "info",
      jsonBodyLimit: "512kb",
      shutdownTimeoutMs: 10_000,
      openaiModel: "gpt-4.1-mini",
      openaiEmbeddingModel: "text-embedding-3-small",
      openaiTimeoutMs: 20_000,
      corsAllowedOrigins: []
    });
  });

  it("rejects invalid numeric and logging settings", () => {
    expect(() => loadConfig({ PORT: "zero" })).toThrow("PORT must be a positive integer.");
    expect(() => loadConfig({ LOG_LEVEL: "verbose" })).toThrow("LOG_LEVEL must be debug, info, warn, or error.");
    expect(() => loadConfig({ OPENAI_TIMEOUT_MS: "0" })).toThrow("OPENAI_TIMEOUT_MS must be a positive integer.");
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
  });
});
