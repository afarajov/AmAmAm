import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env.js";

describe("API configuration", () => {
  it("provides explicit local defaults", () => {
    expect(loadConfig({})).toEqual({
      host: "127.0.0.1",
      port: 8787,
      logLevel: "info",
      jsonBodyLimit: "512kb",
      shutdownTimeoutMs: 10_000
    });
  });

  it("rejects invalid numeric and logging settings", () => {
    expect(() => loadConfig({ PORT: "zero" })).toThrow("PORT must be a positive integer.");
    expect(() => loadConfig({ LOG_LEVEL: "verbose" })).toThrow("LOG_LEVEL must be debug, info, warn, or error.");
  });
});
