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
    inline(doc, para.join(" "), cite, p);
    frag.appendChild(p);
    para = [];
  };
  const closeList = () => {
    list = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const fence = /^\s*```/.exec(line);
    if (fence) {
      flushPara();
      closeList();
      const body: string[] = [];
      for (i++; i < lines.length && !/^\s*```/.test(lines[i] ?? ""); i++) body.push(lines[i] ?? "");
      const pre = doc.createElement("pre");
      const code = doc.createElement("code");
      code.textContent = body.join("\n");
      pre.appendChild(code);
      frag.appendChild(pre);
      continue;
    }
    const item = /^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/.exec(line);
    if (item) {
      flushPara();
      const tag = item[1] ? "ul" : "ol";
      if (!list || list.tagName.toLowerCase() !== tag) {
        list = doc.createElement(tag);
        frag.appendChild(list);
      }
      const li = doc.createElement("li");
      inline(doc, item[3] ?? "", cite, li);
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
      closeList();
      continue;
    }
    if (list && /^\s{2,}\S/.test(line)) {
      const li = list.lastElementChild;
      if (li) {
        li.appendChild(doc.createTextNode(" "));
        inline(doc, line.trim(), cite, li);
        continue;
      }
    }
    closeList();
    para.push(line.trim());
  }
  flushPara();
  target.replaceChildren(frag);
}
