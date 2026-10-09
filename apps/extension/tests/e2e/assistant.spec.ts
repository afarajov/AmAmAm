import { expect, test } from "@playwright/test";

test("shows references, action results, navigation, and local reset", async ({ page }) => {
  await page.goto("/tests/e2e/fixture.html");

  await page.getByRole("button", { name: "Open ContextLayer assistant" }).click();
  await page.getByPlaceholder("Message ContextLayer").fill("Find the privacy controls");
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.getByText("I found relevant content")).toBeVisible();
  await expect(page.getByLabel("Sources")).toContainText("Privacy controls");
  await expect(page.getByLabel("Action results")).toContainText("HIGHLIGHT");
  await expect(page.locator("#target")).toHaveClass(/contextlayer-engine-highlight/);

  const resetButton = page.getByRole("button", { name: "Reset page changes" });
  await expect(resetButton).toBeEnabled();

  await page.getByLabel("Sources").getByRole("button").click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect(page.getByLabel("Action results")).toContainText("SCROLL TO");

  await resetButton.click();
  await expect(page.locator("#target")).not.toHaveClass(/contextlayer-engine-highlight/);
  await expect(resetButton).toBeDisabled();
  await expect(page.getByText("Page changes were reset.")).toBeVisible();
  await expect(page.getByLabel("Action results").last()).toContainText("RESTORE ALL");
});

test("does not present a failed highlight as successful", async ({ page }) => {
  await page.goto("/tests/e2e/fixture.html");

  await page.getByRole("button", { name: "Open ContextLayer assistant" }).click();
  await page.getByPlaceholder("Message ContextLayer").fill("Highlight a missing element");
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.getByText("I could not apply the requested page changes.")).toBeVisible();
  await expect(page.getByText("Highlighted the matching content.")).toHaveCount(0);
  await expect(page.getByLabel("Action results")).toContainText("HIGHLIGHT");
  await expect(page.getByLabel("Action results")).toContainText("Unknown element ID");
  await expect(page.getByRole("button", { name: "Reset page changes" })).toBeDisabled();
});
