import type { Chunk, IndexDoc, MurmurIndex } from "./types";

/** Longest passage, in characters (about 500 tokens). */
export const MAX_CHUNK = 2000;

/** A titled block of text, as an extractor reads it from a page. */
export interface Section {
  heading: string;
  anchor: string;
  text: string;
}

/** Splits text on blank lines into passages of at most `max` characters. */
export function splitText(text: string, max = MAX_CHUNK): string[] {
  const out: string[] = [];
  let cur = "";
  const flush = () => {
    const t = cur.trim();
    if (t) out.push(t);
    cur = "";
  };
  for (const para of text.split(/\n\s*\n/)) {
    if (cur.length + para.length > max) flush();
    if (para.length > max) {
      for (let i = 0; i < para.length; i += max) {
        cur = para.slice(i, i + max);
        flush();
      }
      continue;
    }
    cur += `${para}\n\n`;
  }
  flush();
  return out;
}

/** GitHub-style heading fragment: lower case, punctuation dropped, spaces to dashes. */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

/** Passages of a page's sections, empty sections dropped. */
export function chunkSections(doc: number, sections: readonly Section[], max = MAX_CHUNK): Chunk[] {
  return sections.flatMap((s) =>
    splitText(s.text, max).map((text) => ({ doc, anchor: s.anchor, heading: s.heading, text })),
  );
}

/** Splits Markdown on its headings (`#` to `######`), outside fenced code. */
export function markdownSections(markdown: string): { title: string; sections: Section[] } {
  const sections: Section[] = [];
  let title = "";
  let cur: Section = { heading: "", anchor: "", text: "" };
  let fence = false;
  const seen = new Map<string, number>();
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const m = fence ? null : /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!m?.[2]) {
      cur.text += `${line}\n`;
      continue;
    }
    sections.push(cur);
    const heading = m[2].replace(/[*_`]/g, "");
    if (!title && m[1] === "#") title = heading;
    const base = slugify(heading);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    cur = { heading, anchor: n ? `${base}-${n}` : base, text: "" };
  }
  sections.push(cur);
  return { title, sections: sections.filter((s) => s.text.trim()) };
}

/** An index from pages already split into sections. */
export function buildIndex(
  pages: readonly { url: string; title: string; sections: readonly Section[] }[],
  max = MAX_CHUNK,
): MurmurIndex {
  const docs: IndexDoc[] = pages.map((p, id) => ({ id, url: p.url, title: p.title }));
  const chunks = pages.flatMap((p, id) => chunkSections(id, p.sections, max));
  return { version: 1, generatedAt: new Date().toISOString(), docs, chunks };
}

/** Whether a value looks like an index `murmur index` wrote. */
export function isMurmurIndex(value: unknown): value is MurmurIndex {
  const v = value as Partial<MurmurIndex> | null;
  return !!v && v.version === 1 && Array.isArray(v.docs) && Array.isArray(v.chunks);
}
