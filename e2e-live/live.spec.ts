// Production checks: the pages on maxgfr.github.io and the script they publish, embedded on
// another origin. The fake OpenAI-compatible endpoint and the host pages come from the local
// dev server (playwright.live.config.ts); everything murmur itself comes from GitHub Pages.
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

const SITE = "https://maxgfr.github.io/murmur/";

async function noCatalogApis(page: Page) {
  await page.route(/models\.dev|openrouter\.ai/, (r) => r.abort());
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  return errors;
}

test.describe("the published site", () => {
  for (const path of [
    "",
    "fr/",
    "guide.html",
    "fr/guide.html",
    "playground.html",
    "fr/playground.html",
  ]) {
    test(`${path || "home"} loads cleanly and passes axe`, async ({ page }) => {
      await noCatalogApis(page);
      await page.addInitScript(() => localStorage.setItem("murmur-site-lang", "stay"));
      const errors = collectErrors(page);
      const res = await page.goto(SITE + path);
      expect(res?.status()).toBe(200);
      // The playground mounts its widget once text is indexed; every other page has one.
      if (path.includes("playground")) {
        await page.locator("#sample").click();
        await expect(page.locator("#stats")).toContainText(/\d/);
      }
      await expect(page.locator("murmur-chat")).toBeAttached();
      await page.waitForTimeout(500);
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => v.id)).toEqual([]);
      expect(errors).toEqual([]);
    });
  }

  test("each language has an index whose anchors exist in its pages", async ({ request }) => {
    for (const lang of ["", "fr/"]) {
      const index = await (await request.get(`${SITE}${lang}murmur-index.json`)).json();
      expect(index.version).toBe(1);
      expect(index.chunks.length).toBeGreaterThan(10);
      const pages = new Map<string, string>();
      for (const doc of index.docs) {
        pages.set(doc.url, await (await request.get(`https://maxgfr.github.io${doc.url}`)).text());
      }
      for (const c of index.chunks) {
        if (!c.anchor) continue;
        const html = pages.get(index.docs[c.doc].url) ?? "";
        expect(html, `${index.docs[c.doc].url}#${c.anchor}`).toContain(`id="${c.anchor}"`);
      }
    }
  });

  test("the home switchboard is wired to the index", async ({ page }) => {
    await noCatalogApis(page);
    await page.addInitScript(() => localStorage.setItem("murmur-site-lang", "stay"));
    await page.goto(SITE);
    await expect(page.locator("#jackfield .socket a, #jackfield a.socket").first()).toBeAttached();
    expect(await page.locator("#jackfield a.socket").count()).toBeGreaterThan(10);
  });

  test("the configurator writes a working snippet", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("murmur-site-lang", "stay"));
    await page.goto(`${SITE}#wire`);
    await page.getByRole("radio", { name: /In the browser/ }).check({ force: true });
    await expect(page.locator("#wire-snippet")).toContainText(
      'src="https://maxgfr.github.io/murmur/cdn/murmur.js"',
    );
    await expect(page.locator("#wire-snippet")).toContainText('data-mode="local"');
  });
});

test.describe("the published script, on another origin", () => {
  test("proxy mode answers with sources", async ({ page }) => {
    await noCatalogApis(page);
    const errors = collectErrors(page);
    await page.goto("/live.html");
    const widget = page.locator("murmur-chat");
    await widget.locator(".launcher").click();
    await widget.getByRole("textbox").fill("Quels sont les horaires ?");
    await widget.getByRole("textbox").press("Enter");
    await expect(widget.locator("ol.sources a").first()).toContainText("Horaires");
    await expect(widget.locator("ol.sources a").first()).toHaveAttribute("href", /#horaires$/);
    expect(errors).toEqual([]);
  });

  test("local mode loads its runtime from GitHub Pages and explains a browser without WebGPU", async ({
    page,
  }) => {
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined }),
    );
    await page.goto("/live-local.html");
    const widget = page.locator("murmur-chat");
    await widget.locator(".launcher").click();
    await widget.getByRole("textbox").fill("Horaires ?");
    await widget.getByRole("textbox").press("Enter");
    await expect(widget.locator(".consent")).toContainText("pas de WebGPU");
  });

  test("local mode with WebGPU fetches the model runtime and reports a blocked download", async ({
    page,
  }) => {
    const pages: string[] = [];
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "gpu", {
        configurable: true,
        value: { requestAdapter: async () => ({}) },
      }),
    );
    page.on("response", (r) => {
      if (r.url().startsWith("https://maxgfr.github.io/murmur/cdn/"))
        pages.push(`${r.status()} ${r.url()}`);
    });
    await page.route(/huggingface\.co|hf\.co/, (r) => r.abort());
    await page.goto("/live-local.html");
    const widget = page.locator("murmur-chat");
    await widget.locator(".launcher").click();
    await widget.getByRole("textbox").fill("Horaires ?");
    await widget.getByRole("textbox").press("Enter");
    await expect(widget.getByRole("alert")).toBeVisible({ timeout: 30000 });
    expect(pages.some((p) => /^200 .*transformers/.test(p))).toBe(true);
    expect(pages.filter((p) => !p.startsWith("200"))).toEqual([]);
  });
});
