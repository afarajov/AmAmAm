import { describe, expect, it } from "vitest";

import { DEFAULT_API_ORIGIN, normalizeApiOrigin } from "../build/apiOrigin";

describe("production API origin", () => {
  it("uses one explicit default origin", () => {
    expect(normalizeApiOrigin(undefined)).toBe(DEFAULT_API_ORIGIN);
  });

  it("normalizes a valid HTTPS origin", () => {
    expect(normalizeApiOrigin("https://api.example.com:8443")).toBe("https://api.example.com:8443");
  });

  it.each([
    "not-a-url",
    "ftp://api.example.com",
    "https://user:secret@api.example.com",
    "https://api.example.com/v1",
    "https://api.example.com?token=secret",
    "https://api.example.com/#fragment"
  ])("rejects invalid or over-broad configuration: %s", (value) => {
    expect(() => normalizeApiOrigin(value)).toThrow(/origin/);
  });
});
