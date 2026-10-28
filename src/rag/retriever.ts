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

/** Words too common to tell passages apart, in the languages the widget speaks. */
const STOPWORDS = new Set(
  (
    "a an and are as at be but by can do does for from how i if in is it its me my of on or so that the " +
    "their them then there these this to was what when where which who why will with you your " +
    "au aux avec ce ces comment dans de des du elle en est et il je la le les leur ma mais me mes " +
    "mon ne nous on ou où par pas pour qu que quel quelle quels qui sa se ses son sont sur ta te tu " +
    "un une vos votre vous y"
  ).split(" "),
);

/** Passages scoring under this share of the best one are noise, not answers. */
const MIN_RELATIVE_SCORE = 0.05;

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
    processTerm: (t) => {
      const term = fold(t);
      return term.length < 2 || STOPWORDS.has(term) ? null : term;
    },
    searchOptions: {
      prefix: (term) => term.length > 3,
      fuzzy: (term) => (term.length > 4 ? 0.15 : 0),
      boost: { title: 2, heading: 1.5 },
    },
  });
  engine.addAll(
    passages.map((p, id) => ({ id, title: p.title, heading: p.heading, text: p.text })),
  );
  return {
    async search(query, { limit = 6, budgetTokens = 3000 } = {}) {
      const out: Passage[] = [];
      let used = 0;
      const hits = engine.search(query, { combineWith: "OR" });
      const floor = (hits[0]?.score ?? 0) * MIN_RELATIVE_SCORE;
      for (const hit of hits) {
        if (hit.score < floor) break;
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
