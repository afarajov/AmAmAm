import { describe, expect, it } from "vitest";
import { HttpError } from "../src/errors/api-error.js";
import { mapOpenAIProviderError } from "../src/ai/provider-error.js";

describe("OpenAI provider errors", () => {
  it("maps rate limits without retrying them at the application layer", () => {
    expect(mapOpenAIProviderError({ status: 429, code: "slow_down" })).toMatchObject({
      status: 429,
      code: "RATE_LIMITED"
    });
  });

  it("maps timeout status, names, and codes consistently", () => {
    expect(mapOpenAIProviderError({ status: 408 })).toMatchObject({
      status: 504,
      code: "MODEL_TIMEOUT"
    });
    expect(mapOpenAIProviderError(Object.assign(new Error("late"), {
      name: "APITimeoutError"
    }))).toMatchObject({ status: 504, code: "MODEL_TIMEOUT" });
    expect(mapOpenAIProviderError({ code: "ETIMEDOUT" })).toMatchObject({
      status: 504,
      code: "MODEL_TIMEOUT"
    });
  });

  it("preserves known API errors and hides unknown provider details", () => {
    const known = new HttpError(429, "RATE_LIMITED", "Known");
    expect(mapOpenAIProviderError(known)).toBe(known);
    expect(mapOpenAIProviderError(new Error("secret provider detail"))).toMatchObject({
      status: 502,
      code: "MODEL_ERROR",
      message: "The AI provider request failed."
    });
  });
});
