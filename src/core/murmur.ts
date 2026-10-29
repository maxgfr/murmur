import { type LanguageModel, type ModelMessage, streamText } from "ai";
import {
  citedSources,
  cleanAnswer,
  estimateTokens,
  formatSources,
  groundingRules,
} from "../rag/ground";
import { bm25Retriever, type Retriever } from "../rag/retriever";
import type { MurmurIndex, Passage } from "../rag/types";

export interface MurmurOptions {
  /** The index to answer from; ignored when `retriever` is given. */
  index?: MurmurIndex;
  /** How passages are found. Default: BM25 over `index`. */
  retriever?: Retriever;
  /** The model to call, or a function returning it (called on each question). */
  model: LanguageModel | (() => LanguageModel | Promise<LanguageModel>);
  /** The owner's instructions: who the assistant is, its tone, what it should not discuss. */
  instructions?: string;
  /** Code of the language answers are written in, e.g. "fr". Default: the visitor's. */
  language?: string;
  /** Most passages per question. Default 6. */
  limit?: number;
  /** Tokens the passages may take. Default 3000. */
  budgetTokens?: number;
  /** Turns of history kept in the prompt. Default 6. */
  historyTurns?: number;
}

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

export interface Answer {
  /** The passages the model was given, numbered from 1 in that order. */
  passages: Passage[];
  /** The answer as it is written. */
  textStream: AsyncIterable<string>;
  /** The whole answer, and the passages it cites (by their number, from 1). */
  done: Promise<{ text: string; cited: number[] }>;
}

export interface Murmur {
  /** Retrieves the passages for `question` and streams an answer grounded in them. */
  ask(
    question: string,
    options?: { history?: readonly Turn[]; signal?: AbortSignal },
  ): Promise<Answer>;
  readonly retriever: Retriever;
}

/** The text a retriever searches with: the question, plus the last question when it is a follow-up. */
export function searchQuery(question: string, history: readonly Turn[]): string {
  const last = [...history].reverse().find((t) => t.role === "user");
  return estimateTokens(question) < 12 && last ? `${last.content} ${question}` : question;
}

const SMALL_TALK =
  /^(?:hello|hi|hey|hiya|yo|hola|bonjour|bonsoir|salut|coucou|good (?:morning|afternoon|evening)|merci(?: beaucoup| bien)?|thanks?(?: you| a lot)?|thx|ok(?:ay)?|d accord|cool|super|parfait|great|nice|bye|goodbye|au revoir|ciao)(?: (?:murmur|there|toi|you|à toi))?$/;

/** A greeting or a thank-you: nothing to look up, and no source should be cited for it. */
export function isSmallTalk(question: string): boolean {
  return SMALL_TALK.test(
    question
      .toLowerCase()
      .replace(/[\p{P}\p{S}\s]+/gu, " ")
      .trim(),
  );
}

/** A question-answering engine over a site, without any UI. */
export function createMurmur(options: MurmurOptions): Murmur {
  const retriever =
    options.retriever ??
    (options.index ? bm25Retriever(options.index) : null) ??
    (() => {
      throw new Error("murmur: pass `index` or `retriever`.");
    })();

  return {
    retriever,
    async ask(question, { history = [], signal } = {}) {
      const searchOptions: { limit?: number; budgetTokens?: number } = {};
      if (options.limit !== undefined) searchOptions.limit = options.limit;
      if (options.budgetTokens !== undefined) searchOptions.budgetTokens = options.budgetTokens;
      const smallTalk = isSmallTalk(question);
      const passages = smallTalk
        ? []
        : await retriever.search(searchQuery(question, history), searchOptions);
      const instructions = [
        options.instructions?.trim(),
        groundingRules(options.language),
        smallTalk
          ? "The visitor is only greeting or thanking you: answer in one short, friendly sentence and invite a question about this site. Cite nothing."
          : passages.length
            ? `Sources:\n\n${formatSources(passages)}`
            : "Sources: none matched this question. Say you could not find it on this site.",
      ]
        .filter(Boolean)
        .join("\n\n");
      const turns = history.slice(-(options.historyTurns ?? 6) * 2);
      const messages: ModelMessage[] = [
        ...turns.map((t) => ({ role: t.role, content: t.content }) as ModelMessage),
        { role: "user", content: question },
      ];
      const model = typeof options.model === "function" ? await options.model() : options.model;
      const result = streamText({
        model,
        instructions,
        messages,
        // Errors come out of the stream below; the default handler would also log them.
        onError: () => {},
        ...(signal ? { abortSignal: signal } : {}),
      });

      let text = "";
      let settle: (v: { text: string; cited: number[] }) => void = () => {};
      let fail: (e: unknown) => void = () => {};
      const done = new Promise<{ text: string; cited: number[] }>((res, rej) => {
        settle = res;
        fail = rej;
      });
      done.catch(() => {});
      async function* stream() {
        try {
          for await (const part of result.stream) {
            if (part.type === "error") throw part.error;
            if (part.type !== "text-delta") continue;
            text += part.text;
            yield part.text;
          }
          text = cleanAnswer(text);
          settle({ text, cited: citedSources(text, passages.length) });
        } catch (error) {
          fail(error);
          throw error;
        }
      }
      return { passages, textStream: stream(), done };
    },
  };
}
