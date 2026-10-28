import { describe, expect, test } from "bun:test";
import { parseHTML } from "linkedom";
import { renderMarkdown } from "../src/widget/markdown";

const { document } = parseHTML("<!doctype html><html><body><div id=t></div></body></html>");
const target = document.getElementById("t") as unknown as Element;
const cite = (n: number) => {
  if (n > 2) return null;
  const a = document.createElement("a");
  a.className = "cite";
  a.textContent = String(n);
  return a as unknown as Node;
};

describe("renderMarkdown", () => {
  test("renders paragraphs, emphasis, code, lists and citations", () => {
    renderMarkdown(
      target,
      "Hello **bold** and *it* `x` [1].\n\n- one [2]\n- two\n\n1. a\n2. b",
      cite,
    );
    const html = (target as unknown as { innerHTML: string }).innerHTML;
    expect(html).toBe(
      '<p>Hello <strong>bold</strong> and <em>it</em> <code>x</code> <a class="cite">1</a>.</p><ul><li>one <a class="cite">2</a></li><li>two</li></ul><ol><li>a</li><li>b</li></ol>',
    );
  });
  test("never turns model text into markup", () => {
    renderMarkdown(target, "<img src=x onerror=alert(1)> [x](javascript:alert(1)) [9]", cite);
    const html = (target as unknown as { innerHTML: string }).innerHTML;
    expect(html).not.toContain("<img");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("[9]");
  });
  test("keeps fenced code verbatim and opens external links safely", () => {
    renderMarkdown(target, "```\n**not bold**\n```\n[docs](https://x.dev)", cite);
    const html = (target as unknown as { innerHTML: string }).innerHTML;
    expect(html).toContain("<pre><code>**not bold**</code></pre>");
    expect(html).toContain('rel="noopener noreferrer"');
  });
});
