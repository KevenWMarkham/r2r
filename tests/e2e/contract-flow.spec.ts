import { test, expect } from "@playwright/test";

// Canned-mode E2E: upload disabled, but all 5 Acme contracts are pre-loaded via
// fixtures. This test walks the full agent chain: queue → review → run → accrual.

test.describe("NOAH Prototype — canned mode", () => {
  test("Close Cockpit renders and simulation can start", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Close Cockpit");
    await expect(page.getByRole("button", { name: /start/i })).toBeEnabled();
  });

  test("Contract queue lists all 5 Acme contracts", async ({ page }) => {
    await page.goto("/contracts");
    await expect(page.locator("h1")).toContainText("Contracts");

    for (const name of [
      "Contract_1_Advertising_Campaign",
      "Contract_2_Professional_Services_Outsourcing",
      "Contract_3_Insurance_MultiYear",
      "Contract_4_Construction_Retail_Remodel",
      "Contract_5_AWS_Enterprise",
    ]) {
      await expect(page.getByText(name)).toBeVisible();
    }
  });

  test("Contract review → full chain → accrual with deterministic JE", async ({ page }) => {
    await page.goto("/contracts");
    await page.getByText("Contract_1_Advertising_Campaign").click();
    await expect(page.locator("h1")).toContainText("Advertising_Campaign");

    // Run the full agent chain (canned delays ~400-700ms per step)
    await page.getByRole("button", { name: /run full chain/i }).click();
    await expect(page.getByRole("button", { name: /run full chain/i })).toBeEnabled({
      timeout: 30_000,
    });

    // Attributes should be visible
    await expect(page.getByText("Wieden+Kennedy LLC")).toBeVisible();

    // Risk panel should show High|Medium|Low
    await expect(page.getByText(/Risk/).first()).toBeVisible();

    // Navigate to Accrual
    await page.getByRole("link", { name: /accrual/i }).click();
    await expect(page.locator("h1")).toContainText("Accrual Proposal");

    await page.getByRole("button", { name: /compute accrual/i }).click();
    await expect(page.getByText(/Proposed Journal Entry/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Services Expense")).toBeVisible();
    await expect(page.getByText("Accrued Liabilities")).toBeVisible();

    // Approve
    await page.getByRole("button", { name: /approve/i }).click();
    await expect(page.getByText(/audit event written/i)).toBeVisible({ timeout: 5_000 });
  });

  test("Narrative Variance Commentary tab generates prose", async ({ page }) => {
    await page.goto("/narrative");
    await expect(page.getByRole("button", { name: /variance commentary/i })).toBeVisible();

    await page.getByRole("button", { name: /generate all/i }).click();
    // At least one commentary should render
    await expect(page.getByText(/\+\$135M|+5\.0%|volume \+3%/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("Narrative Exec Summary tab generates summary", async ({ page }) => {
    await page.goto("/narrative?tab=exec");
    await page.getByRole("button", { name: /generate/i }).first().click();
    await expect(page.getByText(/Recommendation/i)).toBeVisible({ timeout: 10_000 });
  });
});
