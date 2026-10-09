import { afterEach, describe, expect, it, vi } from "vitest";

import { checkAgentApiConnection } from "../src/background/apiClient";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("backend connection check", () => {
  it("accepts only the ContextLayer health response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: "ok",
      service: "contextlayer-api"
    }), { status: 200 })));
    await expect(checkAgentApiConnection()).resolves.toEqual({ status: "ready" });
  });

  it("reports an incompatible backend", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
    await expect(checkAgentApiConnection()).resolves.toEqual({ status: "invalid" });
  });

  it("reports an offline backend without exposing the exception", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("private network details")));
    await expect(checkAgentApiConnection()).resolves.toEqual({ status: "offline" });
  });

  it("reports a connection timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockImplementation((_url, options: RequestInit) => (
      new Promise((_resolve, reject) => {
        options.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      })
    )));
    const result = checkAgentApiConnection();
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(result).resolves.toEqual({ status: "timeout" });
  });
});
