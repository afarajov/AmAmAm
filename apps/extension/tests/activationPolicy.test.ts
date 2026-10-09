import { describe, expect, it } from "vitest";

import { isSupportedPage } from "../src/background/activationPolicy";

describe("extension activation policy", () => {
  it.each(["https://example.com", "http://localhost:4173/page"])("supports %s", (url) => {
    expect(isSupportedPage(url)).toBe(true);
  });

  it.each([undefined, "chrome://settings", "chrome-extension://abc/page.html", "file:///tmp/page.html", "not a url"])("rejects restricted page %s", (url) => {
    expect(isSupportedPage(url)).toBe(false);
  });
});
