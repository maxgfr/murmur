import { buildIndex, MAX_CHUNK, markdownSections, type Section } from "../rag/chunk";
import type { MurmurIndex } from "../rag/types";
import { type ExtractOptions, extractSections } from "./extract";

export { DEFAULT_EXCLUDE, DEFAULT_ROOT, type ExtractOptions, extractSections } from "./extract";

/** One page to index: give its HTML, its Markdown, or plain text. */
export type PageInput = { url: string; title?: string } & (
  | { html: string }
  | { markdown: string }
  | { text: string }
);

export interface IndexOptions extends ExtractOptions {
  /** Longest passage, in characters. */
  maxChunk?: number;
  /** Parses HTML into a Document. Default: the page's `DOMParser`; the CLI passes linkedom's. */
  parseHtml?: (html: string) => Document;
}

const browserParse = (html: string): Document => {
  if (typeof DOMParser === "undefined") throw new Error("No DOMParser here: pass `parseHtml`.");
  return new DOMParser().parseFromString(html, "text/html");
};

/** The title and sections of one page input. */
export function pageSections(
  page: PageInput,
  options: IndexOptions = {},
): { url: string; title: string; sections: Section[] } {
  if ("html" in page) {
    const read = extractSections((options.parseHtml ?? browserParse)(page.html), options);
    return { url: page.url, title: page.title || read.title || page.url, sections: read.sections };
  }
  if ("markdown" in page) {
    const read = markdownSections(page.markdown);
    return { url: page.url, title: page.title || read.title || page.url, sections: read.sections };
  }
  return {
    url: page.url,
    title: page.title || page.url,
    sections: [{ heading: "", anchor: "", text: page.text }],
  };
}

/** An index of these pages, ready to save as JSON or to pass to the widget. */
export function indexPages(pages: readonly PageInput[], options: IndexOptions = {}): MurmurIndex {
  return buildIndex(
    pages.map((p) => pageSections(p, options)),
    options.maxChunk ?? MAX_CHUNK,
  );
}

/** An index of a live document, such as the page the widget runs on. */
export function indexDocument(
  doc: Document,
  url = doc.location?.href ?? "",
  options: ExtractOptions & { maxChunk?: number } = {},
): MurmurIndex {
  const read = extractSections(doc, options);
  return buildIndex(
    [{ url, title: read.title, sections: read.sections }],
    options.maxChunk ?? MAX_CHUNK,
  );
}
