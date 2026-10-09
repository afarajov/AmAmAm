import { expect, test, type Page } from "@playwright/test";

async function openFixture(page: Page): Promise<void> {
  await page.goto("/tests/e2e/actions-fixture.html");
  await page.getByRole("button", { name: "Open ContextLayer assistant" }).click();
}

async function submit(page: Page, query: string): Promise<void> {
  await page.getByPlaceholder("Message ContextLayer").fill(query);
  await page.getByRole("button", { name: "Send message" }).click();
}

test("factual query returns an answer without changing the DOM", async ({ page }) => {
  await openFixture(page);
  await submit(page, "Factual query");

  await expect(page.getByText("This is a grounded factual answer.")).toBeVisible();
  await expect(page.getByLabel("Action results")).toHaveCount(0);
  await expect(page.locator("[class*='contextlayer-engine-']")).toHaveCount(0);
});

for (const scenario of [
  { query: "Highlight target", className: "contextlayer-engine-highlight", label: "HIGHLIGHT", summary: "Highlighted 1 element." },
  { query: "Dim target", className: "contextlayer-engine-dim", label: "DIM", summary: "Dimmed 1 element." },
  { query: "Strike target", className: "contextlayer-engine-strike", label: "STRIKE", summary: "Struck through 1 element." },
  { query: "Hide target", className: "contextlayer-engine-hidden", label: "HIDE", summary: "Hidden 1 element." }
]) {
  test(`${scenario.label} changes the real target and reports browser success`, async ({ page }) => {
    await openFixture(page);
    await submit(page, scenario.query);

    await expect(page.locator("#primary")).toHaveClass(new RegExp(scenario.className));
    const results = page.getByLabel("Action results");
    await expect(results).toContainText(scenario.label);
    await expect(results).toContainText(scenario.summary);
    await expect(page.getByRole("button", { name: "Reset page changes" })).toBeEnabled();
  });
}

test("CLEAR_EFFECT removes the selected element effect", async ({ page }) => {
  await openFixture(page);
  await submit(page, "Clear effect target");

  await expect(page.locator("#primary")).not.toHaveClass(/contextlayer-engine-highlight/);
  await expect(page.getByLabel("Action results")).toContainText("CLEAR EFFECT");
  await expect(page.getByLabel("Action results")).toContainText("Cleared effects from 1 element.");
  await expect(page.getByRole("button", { name: "Reset page changes" })).toBeDisabled();
});

test("RESTORE_ALL removes every effect applied in the action plan", async ({ page }) => {
  await openFixture(page);
  await submit(page, "Restore all effects");

  await expect(page.locator("#primary")).not.toHaveClass(/contextlayer-engine-highlight/);
  await expect(page.locator("#secondary")).not.toHaveClass(/contextlayer-engine-dim/);
  await expect(page.locator("[data-contextlayer-engine-styles]")).toHaveCount(0);
  await expect(page.getByLabel("Action results")).toContainText("RESTORE ALL");
  await expect(page.getByLabel("Action results")).toContainText("Restored 2 elements.");
  await expect(page.getByRole("button", { name: "Reset page changes" })).toBeDisabled();
});

test("source navigation keeps only the latest HIGHLIGHT and SCROLL_TO results", async ({ page }) => {
  await openFixture(page);
  await submit(page, "Find John Deacon");

  const source = page.getByLabel("Sources").getByRole("button");
  await source.click();
  await source.click();

  const results = page.getByLabel("Action results");
  await expect(results.locator(".contextlayer-result")).toHaveCount(2);
  await expect(results.getByText("HIGHLIGHT", { exact: true })).toHaveCount(1);
  await expect(results.getByText("SCROLL TO", { exact: true })).toHaveCount(1);
  await expect(page.locator("#primary")).toHaveClass(/contextlayer-engine-highlight/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});

test("partial action failure reports both affected and failed counts without node IDs", async ({ page }) => {
  await openFixture(page);
  await submit(page, "Partial highlight");

  const results = page.getByLabel("Action results");
  await expect(page.locator("#primary")).toHaveClass(/contextlayer-engine-highlight/);
  await expect(results).toContainText("Highlighted 1 element; 1 failed.");
  await expect(results).toContainText("A target was not found in the current page.");
  await expect(results).not.toContainText(/node-\d+/);
  await expect(page.getByRole("button", { name: "Reset page changes" })).toBeEnabled();
});

test("a second stale snapshot stops with a clear error and no stale results", async ({ page }) => {
  await openFixture(page);
  await submit(page, "Repeat stale snapshot");

  await expect(page.getByRole("alert")).toContainText("A new scan is required");
  await expect(page.getByLabel("Sources")).toHaveCount(0);
  await expect(page.getByLabel("Action results")).toHaveCount(0);
  await expect(page.locator("#primary")).not.toHaveClass(/contextlayer-engine-highlight/);
});

test("route change during a request discards the old response", async ({ page }) => {
  await page.goto("/tests/e2e/spa-fixture.html");
  await page.getByRole("button", { name: "Open ContextLayer assistant" }).click();
  await submit(page, "Describe this post");
  await page.locator("#next-post").click();

  await expect(page).toHaveURL(/\/post\/two$/);
  await expect(page.getByRole("alert")).toContainText("The page changed");
  await expect(page.getByLabel("Sources")).toHaveCount(0);
  await expect(page.getByLabel("Action results")).toHaveCount(0);
});

test("double submit produces one request lifecycle", async ({ page }) => {
  await openFixture(page);
  await page.getByPlaceholder("Message ContextLayer").fill("Factual query");
  await page.evaluate(() => {
    const host = document.querySelector("[data-contextlayer-ui]");
    const form = host?.shadowRoot?.querySelector("form");
    form?.requestSubmit();
    form?.requestSubmit();
  });

  await expect(page.getByText("This is a grounded factual answer.")).toHaveCount(1);
  await expect(page.locator(".contextlayer-message--user")).toHaveCount(1);
});

test("retry runs the same request again without duplicating the user message", async ({ page }) => {
  await openFixture(page);
  await submit(page, "Factual query");

  await page.getByRole("button", { name: "Try answer again" }).click();

  await expect(page.getByText("This is a grounded factual answer.")).toHaveCount(2);
  await expect(page.locator(".contextlayer-message--user")).toHaveCount(1);
});

test("malformed response is rejected before any DOM action", async ({ page }) => {
  await openFixture(page);
  await submit(page, "Simulate malformed response");

  await expect(page.getByRole("alert")).toContainText("invalid response");
  await expect(page.getByRole("alert")).toContainText("No page action was run");
  await expect(page.getByLabel("Action results")).toHaveCount(0);
  await expect(page.locator("[class*='contextlayer-engine-']")).toHaveCount(0);
});

test("backend error is distinct and does not execute an action", async ({ page }) => {
  await openFixture(page);
  await submit(page, "Simulate backend error");

  await expect(page.getByRole("alert")).toContainText(
    "The AI backend could not prepare the request"
  );
  await expect(page.getByLabel("Action results")).toHaveCount(0);
  await expect(page.locator("[class*='contextlayer-engine-']")).toHaveCount(0);
});
