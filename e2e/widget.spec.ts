import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

async function ask(page: Page, question: string) {
  const widget = page.locator("murmur-chat");
  if (await widget.locator(".launcher").isVisible()) await widget.locator(".launcher").click();
  const input = widget.getByRole("textbox");
  await input.fill(question);
  await input.press("Enter");
  return widget;
}

test.describe("on a host page, without an index", () => {
  test("reads the page, speaks its language and cites its heading", async ({ page }) => {
    await page.goto("/page.html");
    await expect(page.locator("murmur-chat .launcher")).toHaveText("Poser une question");
    const widget = await ask(page, "Quels sont les horaires ?");
    await expect(widget.getByRole("dialog", { name: "Demandez au site" })).toBeVisible();
    const source = widget.locator("ol.sources a").first();
    await expect(source).toContainText("Horaires");
    await expect(source).toHaveAttribute("href", /#horaires$/);
  });

  test("keeps the conversation and the open panel across a reload", async ({ page }) => {
    await page.goto("/page.html");
    const widget = await ask(page, "Commandes de gâteaux ?");
    await expect(widget.getByRole("log")).toContainText("one script tag");
    await page.reload();
    await expect(page.locator("murmur-chat").getByRole("log")).toContainText(
      "Commandes de gâteaux ?",
    );
    await expect(page.locator("murmur-chat").getByRole("dialog")).toBeVisible();
  });

  test("Escape closes the panel and gives focus back to the bubble", async ({ page }) => {
    await page.goto("/page.html");
    await page.locator("murmur-chat .launcher").click();
    await expect(page.locator("murmur-chat").getByRole("textbox")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.locator("murmur-chat").getByRole("dialog")).toBeHidden();
    await expect(page.locator("murmur-chat .launcher")).toBeFocused();
  });

  test("a refused key shows the reason and a retry", async ({ page }) => {
    await page.goto("/page.html?model=fail-401");
    const widget = await ask(page, "Horaires ?");
    const alert = widget.getByRole("alert");
    await expect(alert).toContainText("clé");
    await expect(alert.getByRole("button", { name: "Réessayer" })).toBeVisible();
  });

  test("Stop ends a streaming answer and the widget stays usable", async ({ page }) => {
    await page.goto("/page.html?model=slow");
    const widget = await ask(page, "Horaires ?");
    const stop = widget.getByRole("button", { name: "Arrêter" });
    await expect(stop).toBeVisible();
    await expect(widget.getByRole("log")).toContainText("From");
    await stop.click();
    await expect(widget.getByRole("button", { name: "Envoyer" })).toBeVisible();
    await expect(widget.getByRole("alert")).toHaveCount(0);
    const text = await widget.locator(".msg.bot").last().textContent();
    expect(text).not.toContain("never sits in the page");
  });

  test("sources are numbered in the order the answer cites them", async ({ page }) => {
    await page.goto("/page.html?model=late");
    const widget = await ask(page, "Horaires et commandes ?");
    const answer = widget.locator(".msg.bot").last();
    await expect(answer.locator("ol.sources li")).toHaveCount(2);
    expect(await answer.locator("p a.cite").allTextContents()).toEqual(["1", "2", "1"]);
    expect(await answer.locator("ol.sources .cite").allTextContents()).toEqual(["1", "2"]);
  });

  test("never shows a source number the list does not carry", async ({ page }) => {
    await page.goto("/page.html?model=stray");
    const widget = await ask(page, "Horaires et commandes ?");
    const answer = widget.locator(".msg.bot").last();
    await expect(answer.locator("ol.sources li")).toHaveCount(1);
    expect(await answer.locator("p a.cite").allTextContents()).toEqual(["1"]);
    expect(await answer.locator("p").first().textContent()).not.toContain("[");
  });

  test("fills the screen on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/page.html");
    await page.locator("murmur-chat .launcher").click();
    const box = await page.locator("murmur-chat .panel").boundingBox();
    const viewport = await page.evaluate(() => [document.documentElement.clientWidth, innerHeight]);
    expect(box?.width).toBeCloseTo(viewport[0] ?? 0, 0);
    expect(box?.height).toBeCloseTo(viewport[1] ?? 0, 0);
  });
});

test.describe("accessibility (axe, WCAG 2.2 AA)", () => {
  for (const path of [
    "/murmur/",
    "/murmur/fr/",
    "/murmur/guide.html",
    "/murmur/playground.html",
    "/page.html",
  ]) {
    test(path, async ({ page }) => {
      await page.route(/models\.dev|openrouter\.ai/, (r) => r.abort());
      await page.goto(path);
      await page.waitForTimeout(300);
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const serious = violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
      expect(serious).toEqual([]);
    });
  }
});
