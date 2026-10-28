import { describe, expect, test } from "bun:test";
import { parseHTML } from "linkedom";
import { renderMarkdown } from "../src/widget/markdown";

const { document } = parseHTML("<!doctype html><html><body><div id=t></div></body></html>");
const target = document.getElementById("t") as unknown as Element;
const html = () => (target as unknown as { innerHTML: string }).innerHTML;
const cite = (n: number) => {
  const a = document.createElement("a");
  a.className = "cite";
  a.textContent = String(n);
  return a as unknown as Node;
};

describe("renderMarkdown, what models actually write", () => {
  test("tables, with inline formatting and citations in cells", () => {
    renderMarkdown(
      target,
      "| Plan | Price |\n|---|:---:|\n| **Pro** | 12 € [1] |\n| Team | 30 € |",
      cite,
    );
    expect(html()).toBe(
      '<div tabindex="0" class="table"><table><tr><th>Plan</th><th>Price</th></tr><tr><td><strong>Pro</strong></td><td>12 € <a class="cite">1</a></td></tr><tr><td>Team</td><td>30 €</td></tr></table></div>',
    );
  });
  test("blockquotes and rules", () => {
    renderMarkdown(target, "> quoted **text**\n> more\n\n---\nafter", cite);
    expect(html()).toBe(
      "<blockquote><p>quoted <strong>text</strong> more</p></blockquote><hr><p>after</p>",
    );
  });
  test("a list split by blank lines stays one list", () => {
    renderMarkdown(target, "1. one\n\n2. two\n\n3. three", cite);
    expect(html()).toBe("<ol><li>one</li><li>two</li><li>three</li></ol>");
  });
  test("an indented code block stays inside its list item", () => {
    renderMarkdown(
      target,
      "1. **Install** it:\n   ```bash\n   npx murmur-rag index ./dist\n   ```\n   (or in CI [2]).\n\n2. Add the tag.",
      cite,
    );
    expect(html()).toBe(
      '<ol><li><strong>Install</strong> it:<pre tabindex="0"><code>npx murmur-rag index ./dist</code></pre> (or in CI <a class="cite">2</a>).</li><li>Add the tag.</li></ol>',
    );
  });
  test("two trailing spaces break the line, in paragraphs and list items", () => {
    renderMarkdown(target, "**Install**  \nthen run it\n\n1. **Index**  \n   run the CLI", cite);
    expect(html()).toBe(
      "<p><strong>Install</strong><br>then run it</p><ol><li><strong>Index</strong><br>run the CLI</li></ol>",
    );
  });
  test("a numbered list that resumes after text keeps its numbers", () => {
    renderMarkdown(target, "1. one\n\nSome text.\n\n2. two", cite);
    expect(html()).toBe('<ol><li>one</li></ol><p>Some text.</p><ol start="2"><li>two</li></ol>');
  });
});
