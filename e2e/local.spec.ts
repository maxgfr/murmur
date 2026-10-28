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

test.describe("model in the browser", () => {
  test("without WebGPU it says so and downloads nothing", async ({ page }) => {
    await webgpu(page, false);
    const hub: string[] = [];
    page.on("request", (r) => {
      if (/huggingface\.co|hf\.co/.test(r.url())) hub.push(r.url());
    });
    await page.goto("/page.html?local=1");
    const widget = page.locator("murmur-chat");
    await widget.locator(".launcher").click();
    await widget.getByRole("textbox").fill("Horaires ?");
    await widget.getByRole("textbox").press("Enter");
    await expect(widget.locator(".consent")).toContainText("pas de WebGPU");
    await expect(widget.getByRole("button", { name: "Télécharger et répondre" })).toHaveCount(0);
    expect(hub).toEqual([]);
  });

  test("asks before downloading, then explains a failed load", async ({ page }) => {
    await webgpu(page, true);
    await page.route(/huggingface\.co|hf\.co|cdn\.jsdelivr\.net/, (r) => r.abort());
    await page.goto("/page.html?local=1");
    const widget = page.locator("murmur-chat");
    await widget.locator(".launcher").click();
    await widget.getByRole("textbox").fill("Horaires ?");
    await widget.getByRole("textbox").press("Enter");
    await expect(widget.locator(".consent")).toContainText("LFM3 1.7B");
    await expect(widget.locator(".consent")).toContainText("1,1 Go");
    await widget.getByRole("button", { name: "Télécharger et répondre" }).click();
    await expect(widget.getByRole("alert")).toBeVisible({ timeout: 20000 });
    await expect(widget.getByRole("button", { name: "Réessayer" })).toBeVisible();
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

  test("the configurator: browser model by default, data-local=false for keys only", async ({
    page,
  }) => {
    await page.goto("/murmur/#wire");
    const snippet = page.locator("#wire-snippet");
    await expect(snippet).not.toContainText("data-local");
    await page.getByRole("radio", { name: /Visitors' key only/ }).check({ force: true });
    await expect(snippet).toContainText('data-local="false"');
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
