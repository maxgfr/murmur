/** A page (or file) of the site. */
export interface IndexDoc {
  id: number;
  /** Where the page lives, absolute or relative to the site root. */
  url: string;
  title: string;
}

/** A passage of a page, under one heading. */
export interface Chunk {
  /** Index of its page in `MurmurIndex.docs`. */
  doc: number;
  /** Fragment of the heading it sits under, without `#`; empty for the top of the page. */
  anchor: string;
  heading: string;
  text: string;
}

/** What `murmur index` writes and the widget loads. */
export interface MurmurIndex {
  version: 1;
  generatedAt: string;
  docs: IndexDoc[];
  chunks: Chunk[];
}

/** A chunk with its page, as retrieval hands it to the prompt. */
export interface Passage extends Chunk {
  url: string;
  title: string;
}
