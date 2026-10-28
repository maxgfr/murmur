/**
 * A small, safe Markdown renderer for model answers: it builds DOM nodes and never parses HTML,
 * so nothing the model writes can inject markup. Paragraphs, lists, fenced code, **bold**,
 * *italic*, `code`, [links](https://…) and citations like [1].
 */
export type CitationRenderer = (n: number) => Node | null;

const SAFE_URL = /^(https?:\/\/|\/|#|\.\/|mailto:)/i;

function inline(doc: Document, text: string, cite: CitationRenderer, out: Node): void {
  const re =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)|(\[[^\]]+\]\([^)\s]+\))|(\[\d{1,2}\])/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) out.appendChild(doc.createTextNode(text.slice(last, at)));
    last = at + m[0].length;
    const token = m[0];
    if (m[1]) {
      const code = doc.createElement("code");
      code.textContent = token.slice(1, -1);
      out.appendChild(code);
    } else if (m[2]) {
      const strong = doc.createElement("strong");
      inline(doc, token.slice(2, -2), cite, strong);
      out.appendChild(strong);
    } else if (m[3]) {
      const em = doc.createElement("em");
      inline(doc, token.slice(1, -1), cite, em);
      out.appendChild(em);
    } else if (m[4]) {
      const split = token.indexOf("](");
      const label = token.slice(1, split);
      const href = token.slice(split + 2, -1);
      if (SAFE_URL.test(href)) {
        const a = doc.createElement("a");
        a.href = href;
        a.textContent = label;
        if (/^https?:/i.test(href)) {
          a.target = "_blank";
          a.rel = "noopener noreferrer";
        }
        out.appendChild(a);
      } else out.appendChild(doc.createTextNode(label));
    } else {
      const node = cite(Number(token.slice(1, -1)));
      out.appendChild(node ?? doc.createTextNode(token));
    }
  }
  if (last < text.length) out.appendChild(doc.createTextNode(text.slice(last)));
}

const TABLE_RULE = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?\s*$/;

/** A line ending in two spaces or a backslash is a hard break; any other line wraps on. */
function lineBreak(doc: Document, previous: string): Node {
  return / {2,}$|\\$/.test(previous) ? doc.createElement("br") : doc.createTextNode(" ");
}

/** The cells of a `| a | b |` table row. */
function cells(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

/** Renders Markdown into `target`, replacing its children. */
export function renderMarkdown(target: Element, markdown: string, cite: CitationRenderer): void {
  const doc = target.ownerDocument;
  const frag = doc.createDocumentFragment();
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  let para: string[] = [];
  let list: HTMLElement | null = null;

  const flushPara = () => {
    if (!para.length) return;
    const p = doc.createElement("p");
    para.forEach((raw, n) => {
      if (n) p.appendChild(lineBreak(doc, para[n - 1] ?? ""));
      inline(doc, raw.trim(), cite, p);
    });
    frag.appendChild(p);
    para = [];
  };
  const closeList = () => {
    list = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const fence = /^(\s*)```/.exec(line);
    if (fence) {
      flushPara();
      // An indented fence under a list item belongs to that item.
      const indent = fence[1]?.length ?? 0;
      const owner = indent >= 2 && list ? list.lastElementChild : null;
      if (!owner) closeList();
      const body: string[] = [];
      for (i++; i < lines.length && !/^\s*```/.test(lines[i] ?? ""); i++) {
        const raw = lines[i] ?? "";
        body.push(raw.startsWith(" ".repeat(indent)) ? raw.slice(indent) : raw.trimStart());
      }
      const pre = doc.createElement("pre");
      pre.tabIndex = 0; // it may scroll sideways: keyboard users must be able to reach it
      const code = doc.createElement("code");
      code.textContent = body.join("\n");
      pre.appendChild(code);
      (owner ?? frag).appendChild(pre);
      continue;
    }
    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      flushPara();
      closeList();
      frag.appendChild(doc.createElement("hr"));
      continue;
    }
    if (line.includes("|") && TABLE_RULE.test(lines[i + 1] ?? "")) {
      flushPara();
      closeList();
      const rows: string[][] = [cells(line)];
      for (i += 2; i < lines.length && (lines[i] ?? "").includes("|"); i++)
        rows.push(cells(lines[i] ?? ""));
      i--;
      const wrap = doc.createElement("div");
      wrap.className = "table";
      wrap.tabIndex = 0; // it may scroll sideways
      const table = doc.createElement("table");
      rows.forEach((row, r) => {
        const tr = doc.createElement("tr");
        for (const cell of row) {
          const td = doc.createElement(r === 0 ? "th" : "td");
          inline(doc, cell, cite, td);
          tr.appendChild(td);
        }
        table.appendChild(tr);
      });
      wrap.appendChild(table);
      frag.appendChild(wrap);
      continue;
    }
    const quote = /^\s*>\s?(.*)$/.exec(line);
    if (quote) {
      flushPara();
      closeList();
      const body = [quote[1] ?? ""];
      for (; /^\s*>/.test(lines[i + 1] ?? ""); i++)
        body.push((lines[i + 1] ?? "").replace(/^\s*>\s?/, ""));
      const blockquote = doc.createElement("blockquote");
      renderMarkdown(blockquote, body.join("\n"), cite);
      frag.appendChild(blockquote);
      continue;
    }
    const item = /^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/.exec(line);
    if (item) {
      flushPara();
      const tag = item[1] ? "ul" : "ol";
      if (!list || list.tagName.toLowerCase() !== tag) {
        list = doc.createElement(tag);
        // A numbered list split by blank lines keeps counting from where it is.
        if (tag === "ol" && item[2] && item[2] !== "1") list.setAttribute("start", item[2]);
        frag.appendChild(list);
      }
      const li = doc.createElement("li");
      inline(doc, (item[3] ?? "").trimEnd(), cite, li);
      list.appendChild(li);
      continue;
    }
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      flushPara();
      closeList();
      const p = doc.createElement("p");
      const strong = doc.createElement("strong");
      inline(doc, heading[1] ?? "", cite, strong);
      p.appendChild(strong);
      frag.appendChild(p);
      continue;
    }
    if (!line.trim()) {
      flushPara();
      // Small models often leave a blank line between items: keep one list across it.
      const next = lines.slice(i + 1).find((l) => l.trim()) ?? "";
      const same = list?.tagName.toLowerCase() === "ol" ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/;
      if (!list || !same.test(next)) closeList();
      continue;
    }
    if (list && /^\s{2,}\S/.test(line)) {
      const li = list.lastElementChild;
      if (li) {
        li.appendChild(lineBreak(doc, lines[i - 1] ?? ""));
        inline(doc, line.trim(), cite, li);
        continue;
      }
    }
    closeList();
    para.push(line);
  }
  flushPara();
  target.replaceChildren(frag);
}
