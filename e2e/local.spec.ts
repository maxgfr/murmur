import { expect, type Page, test } from "@playwright/test";

/** Pretend the browser has (or lacks) a WebGPU adapter, so no test ever downloads the weights. */
async function webgpu(page: Page, available: boolean) {
  await page.addInitScript((on) => {
    Object.defineProperty(navigator, "gpu", {
      configurable: true,
      value: on ? { requestAdapter: async () => ({}) } : undefined,
    });
  }, available);
}

async function ask(page: Page, question: string) {
  const widget = page.locator("murmur-chat");
  await widget.locator(".launcher").click();
  await widget.getByRole("textbox").fill(question);
  await widget.getByRole("textbox").press("Enter");
  return widget;
}

test.describe("model in the browser", () => {
  test("without WebGPU it says so and downloads nothing", async ({ page }) => {
    await webgpu(page, false);
    const hub: string[] = [];
    page.on("request", (r) => {
      if (/huggingface\.co|hf\.co/.test(r.url())) hub.push(r.url());
    });
    await page.goto("/page.html?local=1");
    const widget = await ask(page, "Horaires ?");
    await expect(widget.locator(".consent")).toContainText("pas de WebGPU");
    await expect(widget.getByRole("button", { name: "Télécharger et répondre" })).toHaveCount(0);
    expect(hub).toEqual([]);
  });

  test("by default the first question starts the download, with no prompt", async ({ page }) => {
    await webgpu(page, true);
    const hub: string[] = [];
    await page.route(/huggingface\.co|hf\.co|cdn\.jsdelivr\.net/, (r) => {
      hub.push(r.request().url());
      return r.abort();
    });
    await page.goto("/page.html?local=1");
    await page.waitForTimeout(500);
    expect(hub).toEqual([]); // nothing before the question
    const widget = await ask(page, "Horaires ?");
    await expect(widget.locator(".consent")).toHaveCount(0);
    await expect(widget.getByRole("alert")).toBeVisible({ timeout: 20000 });
    expect(hub.length).toBeGreaterThan(0);
    await expect(widget.getByRole("button", { name: "Réessayer" })).toBeVisible();
  });

  test("preload=consent asks before downloading", async ({ page }) => {
    await webgpu(page, true);
    await page.route(/huggingface\.co|hf\.co|cdn\.jsdelivr\.net/, (r) => r.abort());
    await page.goto("/page.html?local=1&preload=consent");
    const widget = await ask(page, "Horaires ?");
    await expect(widget.locator(".consent")).toContainText("LFM3 1.7B");
    await expect(widget.locator(".consent")).toContainText("1,1 Go");
    await widget.getByRole("button", { name: "Télécharger et répondre" }).click();
    await expect(widget.getByRole("alert")).toBeVisible({ timeout: 20000 });
  });

  test("preload=open starts the download when the bubble opens", async ({ page }) => {
    await webgpu(page, true);
    const hub: string[] = [];
    await page.route(/huggingface\.co|hf\.co|cdn\.jsdelivr\.net/, (r) => {
      hub.push(r.request().url());
      return r.abort();
    });
    await page.goto("/page.html?local=1&preload=open");
    await page.waitForTimeout(500);
    expect(hub).toEqual([]);
    await page.locator("murmur-chat .launcher").click();
    await expect.poll(() => hub.length, { timeout: 15000 }).toBeGreaterThan(0);
  });

  test("data-mode=local shows no key settings", async ({ page }) => {
    await webgpu(page, false);
    await page.goto("/page.html?local=1");
    const widget = await ask(page, "Horaires ?");
    await expect(widget.getByRole("button", { name: "Réglages IA" })).toBeHidden();
    await expect(widget.locator(".consent")).toContainText("ne peut pas le faire tourner");
    await expect(
      widget.getByRole("button", { name: "Utiliser une clé API à la place" }),
    ).toHaveCount(0);
  });

  test("the AI settings offer both, the browser model disabled without WebGPU", async ({
    page,
  }) => {
    await webgpu(page, false);
    await page.route(/models\.dev|openrouter\.ai/, (r) => r.abort());
    await page.goto("/murmur/");
    const widget = page.locator("#handset murmur-chat");
    await widget.getByRole("button", { name: "AI settings" }).click();
    await expect(widget.getByLabel("API key")).toBeAttached();
    const option = widget.getByRole("button", { name: "Run a model in this browser" });
    await expect(option).toBeDisabled();
    await expect(widget.locator(".local-choice")).toContainText("no WebGPU");
  });

  test("the configurator writes the mode and the preload", async ({ page }) => {
    await page.goto("/murmur/#wire");
    const snippet = page.locator("#wire-snippet");
    await page.getByRole("radio", { name: /In the browser/ }).check({ force: true });
    await expect(snippet).toContainText('data-mode="local"');
    await page.getByRole("combobox", { name: "Download" }).selectOption("open");
    await expect(snippet).toContainText('data-preload="open"');
    await page.getByRole("radio", { name: /Visitors' key/ }).check({ force: true });
    await expect(snippet).toContainText('data-mode="key"');
    await expect(snippet).not.toContainText("data-preload");
  });

  test("data-local=false offers only the visitor's key", async ({ page }) => {
    await webgpu(page, true);
    await page.route(/models\.dev|openrouter\.ai/, (r) => r.abort());
    await page.goto("/key-only.html");
    const widget = page.locator("murmur-chat");
    await widget.locator(".launcher").click();
    await widget.getByRole("textbox").fill("Hours?");
    await widget.getByRole("textbox").press("Enter");
    await expect(widget.getByText("Connect an AI model")).toBeVisible();
    await expect(widget.locator(".local-choice")).toBeHidden();
  });
});
