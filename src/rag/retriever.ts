import MiniSearch from "minisearch";
import { estimateTokens } from "./ground";
import type { MurmurIndex, Passage } from "./types";

/** Finds the passages that answer a question. Bring your own (embeddings, a search API) to replace BM25. */
export interface Retriever {
  search(query: string, options?: SearchOptions): Promise<Passage[]>;
}

export interface SearchOptions {
  /** Most passages returned. Default 6. */
  limit?: number;
  /** Token budget the passages must fit in. Default 3000. */
  budgetTokens?: number;
}

interface Row {
  id: number;
  title: string;
  heading: string;
  text: string;
}

const fold = (s: string): string => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Passages of an index, as retrieval returns them. */
export function passagesOf(index: MurmurIndex): Passage[] {
  return index.chunks.map((c) => {
    const doc = index.docs[c.doc];
    return { ...c, url: doc?.url ?? "", title: doc?.title ?? "" };
  });
}

/**
 * BM25 over the index, in the page (MiniSearch): accents folded, prefix and fuzzy matching,
 * page titles and headings weigh more than body text. Only matching passages come back.
 */
export function bm25Retriever(index: MurmurIndex): Retriever {
  const passages = passagesOf(index);
  const engine = new MiniSearch<Row>({
    fields: ["title", "heading", "text"],
    processTerm: (t) => fold(t),
    searchOptions: { prefix: true, fuzzy: 0.15, boost: { title: 2, heading: 1.5 } },
  });
  engine.addAll(
    passages.map((p, id) => ({ id, title: p.title, heading: p.heading, text: p.text })),
  );
  return {
    async search(query, { limit = 6, budgetTokens = 3000 } = {}) {
      const out: Passage[] = [];
      let used = 0;
      for (const hit of engine.search(query, { combineWith: "OR" })) {
        const p = passages[Number(hit.id)];
        if (!p) continue;
        const cost = estimateTokens(p.text) + 24;
        if (used + cost > budgetTokens) continue;
        used += cost;
        out.push(p);
        if (out.length >= limit) break;
      }
      return out;
    },
  };
}
