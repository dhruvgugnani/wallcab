import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const previewSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1206" height="2622"><rect width="100%" height="100%" fill="#17221a"/></svg>';

test("configures, persists, and copies the exact wallpaper URL", async ({
  page,
  context,
}) => {
  await context.grantPermissions(
    ["clipboard-read", "clipboard-write"],
    { origin: "http://127.0.0.1:3000" },
  );
  await page.route("**/api/wallpaper**", async (route) => {
    await route.fulfill({ contentType: "image/svg+xml", body: previewSvg });
  });
  await page.goto("/");

  const configurator = page.locator("#make-yours");
  await configurator.getByText("Science", { exact: true }).click();
  await configurator.getByText("Space", { exact: true }).click();
  await configurator.getByText("iPhone 17 Pro Max", { exact: true }).click();
  await page.getByRole("button", { name: "Copy address" }).click();

  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("/api/wallpaper?category=science&theme=space&size=max");
  await page.reload();
  await expect(page.getByLabel("Science")).toBeChecked();
  await expect(page.getByLabel("Space")).toBeChecked();
  await expect(page.getByLabel("iPhone 17 Pro Max")).toBeChecked();
});

test("home and install have no serious accessibility violations", async ({
  page,
}) => {
  await page.route("**/api/wallpaper**", async (route) => {
    await route.fulfill({ contentType: "image/svg+xml", body: previewSvg });
  });

  for (const path of ["/", "/install"]) {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? ""),
      ),
    ).toEqual([]);
  }
});

test("launch routes render and mobile navigation is operable", async ({
  page,
}, testInfo) => {
  const routes = [
    "/gallery",
    "/roadmap",
    "/blog",
    "/docs",
    "/docs/api",
    "/docs/architecture",
    "/docs/self-hosting",
    "/docs/contributing",
    "/sources",
    "/privacy",
  ];

  await page.route("**/api/wallpaper**", async (route) => {
    await route.fulfill({ contentType: "image/svg+xml", body: previewSvg });
  });
  for (const path of routes) {
    await page.goto(path);
    await expect(page.locator("h1").first()).toBeVisible();
  }

  if (testInfo.project.name === "mobile") {
    await page.goto("/");
    await page.getByLabel("Open navigation").click();
    await expect(
      page.getByRole("navigation", { name: "Mobile navigation" }),
    ).toBeVisible();
  }
});

test("shows a recovery state when wallpaper generation fails", async ({
  page,
}) => {
  await page.route("**/api/wallpaper**", async (route) => {
    await route.fulfill({
      status: 502,
      contentType: "application/json",
      body: "{}",
    });
  });
  await page.goto("/");
  await page
    .getByRole("complementary", { name: "Live wallpaper preview" })
    .scrollIntoViewIfNeeded();
  await page
    .locator("#make-yours")
    .getByText("Science", { exact: true })
    .click();
  await expect(page.getByText("Preview paused")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("keeps the opening composition stable across responsive layouts", async ({
  page,
}, testInfo) => {
  await page.route("**/api/wallpaper**", async (route) => {
    await route.fulfill({ contentType: "image/svg+xml", body: previewSvg });
  });
  await page.goto("/");
  await expect(page).toHaveScreenshot(`home-opening-${testInfo.project.name}.png`, {
    animations: "disabled",
    fullPage: false,
  });
});
