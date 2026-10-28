import { describe, expect, test } from "bun:test";
import { parseHTML } from "linkedom";
import { pageOf, urlOf } from "../src/indexer/files";
import { extractSections, indexPages } from "../src/indexer/index";

const parseHtml = (html: string) => parseHTML(html).document as unknown as Document;

const PAGE = `<!doctype html><html><head><title>Docs · Acme</title></head><body>
<nav>Home Pricing</nav>
<main>
  <h1>Getting started</h1>
  <p>Install the <strong>CLI</strong> first.</p>
  <h2 id="setup">Set up</h2>
  <ul><li>Run init</li><li>Run build</li></ul>
  <script>alert(1)</script>
  <div data-murmur-ignore>secret</div>
  <h2>Deploy now</h2>
  <p>Push to main.</p>
</main>
<footer>© Acme</footer>
</body></html>`;

describe("extractSections", () => {
  test("reads the main content under its headings", () => {
    const { title, sections } = extractSections(parseHtml(PAGE));
    expect(title).toBe("Getting started");
    expect(sections.map((s) => [s.heading, s.anchor])).toEqual([
      ["Getting started", "getting-started"],
      ["Set up", "setup"],
      ["Deploy now", "deploy-now"],
    ]);
    expect(sections[0]?.text).toBe("Install the CLI first.");
    expect(sections[1]?.text).toContain("- Run init");
    const all = sections.map((s) => s.text).join(" ");
    expect(all).not.toContain("alert");
    expect(all).not.toContain("secret");
    expect(all).not.toContain("Home Pricing");
  });
});

describe("indexPages", () => {
  test("indexes html, markdown and text pages", () => {
    const index = indexPages(
      [
        { url: "/docs/", html: PAGE },
        { url: "/readme", markdown: "# Readme\nHello" },
        { url: "/faq", title: "FAQ", text: "Yes." },
      ],
      { parseHtml },
    );
    expect(index.docs.map((d) => d.title)).toEqual(["Getting started", "Readme", "FAQ"]);
    expect(index.chunks.filter((c) => c.doc === 0)).toHaveLength(3);
    expect(index.chunks.at(-1)).toEqual({ doc: 2, anchor: "", heading: "", text: "Yes." });
  });
});

describe("files", () => {
  test("urlOf maps index.html to its folder", () => {
    expect(urlOf("site/docs/index.html", "site", "/")).toBe("/docs/");
    expect(urlOf("site/about.html", "site", "https://x.dev/blog")).toBe(
      "https://x.dev/blog/about.html",
    );
  });
  test("pageOf picks the format from the extension", () => {
    expect(pageOf("/a", "x", ".md")).toEqual({ url: "/a", markdown: "x" });
    expect(pageOf("/a", "x", ".htm")).toEqual({ url: "/a", html: "x" });
  });
});

describe("extractSections edge cases", () => {
  test("skips hidden content and makes duplicate anchors unique", () => {
    const html = `<main><h2>Same</h2><p>one</p><p hidden>gone</p><p aria-hidden="true">gone too</p><h2>Same</h2><p>two</p></main>`;
    const { sections } = extractSections(parseHtml(html));
    expect(sections.map((s) => s.anchor)).toEqual(["same", "same-"]);
    expect(sections.map((s) => s.text).join(" ")).not.toContain("gone");
  });
  test("follows a custom content root and falls back to the body", () => {
    const html = `<body><div class="content"><h2>In</h2><p>kept</p></div><p>outside</p></body>`;
    expect(extractSections(parseHtml(html), { root: ".content" }).sections[0]?.text).toBe("kept");
    expect(
      extractSections(parseHtml(html))
        .sections.map((s) => s.text)
        .join(" "),
    ).toContain("outside");
  });
  test("a page without content gives no section", () => {
    expect(
      extractSections(parseHtml("<html><head><title>T</title></head><body></body></html>"))
        .sections,
    ).toEqual([]);
  });
});
