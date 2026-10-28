import { expect, type Page, test } from "@playwright/test";

// The live catalog would reach models.dev and OpenRouter: keep tests on the bundled fallback.
async function offlineCatalog(page: Page) {
  await page.route(/models\.dev|openrouter\.ai/, (route) => route.abort());
}

test("proxy mode: answers with citations and no settings screen", async ({ page }) => {
  await offlineCatalog(page);
  await page.goto("/proxy.html");
  const widget = page.locator("murmur-chat");
  const input = widget.getByRole("textbox");
  await input.fill("How do I add murmur to my site?");
  await input.press("Enter");
  const log = widget.getByRole("log");
  await expect(log).toContainText("one script tag");
  await expect(log.locator("a.cite").first()).toHaveAttribute("href", /\/murmur\/.*#/);
  await expect(log.locator("ol.sources li")).toHaveCount(2);
  await expect(widget.getByRole("button", { name: "AI settings" })).toBeHidden();
});

test("the in-browser model comes first, a visitor's key can replace it, then the board patches cords", async ({
  page,
}) => {
  await offlineCatalog(page);
  // A deterministic browser without WebGPU: the prompt then offers the key straight away.
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined }),
  );
  await page.goto("/murmur/");
  const widget = page.locator("#handset murmur-chat");
  await page.getByRole("button", { name: "How do I add it to my site?" }).click();
  await expect(widget.locator(".consent")).toContainText("no WebGPU");
  await widget.getByRole("button", { name: "Use an API key instead" }).click();
  await expect(widget.getByText("Connect an AI model")).toBeVisible();
  await widget.getByLabel("Local server (Ollama, LM Studio)").check();
  await widget.getByLabel("Server URL").fill("http://localhost:4317/mock/v1");
  await widget.getByLabel("Model", { exact: true }).last().fill("mock");
  await widget.getByRole("button", { name: "Save and chat" }).click();
  await expect(widget.getByRole("log")).toContainText("one script tag");
  await expect(page.locator("#cords path.core")).toHaveCount(2);
  await expect(page.locator("#oplog")).toContainText("Patched to");
  await expect(page.locator(".socket.patched")).toHaveCount(2);

  // The key stays the choice after a reload, until the visitor switches back.
  await page.reload();
  await page.getByRole("button", { name: "Where is my API key stored?" }).click();
  await expect(page.locator("#handset murmur-chat").locator(".consent")).toHaveCount(0);
  await expect(page.locator("#handset murmur-chat").getByRole("log")).toContainText(
    "one script tag",
  );
});

test("configurator writes the snippet", async ({ page }) => {
  await page.goto("/murmur/#wire");
  await page.getByLabel("Title").fill('Ask "Acme"');
  await page.getByText("My proxy holds it").click();
  await page.getByLabel("Proxy URL").fill("https://proxy.example/v1");
  const snippet = page.locator("#wire-snippet");
  await expect(snippet).toContainText('data-endpoint="https://proxy.example/v1"');
  await expect(snippet).toContainText('data-title="Ask &quot;Acme&quot;"');
});

test("French pages are French, with their own index", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("murmur-site-lang", "fr"));
  await page.goto("/murmur/fr/");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Votre site répond à ses visiteurs.",
  );
  const index = await (await page.request.get("/murmur/fr/murmur-index.json")).json();
  expect(index.docs[0].url).toBe("/murmur/fr/");
});

test("playground indexes pasted text", async ({ page }) => {
  await page.goto("/murmur/playground.html");
  await page.getByRole("button", { name: "Use a sample" }).click();
  await expect(page.locator("#stats")).toContainText("passages indexed");
  await expect(page.locator("#bench-handset murmur-chat")).toBeAttached();
});
