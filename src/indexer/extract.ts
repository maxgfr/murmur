import { type Section, slugify } from "../rag/chunk";

/** Elements never worth indexing: navigation, chrome, scripts, and murmur itself. */
export const DEFAULT_EXCLUDE =
  "script,style,noscript,template,svg,canvas,iframe,nav,header,footer,aside,form,button,dialog,[hidden],[aria-hidden='true'],[data-murmur-ignore],murmur-chat";

/** Where the content of a page is looked for, first match wins. */
export const DEFAULT_ROOT = "main,article,[role='main'],body";

const BLOCK =
  /^(P|LI|DT|DD|PRE|BLOCKQUOTE|TABLE|TR|FIGCAPTION|DIV|SECTION|ARTICLE|UL|OL|DL|MAIN|H[1-6])$/;

export interface ExtractOptions {
  /** CSS selector of the content root. Default {@link DEFAULT_ROOT}. */
  root?: string;
  /** CSS selector of elements to skip. Default {@link DEFAULT_EXCLUDE}. */
  exclude?: string;
}

/** Title and sections of a page: text grouped under its h1–h3 headings, with their fragment. */
export function extractSections(
  doc: Document,
  { root = DEFAULT_ROOT, exclude = DEFAULT_EXCLUDE }: ExtractOptions = {},
): { title: string; sections: Section[] } {
  const base = root
    .split(",")
    .map((sel) => doc.querySelector(sel.trim()))
    .find((el): el is Element => !!el);
  // The page's own heading names it best; <title> often carries the site name too.
  const title =
    base?.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim() ||
    doc.querySelector("title")?.textContent?.trim() ||
    "";
  if (!base) return { title, sections: [] };

  const sections: Section[] = [];
  let cur: Section = { heading: "", anchor: "", text: "" };
  const used = new Set<string>();

  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      cur.text += (node.textContent ?? "").replace(/\s+/g, " ");
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as Element;
    if (el.matches(exclude)) return;
    const tag = el.tagName.toUpperCase();
    if (/^H[1-3]$/.test(tag)) {
      sections.push(cur);
      const heading = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      let anchor = el.id || el.closest("[id]")?.id || slugify(heading);
      while (used.has(anchor)) anchor += "-";
      used.add(anchor);
      cur = { heading, anchor, text: "" };
      return;
    }
    if (tag === "BR") cur.text += "\n";
    const block = BLOCK.test(tag);
    if (block) cur.text += "\n\n";
    if (tag === "LI") cur.text += "- ";
    for (const child of Array.from(el.childNodes)) walk(child);
    if (block) cur.text += "\n\n";
  };

  for (const child of Array.from(base.childNodes)) walk(child);
  sections.push(cur);
  return {
    title,
    sections: sections
      .map((s) => ({
        ...s,
        text: s.text
          .replace(/[ \t]+\n/g, "\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim(),
      }))
      .filter((s) => s.text),
  };
}
