import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const previewSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1206" height="2622"><rect width="100%" height="100%" fill="#17221a"/></svg>';

async function mockWallpaperApi(page: Page) {
  await page.route("**/api/wallpaper**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/status")) {
      const categories =
        url.searchParams.get("categories")?.split(",") ?? ["vocabulary"];
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          resolvedCategory: categories.includes("science")
            ? "science"
            : categories[0],
          content: { mode: "external", provider: "Wikimedia" },
        }),
      });
      return;
    }
    await route.fulfill({ contentType: "image/svg+xml", body: previewSvg });
  });
}

test("configures, persists, and copies the exact wallpaper URL", async ({
  page,
  context,
}) => {
  await context.grantPermissions(
    ["clipboard-read", "clipboard-write"],
    { origin: "http://127.0.0.1:3000" },
  );
  await mockWallpaperApi(page);
  await page.goto("/");

  const configurator = page.locator("#make-yours");
  await configurator.getByLabel("Science").locator("..").click();
  await configurator.getByLabel("History").locator("..").click();
  await configurator.getByLabel("Vocabulary").locator("..").click();
  await expect(configurator.getByText("Daily photography")).toBeVisible();
  await expect(configurator.getByText("WallCab Originals")).toBeVisible();
  await expect(configurator.getByText("Your own background")).toBeVisible();
  await configurator.getByLabel("Grid").locator("..").click();
  await expect(
    configurator.getByLabel("Grid").locator("..").getByText("Fixed design"),
  ).toBeVisible();
  await configurator
    .getByLabel("iPhone 17 Pro Max")
    .locator("..")
    .click();
  await configurator
    .getByLabel("Personal note")
    .fill("Property of Dhruv");
  await expect(configurator.getByText("External · Wikimedia")).toBeVisible();
  await page.getByRole("button", { name: "Copy address" }).click();

  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("note=Property+of+Dhruv");
  const clipboardUrl = new URL(
    await page.evaluate(() => navigator.clipboard.readText()),
  );
  expect(clipboardUrl.pathname).toBe("/api/wallpaper");
  expect(clipboardUrl.searchParams.get("categories")).toBe(
    "science,history",
  );
  expect(clipboardUrl.searchParams.get("theme")).toBe("grid");
  expect(clipboardUrl.searchParams.get("size")).toBe("max");
  expect(clipboardUrl.searchParams.get("note")).toBe("Property of Dhruv");
  await page.reload();
  await expect(page.getByLabel("Science")).toBeChecked();
  await expect(page.getByLabel("History")).toBeChecked();
  await expect(page.getByLabel("Vocabulary")).not.toBeChecked();
  await expect(page.getByLabel("Grid")).toBeChecked();
  await expect(page.getByLabel("iPhone 17 Pro Max")).toBeChecked();
  await expect(page.getByLabel("Personal note")).toHaveValue(
    "Property of Dhruv",
  );
});

test("home and install have no serious accessibility violations", async ({
  page,
}) => {
  await mockWallpaperApi(page);

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

test("shows the complete illustrated iPhone installation guide", async ({
  page,
}) => {
  await page.goto("/install");

  await expect(
    page.getByRole("heading", {
      name: "Build it on your iPhone, tap by tap.",
    }),
  ).toBeVisible();
  await expect(page.locator(".install-shot")).toHaveCount(6);
  await expect(
    page.getByAltText(
      "Apple Shortcuts Personal Automation screen with Time of Day at the top",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Choose the Lock Screen and test it",
    }),
  ).toBeVisible();
  await expect(page.getByText("Turn Legibility Blur off.")).toBeVisible();
  const screenshots = page.locator(".install-shot img");
  for (const screenshot of await screenshots.all()) {
    await screenshot.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        screenshot.evaluate(
          (image) =>
            (image as HTMLImageElement).complete &&
            (image as HTMLImageElement).naturalWidth > 0,
        ),
      )
      .toBe(true);
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
    "/custom-background/delete",
  ];

  await mockWallpaperApi(page);
  for (const path of routes) {
    await page.goto(path);
    await expect(page.locator("h1").first()).toBeVisible();
  }

  await page.goto("/custom-background/delete");
  await expect(
    page.getByRole("heading", { name: "This deletion link is incomplete." }),
  ).toBeVisible();

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
  await expect(page.getByText("Preview paused")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("does not overflow horizontally on narrow phone screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await mockWallpaperApi(page);

  for (const path of ["/", "/install"]) {
    await page.goto(path);
    const width = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));

    expect(width.content).toBe(width.viewport);
  }
});

test("keeps the live phone visible through the address builder", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "mobile");
  await mockWallpaperApi(page);
  await page.goto("/");
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
  });

  const positions = await page.locator(".configurator").evaluate((element) => {
    const configurator = element.getBoundingClientRect();
    const sticky = element.querySelector(".preview-sticky");
    if (!sticky) throw new Error("Missing sticky preview");
    const stickyHeight = sticky.getBoundingClientRect().height;
    const top = configurator.top + window.scrollY;
    return {
      first: top + 300,
      second: Math.min(top + 900, top + configurator.height - stickyHeight - 80),
    };
  });

  await page.evaluate((scrollTop) => window.scrollTo(0, scrollTop), positions.first);
  await expect
    .poll(() =>
      page.locator(".preview-sticky").evaluate((element) =>
        Math.round(element.getBoundingClientRect().top),
      ),
    )
    .toBeLessThan(40);
  const firstTop = await page
    .locator(".preview-sticky")
    .evaluate((element) => Math.round(element.getBoundingClientRect().top));

  await page.evaluate((scrollTop) => window.scrollTo(0, scrollTop), positions.second);
  await expect
    .poll(() =>
      page.locator(".preview-sticky").evaluate((element) =>
        Math.round(element.getBoundingClientRect().top),
      ),
    )
    .toBe(firstTop);
});

test("keeps the opening composition stable across responsive layouts", async ({
  page,
}, testInfo) => {
  await mockWallpaperApi(page);
  await page.goto("/");
  await expect(page).toHaveScreenshot(`home-opening-${testInfo.project.name}.png`, {
    animations: "disabled",
    fullPage: false,
    maxDiffPixelRatio: 0.015,
  });
});
