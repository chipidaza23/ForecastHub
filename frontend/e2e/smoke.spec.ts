import { test, expect } from "@playwright/test";

test.describe("Smoke tests", () => {
  test("page loads and title contains ForecastHub", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/ForecastHub/);
  });

  test("sidebar is visible on desktop", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("ForecastHub").first()).toBeVisible();
    await expect(page.getByText("Dashboard")).toBeVisible();
  });
});
