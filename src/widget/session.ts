import type { LanguageModel } from "ai";
import type { Murmur, Turn } from "../core/murmur";
import type { LlmConfig, LlmSettings, LlmSettingsStore } from "../llm/index";
import type { Retriever } from "../rag/retriever";
import type { MurmurIndex, Passage } from "../rag/types";
import type { Messages } from "./i18n";

export interface WidgetOptions {
  /** URL of a `murmur index` JSON, or the index itself. Default: the page the widget is on. */
  index?: string | MurmurIndex;
  /** Your own retriever, instead of BM25 over `index`. */
  retriever?: Retriever;
  /** Provider, model and optional proxy (see `LlmConfig`). */
  llm?: LlmConfig;
  /** Your own AI SDK model: skips llm-connect and the settings view. */
  model?: LanguageModel | (() => LanguageModel | Promise<LanguageModel>);
  /** The owner's instructions to the assistant. */
  instructions?: string;
  /** Language of the interface and answers ("fr", "en"). Default: the page's, then the browser's. */
  lang?: string;
  /** Overrides of any interface string. */
  messages?: Partial<Messages>;
  position?: "bottom-right" | "bottom-left";
  /** Accent colour, any CSS colour. */
  accent?: string;
  theme?: "auto" | "light" | "dark";
  /** Fallback model catalog for the settings view. */
  catalogUrl?: string;
  /** Prefix of the storage keys. Default "murmur". */
  storageKey?: string;
  /** Open the panel on load. */
  open?: boolean;
}

export interface ChatTurn extends Turn {
  passages?: Pick<Passage, "url" | "anchor" | "title" | "heading">[];
  cited?: number[];
  error?: string;
}

type Mode = "custom" | "proxy" | "visitor";

/** Everything the widget does except drawing: index, model settings, history. */
export class ChatSession {
  turns: ChatTurn[] = [];
  private engine: Promise<Murmur> | null = null;
  private storePromise: Promise<LlmSettingsStore> | null = null;
  private readonly historyKey: string;

  constructor(readonly options: WidgetOptions) {
    this.historyKey = `${options.storageKey ?? "murmur"}-chat:${location.pathname.split("/")[1] ?? ""}`;
    try {
      const saved = sessionStorage.getItem(this.historyKey);
      if (saved) this.turns = JSON.parse(saved) as ChatTurn[];
    } catch {
      this.turns = [];
    }
  }

  get mode(): Mode {
    if (this.options.model) return "custom";
    return this.options.llm?.endpoint ? "proxy" : "visitor";
  }

  persist(): void {
    try {
      sessionStorage.setItem(this.historyKey, JSON.stringify(this.turns.slice(-30)));
    } catch {
      // Storage full or blocked: the conversation lasts for the page.
    }
  }

  clear(): void {
    this.turns = [];
    this.persist();
  }

  /** The visitor's settings form, created on first use. */
  store(): Promise<LlmSettingsStore> {
    this.storePromise ??= import("../llm/index").then((llm) => {
      const opts: { catalogUrl?: string; storageKey?: string } = {};
      if (this.options.catalogUrl) opts.catalogUrl = this.options.catalogUrl;
      if (this.options.storageKey) opts.storageKey = this.options.storageKey;
      return llm.visitorStore(this.options.llm ?? {}, opts);
    });
    return this.storePromise;
  }

  /** The settings to call, or null when the visitor has to set up a model first. */
  async settings(): Promise<LlmSettings | null> {
    if (this.mode === "custom") return null;
    const llm = await import("../llm/index");
    return llm.resolveSettings(
      this.options.llm ?? {},
      this.mode === "visitor" ? await this.store() : null,
    );
  }

  async needsSetup(): Promise<boolean> {
    return this.mode === "visitor" && !(await this.settings());
  }

  private async loadIndex(): Promise<MurmurIndex> {
    const { index } = this.options;
    if (index && typeof index !== "string") return index;
    const { isMurmurIndex } = await import("../rag/chunk");
    if (index) {
      const res = await fetch(new URL(index, location.href));
      if (!res.ok) throw new Error(`murmur: index ${res.status}`);
      const data: unknown = await res.json();
      if (!isMurmurIndex(data)) throw new Error("murmur: not a murmur index");
      return data;
    }
    const { indexDocument } = await import("../indexer/index");
    return indexDocument(document, location.pathname + location.search);
  }

  private createEngine(): Promise<Murmur> {
    return (async () => {
      const [{ createMurmur }, retriever] = await Promise.all([
        import("../core/murmur"),
        this.options.retriever ??
          import("../rag/retriever").then(async (r) => r.bm25Retriever(await this.loadIndex())),
      ]);
      const model =
        this.options.model ??
        (async () => {
          const settings = await this.settings();
          if (!settings) throw new SetupNeeded();
          const { loadModel } = await import("../llm/index");
          return loadModel(settings);
        });
      const opts: Parameters<typeof createMurmur>[0] = { retriever, model };
      if (this.options.instructions) opts.instructions = this.options.instructions;
      if (this.options.lang) opts.language = this.options.lang;
      return createMurmur(opts);
    })();
  }

  /** Asks a question; `onText` receives the answer so far. Resolves to the finished turn. */
  async ask(
    question: string,
    onText: (text: string, turn: ChatTurn) => void,
    signal: AbortSignal,
  ): Promise<ChatTurn> {
    const history = this.turns
      .filter((t) => !t.error)
      .map(({ role, content }) => ({ role, content }));
    this.turns.push({ role: "user", content: question });
    const turn: ChatTurn = { role: "assistant", content: "" };
    this.turns.push(turn);
    try {
      this.engine ??= this.createEngine();
      const engine = await this.engine.catch((error: unknown) => {
        this.engine = null;
        throw error;
      });
      const answer = await engine.ask(question, { history, signal });
      turn.passages = answer.passages.map(({ url, anchor, title, heading }) => ({
        url,
        anchor,
        title,
        heading,
      }));
      for await (const part of answer.textStream) {
        turn.content += part;
        onText(turn.content, turn);
      }
      turn.cited = (await answer.done).cited;
    } catch (error) {
      if (signal.aborted) {
        turn.cited = [];
      } else if (error instanceof SetupNeeded) {
        this.turns.splice(-2, 2);
        throw error;
      } else {
        turn.error = await this.describe(error);
      }
    } finally {
      this.persist();
    }
    return turn;
  }

  /** The kind of failure, as an i18n key, plus the provider's message. */
  private async describe(error: unknown): Promise<string> {
    try {
      const { describeError } = await import("../llm/index");
      const settings = this.mode === "custom" ? null : await this.settings();
      const info = describeError(error, settings?.apiKey);
      return `${info.code}|${info.message}`;
    } catch {
      return `unknown|${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

/** Thrown when the visitor must pick a model before asking. */
export class SetupNeeded extends Error {
  constructor() {
    super("murmur: no model set up");
  }
}
