import type { LanguageModel } from "ai";
import type { Murmur, Turn } from "../core/murmur";
import type { LlmConfig, LlmSettings, LlmSettingsStore } from "../llm/index";
import type { LoadProgress, LocalModelSpec } from "../local/index";
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
  /**
   * How the widget answers. `auto` (default): the owner's proxy or key if set, else the model in
   * the visitor's browser with their own key as an option. `proxy`: only `llm.endpoint`. `local`:
   * only the in-browser model, no key settings. `key`: only a key, the owner's `llm.apiKey` or
   * else each visitor's own.
   */
  mode?: WidgetMode;
  /**
   * When the in-browser model downloads (about 1.1 GB, once; then it loads from the browser's
   * cache): `question` (default) on the first question, `open` when the panel opens, `idle` as
   * soon as the page is idle, `consent` after the visitor agrees on a prompt. A model already in
   * the cache is prepared in the background whatever this says, without network.
   */
  preload?: Preload;
  /**
   * The model that runs in the visitor's browser on WebGPU, the default way to answer when there
   * is no proxy: LFM3 1.7B, about 1.1 GB downloaded once after the visitor agrees. Visitors can
   * still connect their own key in the AI settings. Pass your own spec to run another model, or
   * `false` to offer only the visitor's key.
   */
  local?: boolean | LocalModelSpec;
}

export interface ChatTurn extends Turn {
  passages?: Pick<Passage, "url" | "anchor" | "title" | "heading">[];
  cited?: number[];
  error?: string;
}

export type WidgetMode = "auto" | "proxy" | "local" | "key";
export type Preload = "question" | "open" | "idle" | "consent";

/** Where the in-browser model is: not started, downloading or compiling, ready, or failed. */
export interface LocalState {
  status: "idle" | "loading" | "ready" | "error";
  progress?: LoadProgress;
}

type Mode = "custom" | "local" | "owner" | "proxy" | "visitor";

/** Passages are cut down for a model running in the page: a long prompt is slow to read there. */
const LOCAL_SEARCH = { limit: 4, budgetTokens: 1500 };

/** Everything the widget does except drawing: index, model settings, history. */
export class ChatSession {
  turns: ChatTurn[] = [];
  private engine: Promise<Murmur> | null = null;
  private storePromise: Promise<LlmSettingsStore> | null = null;
  private readonly historyKey: string;
  private readonly key: string;
  private local: LocalState = { status: "idle" };
  private readonly localListeners = new Set<(state: LocalState) => void>();

  constructor(readonly options: WidgetOptions) {
    this.key = options.storageKey ?? "murmur";
    this.historyKey = `${options.storageKey ?? "murmur"}-chat:${location.pathname.split("/")[1] ?? ""}`;
    try {
      const saved = sessionStorage.getItem(this.historyKey);
      if (saved) this.turns = JSON.parse(saved) as ChatTurn[];
    } catch {
      this.turns = [];
    }
  }

  private get configured(): WidgetMode {
    return this.options.mode ?? "auto";
  }

  /**
   * How this session answers: your own model; then the owner's proxy, then the owner's key;
   * then the visitor's own key if they chose one; else the model in the browser.
   */
  get mode(): Mode {
    const m = this.configured;
    if (this.options.model) return "custom";
    if (m === "proxy" || (m === "auto" && this.options.llm?.endpoint)) return "proxy";
    if ((m === "auto" || m === "key") && this.options.llm?.apiKey) return "owner";
    if (m === "local") return "local";
    if (m === "key" || !this.localAllowed) return "visitor";
    return readLocal(`${this.key}-local`) === "0" ? "visitor" : "local";
  }

  /** Whether the in-browser model is offered at all. */
  get localAllowed(): boolean {
    const m = this.configured;
    if (this.options.model || m === "proxy" || m === "key") return false;
    if (m === "local") return true;
    return !this.options.llm?.endpoint && !this.options.llm?.apiKey && this.options.local !== false;
  }

  /** Whether visitors may connect their own key (the AI settings). */
  get keyAllowed(): boolean {
    const m = this.configured;
    if (this.options.model || m === "proxy" || m === "local") return false;
    return !this.options.llm?.endpoint && !this.options.llm?.apiKey;
  }

  /** Where the in-browser model is, and a way to follow it. */
  get localState(): LocalState {
    return this.local;
  }

  onLocalState(listener: (state: LocalState) => void): () => void {
    this.localListeners.add(listener);
    return () => this.localListeners.delete(listener);
  }

  private setLocal(state: LocalState): void {
    this.local = state;
    for (const listener of this.localListeners) listener(state);
  }

  /**
   * Starts loading the in-browser model now, in the background: downloads it if needed, then
   * compiles it. Does nothing outside the local mode or without WebGPU. Safe to call often.
   */
  async warmUp(): Promise<void> {
    if (this.mode !== "local" || this.local.status !== "idle") return;
    if (!(await this.canRunLocally())) return;
    const { loadLocalModel } = await import("../local/index");
    this.setLocal({ status: "loading" });
    try {
      await loadLocalModel(await this.localSpec(), (progress) =>
        this.setLocal({ status: "loading", progress }),
      );
      this.setLocal({ status: "ready" });
    } catch {
      this.setLocal({ status: "error" });
    }
  }

  /** A model already in the browser's cache is prepared right away: no network, no prompt. */
  async warmUpIfCached(): Promise<void> {
    if (this.mode !== "local" || this.preload === "consent") return;
    const { isLocalModelCached } = await import("../local/index");
    if (await isLocalModelCached(await this.localSpec())) await this.warmUp();
  }

  get preload(): Preload {
    return this.options.preload ?? "question";
  }

  /**
   * Before a question: a visitor who saved a key before the in-browser model became the default,
   * and never chose between the two, keeps their key.
   */
  async settleChoice(): Promise<void> {
    if (!this.localAllowed || !this.keyAllowed || readLocal(`${this.key}-local`) !== null) return;
    const [{ isConfigured }, store] = await Promise.all([import("../llm/index"), this.store()]);
    const saved = await store.load();
    if (saved && isConfigured(saved)) writeLocal(`${this.key}-local`, "0");
  }

  /** The in-browser model this session would run. */
  async localSpec(): Promise<LocalModelSpec> {
    const { local } = this.options;
    if (local && typeof local === "object") return local;
    return (await import("../local/index")).DEFAULT_LOCAL_MODEL;
  }

  /** The visitor picks the in-browser model, or their own key. */
  useLocal(on: boolean): void {
    writeLocal(`${this.key}-local`, on ? "1" : "0");
    this.engine = null;
  }

  /** Whether the visitor must still agree to download the in-browser model (`preload: "consent"`). */
  get needsDownloadConsent(): boolean {
    return (
      this.mode === "local" &&
      this.preload === "consent" &&
      this.local.status !== "ready" &&
      readLocal(`${this.key}-local-consent`) !== "1"
    );
  }

  agreeToDownload(): void {
    writeLocal(`${this.key}-local-consent`, "1");
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
    const mode = this.mode;
    if (mode === "custom" || mode === "local") return null;
    const llm = await import("../llm/index");
    const config = this.options.llm ?? {};
    if (mode === "proxy") return llm.proxySettings(config);
    if (mode === "owner") return llm.ownerKeySettings(config, this.options.catalogUrl);
    return llm.resolveSettings({ ...config, endpoint: "" }, await this.store());
  }

  async needsSetup(): Promise<boolean> {
    return this.mode === "visitor" && !(await this.settings());
  }

  /** Whether a model can run in this browser at all. */
  async canRunLocally(): Promise<boolean> {
    return (await import("../local/index")).hasWebGPU();
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
      const local = this.mode === "local";
      const model =
        this.options.model ??
        (local
          ? async () => {
              const { localModel } = await import("../local/index");
              return localModel({
                spec: await this.localSpec(),
                onProgress: (progress) => this.setLocal({ status: "loading", progress }),
              });
            }
          : async () => {
              const settings = await this.settings();
              if (!settings) throw new SetupNeeded();
              const { loadModel } = await import("../llm/index");
              return loadModel(settings);
            });
      const opts: Parameters<typeof createMurmur>[0] = {
        retriever,
        model,
        ...(local ? LOCAL_SEARCH : {}),
      };
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
    // Saved now too: a reload or a click on a source mid-answer keeps the question.
    this.persist();
    try {
      // Shows the load bar from the start, and shares the load with any preload under way.
      if (this.mode === "local") void this.warmUp();
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
      const done = await answer.done;
      if (this.mode === "local") this.setLocal({ status: "ready" });
      turn.content = done.text;
      turn.cited = done.cited;
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
    if (error instanceof Error && error.name === "LocalModelError") {
      return `local-${(error as Error & { code?: string }).code ?? "load"}|${error.message}`;
    }
    try {
      const { describeError } = await import("../llm/index");
      const settings =
        this.mode === "custom" || this.mode === "local" ? null : await this.settings();
      const info = describeError(error, settings?.apiKey);
      return `${info.code}|${info.message}`;
    } catch {
      return `unknown|${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}

/** Thrown when the visitor must pick a model before asking. */
export class SetupNeeded extends Error {
  constructor() {
    super("murmur: no model set up");
  }
}
