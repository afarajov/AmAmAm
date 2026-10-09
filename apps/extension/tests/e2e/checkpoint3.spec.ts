import { expect, test } from "@playwright/test";

async function openAssistant(page: import("@playwright/test").Page): Promise<void> {
  await page.getByRole("button", { name: "Open ContextLayer assistant" }).click();
}

async function submit(page: import("@playwright/test").Page, query: string): Promise<void> {
  await page.getByPlaceholder("Message ContextLayer").fill(query);
  await page.getByRole("button", { name: "Send message" }).click();
}

test("extracts and navigates to an Instagram-like nested caption", async ({ page }) => {
  await page.goto("/tests/e2e/instagram-fixture.html");
  await openAssistant(page);
  await submit(page, "Что написано в подписи?");

  const sources = page.getByLabel("Sources");
  await expect(sources).toContainText("Sunset walk in Baku");
  await expect(page.locator("article")).toHaveClass(/contextlayer-engine-highlight/);

  await sources.getByRole("button").click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect(page.getByLabel("Action results")).toContainText("SCROLL TO");
});

test("clears old context across SPA posts and supports a repeated query", async ({ page }) => {
  await page.goto("/tests/e2e/spa-fixture.html");
  await openAssistant(page);
  await submit(page, "Describe this post");
  await expect(page.getByLabel("Sources")).toContainText("First post");

  await page.locator("#next-post").click();
  await expect(page).toHaveURL(/\/post\/two$/);
  await expect(page.getByText("Page changed. Previous context was cleared.")).toBeVisible();
  await expect(page.getByLabel("Sources")).toHaveCount(0);

  await submit(page, "Describe this post");
  await expect(page.getByLabel("Sources")).toContainText("Second post");
  await expect(page.getByLabel("Sources")).not.toContainText("First post");

  await submit(page, "Describe this post again");
  await expect(page.locator(".contextlayer-message--user")).toHaveCount(2);
  await expect(page.getByLabel("Sources")).toHaveCount(2);
});

test("recovers from a stale snapshot with a fresh scan", async ({ page }) => {
  await page.goto("/tests/e2e/instagram-fixture.html");
  await openAssistant(page);
  await submit(page, "Recover from stale snapshot");

  await expect(
    page.getByText("The page changed during processing and was rescanned.")
  ).toBeVisible();
  await expect(page.getByLabel("Sources")).toContainText("Sunset walk in Baku");
  await expect(page.getByLabel("Action results")).toContainText("HIGHLIGHT");
  await expect(page.locator("article")).toHaveClass(/contextlayer-engine-highlight/);
});

test("shows a clear backend timeout state", async ({ page }) => {
  await page.goto("/tests/e2e/instagram-fixture.html");
  await openAssistant(page);
  await submit(page, "Simulate backend timeout");

  await expect(page.getByRole("alert")).toContainText(
    "The AI backend took too long to respond"
  );
  await expect(page.getByLabel("Sources")).toHaveCount(0);
});

test("reports NOT_FOUND without inventing references", async ({ page }) => {
  await page.goto("/tests/e2e/empty-fixture.html");
  await openAssistant(page);
  await submit(page, "What is on this page?");

  await expect(page.getByRole("alert")).toContainText("No readable page text was found");
  await expect(page.getByLabel("Sources")).toHaveCount(0);
  await expect(page.getByLabel("Action results")).toHaveCount(0);
});
