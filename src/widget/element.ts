import type { LlmSettingsState, LlmSettingsStore } from "../llm/index";
import { citedSources, cleanAnswer, passageHref } from "../rag/ground";
import { type Messages, messagesFor, pickLanguage } from "./i18n";
import { icon } from "./icons";
import { renderMarkdown } from "./markdown";
import {
  ChatSession,
  type ChatTurn,
  type LocalState,
  SetupNeeded,
  type WidgetOptions,
} from "./session";
import { STYLES } from "./styles";

/** What `murmur:state` events carry, for pages that want to show what the widget is doing. */
export interface MurmurStateDetail {
  state: "searching" | "streaming" | "done" | "error" | "idle";
  passages?: ChatTurn["passages"];
  cited?: number[];
}

const ERROR_KEYS: Record<string, keyof Messages> = {
  auth: "errorAuth",
  "auth-or-network": "errorNetwork",
  "rate-limit": "errorRate",
  overloaded: "errorRate",
  "local-webgpu": "localNoWebGPU",
  "local-load": "localLoadFailed",
};

/** A size in the widget's language: "1,1 Go" in French, "1.1 GB" in English. */
function size(megabytes: number, lang: string, t: Messages): string {
  if (megabytes >= 1000) {
    const n = (megabytes / 1000).toLocaleString(lang, { maximumFractionDigits: 1 });
    return `${n} ${t.gigabytes}`;
  }
  return `${Math.round(megabytes).toLocaleString(lang)} ${t.megabytes}`;
}

/**
 * `<murmur-chat>`: a chat bubble that answers from the site's pages. Configure it with
 * `element.configure(options)` before or after it is connected; attributes `inline`,
 * `position` and `theme` style it.
 */
// Importing the widget on a server (SSR) must not throw: the class only needs HTMLElement once
// it is defined as a custom element, in a browser.
const Base: typeof HTMLElement =
  typeof HTMLElement === "undefined" ? (class {} as unknown as typeof HTMLElement) : HTMLElement;

export class MurmurChat extends Base {
  private options: WidgetOptions = {};
  private session: ChatSession | null = null;
  private t: Messages = messagesFor("en");
  private uiLang = "en";
  private readonly root: ShadowRoot;
  private launcher!: HTMLButtonElement;
  private panel!: HTMLElement;
  private log!: HTMLElement;
  private chatView!: HTMLElement;
  private setupView!: HTMLElement;
  private input!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;
  private settingsBtn!: HTMLButtonElement;
  private controller: AbortController | null = null;
  private built = false;
  private unsubscribe: (() => void) | null = null;
  private unsubscribeLocal: (() => void) | null = null;
  private loadbar!: HTMLElement;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
  }

  configure(options: WidgetOptions): this {
    this.options = { ...this.options, ...options };
    if (this.isConnected) this.build();
    return this;
  }

  get isOpen(): boolean {
    return this.hasAttribute("inline") || this.launcher?.getAttribute("aria-expanded") === "true";
  }

  connectedCallback(): void {
    this.build();
  }

  disconnectedCallback(): void {
    this.controller?.abort();
    this.unsubscribe?.();
    this.unsubscribeLocal?.();
    this.unsubscribeLocal?.();
  }

  /** Opens the panel and focuses the question field. */
  async open(): Promise<void> {
    if (!this.built) this.build();
    this.launcher.setAttribute("aria-expanded", "true");
    this.panel.hidden = false;
    if (this.session?.preload === "open") void this.session.warmUp();
    this.session?.persist();
    tabStorage("set", this.openKey);
    this.input.focus();
  }

  close(): void {
    if (this.hasAttribute("inline")) return;
    this.launcher.setAttribute("aria-expanded", "false");
    this.panel.hidden = true;
    tabStorage("remove", this.openKey);
    this.launcher.focus();
  }

  /** Asks a question as if the visitor typed it. */
  async ask(question: string): Promise<void> {
    if (!this.isOpen) await this.open();
    this.input.value = question;
    await this.submit();
  }

  private get openKey(): string {
    return `${this.options.storageKey ?? "murmur"}-open`;
  }

  private build(): void {
    const o = this.options;
    const lang = pickLanguage(o.lang, document.documentElement.lang, navigator.language);
    this.uiLang = lang;
    const overrides: Partial<Messages> = { ...o.messages };
    this.t = messagesFor(lang, overrides);
    if (o.position) this.setAttribute("position", o.position);
    if (o.theme && o.theme !== "auto") this.setAttribute("theme", o.theme);
    if (o.accent) this.style.setProperty("--murmur-accent", o.accent);
    this.controller?.abort();
    this.unsubscribe?.();

    const doc = this.ownerDocument;
    const style = doc.createElement("style");
    style.textContent = STYLES;

    this.launcher = el(doc, "button", {
      class: "launcher",
      type: "button",
      "aria-expanded": "false",
    }) as HTMLButtonElement;
    this.launcher.setAttribute("aria-controls", "murmur-panel");
    this.launcher.append(
      el(doc, "span", { class: "lamp", "aria-hidden": "true" }),
      text(doc, "span", this.t.open),
    );
    this.launcher.addEventListener("click", () => void this.open());

    this.panel = el(doc, "section", { class: "panel", id: "murmur-panel", role: "dialog" });
    this.panel.setAttribute("aria-label", this.t.title);
    this.panel.hidden = !this.hasAttribute("inline");
    this.panel.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.close();
    });

    const header = el(doc, "header");
    const title = text(doc, "h2", this.t.title);
    const newBtn = iconButton(doc, "reset", this.t.newChat);
    newBtn.addEventListener("click", () => {
      this.controller?.abort();
      this.session?.clear();
      this.renderChat();
      this.input.focus();
    });
    this.settingsBtn = iconButton(doc, "settings", this.t.settings);
    this.settingsBtn.hidden = !!o.model || !!o.llm?.endpoint;
    this.settingsBtn.addEventListener("click", () => void this.showSetup());
    const closeBtn = iconButton(doc, "close", this.t.close);
    closeBtn.hidden = this.hasAttribute("inline");
    closeBtn.addEventListener("click", () => this.close());
    header.append(title, newBtn, this.settingsBtn, closeBtn);

    this.chatView = el(doc, "div", { class: "chat" });
    this.chatView.style.cssText = "display:flex;flex-direction:column;flex:1;min-height:0";
    this.log = el(doc, "div", {
      class: "log",
      role: "log",
      "aria-live": "polite",
      "aria-relevant": "additions",
    });

    const form = el(doc, "form", { class: "composer" }) as HTMLFormElement;
    this.input = el(doc, "textarea", {
      rows: "1",
      placeholder: this.t.placeholder,
    }) as HTMLTextAreaElement;
    this.input.setAttribute("aria-label", this.t.placeholder);
    this.input.addEventListener("input", () => this.autosize());
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        void this.submit();
      }
    });
    this.sendBtn = el(doc, "button", { class: "send", type: "submit" }) as HTMLButtonElement;
    this.setSendMode("send");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (this.controller) this.controller.abort();
      else void this.submit();
    });
    form.append(this.input, this.sendBtn);
    // Where the in-browser model's download shows, discreetly, whenever it happens.
    this.loadbar = el(doc, "div", { class: "loadbar", role: "status" });
    this.loadbar.hidden = true;

    const footer = el(doc, "footer");
    const by = el(doc, "a", {
      href: "https://maxgfr.github.io/murmur/",
      target: "_blank",
      rel: "noopener",
    });
    by.textContent = this.t.poweredBy;
    footer.append(by);
    this.chatView.append(this.log, this.loadbar, form, footer);

    this.setupView = el(doc, "div", { class: "setup" });
    this.setupView.hidden = true;

    this.panel.append(header, this.chatView, this.setupView);
    this.root.replaceChildren(style, this.launcher, this.panel);
    if (this.hasAttribute("inline")) this.launcher.hidden = true;
    this.built = true;

    // The engine, the index and the model load on the first question.
    const session = new ChatSession({ ...o, lang });
    this.session = session;
    this.settingsBtn.hidden = !session.keyAllowed;
    this.unsubscribeLocal = session.onLocalState((state) => this.drawLocal(state));
    whenIdle(() => {
      if (session.preload === "idle") void session.warmUp();
      else void session.warmUpIfCached();
    });
    this.renderChat();
    if (o.open || (!this.hasAttribute("inline") && tabStorage("get", this.openKey)))
      void this.open();
  }

  /** The download bar and the bubble's lamp follow the in-browser model. */
  private drawLocal(state: LocalState): void {
    const doc = this.ownerDocument;
    const lamp = this.launcher.querySelector(".lamp");
    lamp?.classList.toggle("busy", state.status === "loading");
    if (state.status !== "loading") {
      this.loadbar.hidden = true;
      return;
    }
    const p = state.progress;
    const label = !p
      ? this.t.localLoading
      : p.progress >= 1
        ? this.t.localPreparing
        : `${this.t.localLoading} ${Math.round(p.progress * 100)} % · ${Math.round(p.loaded / 1e6).toLocaleString(this.uiLang)} / ${size(p.total / 1e6, this.uiLang, this.t)}`;
    const bar = el(doc, "progress", { max: "1" });
    if (p && p.progress < 1) bar.setAttribute("value", String(p.progress));
    bar.setAttribute("aria-label", this.t.localLoadingLabel);
    this.loadbar.replaceChildren(text(doc, "span", label), bar);
    this.loadbar.hidden = false;
  }

  private autosize(): void {
    this.input.style.height = "auto";
    this.input.style.height = `${Math.min(this.input.scrollHeight, 140)}px`;
  }

  private setSendMode(mode: "send" | "stop"): void {
    this.sendBtn.replaceChildren(icon(this.ownerDocument, mode));
    this.sendBtn.setAttribute("aria-label", mode === "send" ? this.t.send : this.t.stop);
  }

  private emit(detail: MurmurStateDetail): void {
    this.dispatchEvent(new CustomEvent("murmur:state", { detail, bubbles: true, composed: true }));
  }

  private renderChat(): void {
    const doc = this.ownerDocument;
    const turns = this.session?.turns ?? [];
    const nodes: Node[] = [];
    const greeting = el(doc, "div", { class: "msg bot greeting" });
    greeting.append(text(doc, "p", this.t.greeting));
    nodes.push(greeting);
    for (const turn of turns) nodes.push(this.turnNode(turn));
    this.log.replaceChildren(...nodes);
    this.log.scrollTop = this.log.scrollHeight;
  }

  private turnNode(turn: ChatTurn): HTMLElement {
    const doc = this.ownerDocument;
    if (turn.role === "user") {
      const node = el(doc, "div", { class: "msg user" });
      node.textContent = turn.content;
      return node;
    }
    const node = el(doc, "div", { class: "msg bot" });
    this.fillAnswer(node, turn, true);
    return node;
  }

  /** Draws an answer: its text with citation rings, then the sources it cites. */
  private fillAnswer(node: HTMLElement, turn: ChatTurn, finished: boolean): void {
    const doc = this.ownerDocument;
    if (turn.error) {
      const [code = "unknown", ...rest] = turn.error.split("|");
      const key = ERROR_KEYS[code];
      const box = el(doc, "div", { class: "error", role: "alert" });
      box.append(text(doc, "p", key ? this.t[key] : `${this.t.errorOther} ${rest.join("|")}`));
      const row = el(doc, "div", { class: "row" });
      const retry = el(doc, "button", { class: "text-btn", type: "button" });
      retry.textContent = this.t.retry;
      retry.addEventListener("click", () => {
        const turns = this.session?.turns ?? [];
        const question = turns.at(-2)?.content ?? "";
        turns.splice(-2, 2);
        this.renderChat();
        if (question) void this.ask(question);
      });
      row.append(retry);
      if (code === "auth" || code === "auth-or-network") {
        if (!this.settingsBtn.hidden) {
          const fix = el(doc, "button", { class: "text-btn", type: "button" });
          fix.textContent = this.t.settings;
          fix.addEventListener("click", () => void this.showSetup());
          row.append(fix);
        }
      }
      box.append(row);
      node.replaceChildren(box);
      return;
    }
    const passages = turn.passages ?? [];
    const content = cleanAnswer(turn.content);
    // Sources are numbered 1, 2, 3 in the order the answer first cites them, whatever their
    // place among the passages the model was given.
    const order = citedSources(content, passages.length);
    const label = (n: number) => order.indexOf(n) + 1;
    const body = el(doc, "div");
    renderMarkdown(body, content, (n) => {
      const p = passages[n - 1];
      if (!p || !label(n)) return null;
      const a = el(doc, "a", { class: "cite", href: passageHref(p) });
      a.textContent = String(label(n));
      a.setAttribute("aria-label", `${this.t.sources} ${label(n)}: ${p.title}`);
      return a;
    });
    const parts: Node[] = [body];
    if (finished && !turn.content.trim() && !passages.length) {
      const status = el(doc, "p", { class: "status" });
      status.append(
        el(doc, "span", { class: "lamp off", "aria-hidden": "true" }),
        doc.createTextNode(this.t.notFound),
      );
      parts.push(status);
    }
    const cited = order;
    if (finished && cited.length) {
      parts.push(text(doc, "p", this.t.sources, "sources-label"));
      const list = el(doc, "ol", { class: "sources" });
      for (const n of cited) {
        const p = passages[n - 1];
        if (!p) continue;
        const li = el(doc, "li");
        const a = el(doc, "a", { href: passageHref(p) });
        const ring = text(doc, "span", String(label(n)), "cite");
        ring.setAttribute("aria-hidden", "true");
        const where = el(doc, "span", { class: "where" });
        where.append(doc.createTextNode(p.title || p.url));
        if (p.heading && p.heading !== p.title) where.append(text(doc, "span", ` › ${p.heading}`));
        a.append(ring, where);
        li.append(a);
        list.append(li);
      }
      parts.push(list);
    }
    node.replaceChildren(...parts);
  }

  private async submit(): Promise<void> {
    const question = this.input.value.trim();
    if (!question || this.controller || !this.session) return;
    await this.session.settleChoice();
    if (
      this.session.needsDownloadConsent ||
      (this.session.mode === "local" && !(await this.session.canRunLocally()))
    ) {
      await this.showConsent(question);
      return;
    }
    if (await this.session.needsSetup()) {
      await this.showSetup(question);
      return;
    }
    const doc = this.ownerDocument;
    this.input.value = "";
    this.autosize();
    this.log.append(this.turnNode({ role: "user", content: question }));
    const node = el(doc, "div", { class: "msg bot" });
    const status = el(doc, "p", { class: "status" });
    status.append(
      el(doc, "span", { class: "lamp busy", "aria-hidden": "true" }),
      doc.createTextNode(this.t.thinking),
    );
    node.append(status);
    this.log.append(node);
    this.log.scrollTop = this.log.scrollHeight;
    this.log.setAttribute("aria-busy", "true");

    const controller = new AbortController();
    this.controller = controller;
    this.setSendMode("stop");
    this.emit({ state: "searching" });
    let started = false;
    try {
      const turn = await this.session.ask(
        question,
        (_text, t) => {
          if (!started) {
            started = true;
            this.emit({ state: "streaming", passages: t.passages ?? [] });
          }
          const stick = this.log.scrollHeight - this.log.scrollTop - this.log.clientHeight < 40;
          this.fillAnswer(node, t, false);
          if (stick) this.log.scrollTop = this.log.scrollHeight;
        },
        controller.signal,
      );
      this.fillAnswer(node, turn, true);
      this.emit(
        turn.error
          ? { state: "error" }
          : { state: "done", passages: turn.passages ?? [], cited: turn.cited ?? [] },
      );
    } catch (error) {
      node.remove();
      this.log.lastElementChild?.remove();
      this.emit({ state: "idle" });
      if (error instanceof SetupNeeded) await this.showSetup(question);
      else throw error;
    } finally {
      this.controller = null;
      this.setSendMode("send");
      this.log.setAttribute("aria-busy", "false");
      this.log.scrollTop = this.log.scrollHeight;
    }
  }

  /** Asks the visitor before downloading the in-browser model, or says why it cannot run. */
  private async showConsent(question: string): Promise<void> {
    if (!this.session) return;
    const doc = this.ownerDocument;
    const t = this.t;
    const session = this.session;
    const spec = await session.localSpec();
    const card = el(doc, "div", { class: "msg bot consent" });
    const row = el(doc, "div", { class: "row" });
    const useKey = () => {
      card.remove();
      session.useLocal(false);
      void this.showSetup(question);
    };
    if (!(await session.canRunLocally())) {
      card.append(text(doc, "p", session.keyAllowed ? t.localNoWebGPU : t.localNoWebGPUOnly));
      if (session.keyAllowed) {
        const key = el(doc, "button", { class: "primary", type: "button" });
        key.textContent = t.useKey;
        key.addEventListener("click", useKey);
        row.append(key);
      }
    } else {
      card.append(
        text(
          doc,
          "p",
          t.localConsent
            .replace("{name}", spec.name)
            .replace("{size}", size(spec.sizeMB, this.uiLang, t)),
        ),
      );
      const go = el(doc, "button", { class: "primary", type: "button" }) as HTMLButtonElement;
      go.textContent = t.localDownload;
      go.addEventListener("click", () => {
        session.agreeToDownload();
        card.remove();
        this.input.value = question;
        void this.submit();
      });
      row.append(go);
      if (session.keyAllowed) {
        const key = el(doc, "button", { class: "link-btn", type: "button" });
        key.textContent = t.useKey;
        key.addEventListener("click", useKey);
        row.append(key);
      }
    }
    card.append(row);
    this.log.append(card);
    this.log.scrollTop = this.log.scrollHeight;
    (row.querySelector("button") as HTMLButtonElement | null)?.focus();
  }

  /** The visitor's model settings, drawn from llm-connect's store. */
  private async showSetup(pending?: string): Promise<void> {
    if (!this.session) return;
    const doc = this.ownerDocument;
    const store = await this.session.store();
    await store.load();
    store.open();
    this.chatView.hidden = true;
    this.setupView.hidden = false;

    const t = this.t;
    const back = el(doc, "button", { class: "link-btn", type: "button" });
    back.textContent = t.back;
    back.addEventListener("click", () => this.hideSetup());

    const heading = text(doc, "h3", t.setupTitle);
    heading.style.cssText = "margin:0;font-size:17px;font-weight:650";
    const intro = text(doc, "p", t.setupIntro, "intro");

    // First choice: a model in this browser, no key at all.
    const session = this.session;
    const spec = await session.localSpec();
    const inBrowser = el(doc, "div", { class: "local-choice" });
    const localBtn = el(doc, "button", { class: "primary", type: "button" }) as HTMLButtonElement;
    localBtn.textContent = t.localOption;
    const localHint = text(
      doc,
      "small",
      t.localOptionHint
        .replace("{name}", spec.name)
        .replace("{size}", size(spec.sizeMB, this.uiLang, t)),
    );
    inBrowser.append(localBtn, localHint);
    localBtn.addEventListener("click", () => {
      session.useLocal(true);
      this.hideSetup();
      if (pending) {
        this.input.value = pending;
        void this.submit();
      }
    });
    // The block says which of the two is in use: the browser model (the default) or a key.
    const switchToKey = el(doc, "button", { class: "link-btn", type: "button" });
    switchToKey.textContent = t.useKey;
    switchToKey.addEventListener("click", () => {
      session.useLocal(false);
      localBtn.textContent = t.localOption;
      localBtn.disabled = false;
      switchToKey.remove();
    });
    if (session.mode === "local") {
      localBtn.textContent = t.localActive;
      localBtn.disabled = true;
      inBrowser.append(switchToKey);
    }
    void session.canRunLocally().then((ok) => {
      if (ok) return;
      localBtn.textContent = t.localOption;
      localBtn.disabled = true;
      localHint.textContent = t.localNoWebGPU;
      switchToKey.remove();
    });
    const or = text(doc, "p", t.orKey, "or");
    inBrowser.hidden = or.hidden = !session.localAllowed;

    const local = checkbox(doc, t.local);
    const providerField = field(doc, t.provider, el(doc, "select") as HTMLSelectElement);
    const providerSelect = providerField.control as HTMLSelectElement;
    const modelField = field(doc, t.model, el(doc, "select") as HTMLSelectElement);
    const modelSelect = modelField.control as HTMLSelectElement;
    const endpointField = field(
      doc,
      t.endpoint,
      el(doc, "input", { type: "url", inputmode: "url" }) as HTMLInputElement,
      t.localHint,
    );
    const endpointInput = endpointField.control as HTMLInputElement;
    const customModelField = field(
      doc,
      t.model,
      el(doc, "input", { type: "text", autocomplete: "off" }) as HTMLInputElement,
    );
    const customModelInput = customModelField.control as HTMLInputElement;
    const presets = el(doc, "div", { class: "presets" });
    for (const id of ["ollama", "lmstudio"] as const) {
      const b = el(doc, "button", { class: "text-btn", type: "button" });
      b.textContent = id === "ollama" ? "Ollama" : "LM Studio";
      b.addEventListener("click", async () => {
        const { ENDPOINT_PRESETS } = await import("llm-connect");
        store.applyPreset(ENDPOINT_PRESETS[id]);
      });
      presets.append(b);
    }
    const keyField = field(
      doc,
      t.apiKey,
      el(doc, "input", {
        type: "password",
        autocomplete: "off",
        spellcheck: "false",
      }) as HTMLInputElement,
      t.apiKeyHint,
    );
    const keyInput = keyField.control as HTMLInputElement;
    const remember = checkbox(doc, t.remember);

    const testBtn = el(doc, "button", { class: "text-btn", type: "button" }) as HTMLButtonElement;
    testBtn.textContent = t.test;
    const result = el(doc, "p", { class: "result", role: "status" });
    result.style.margin = "0";
    const saveBtn = el(doc, "button", { class: "primary", type: "button" }) as HTMLButtonElement;
    saveBtn.textContent = t.save;
    const forget = el(doc, "button", { class: "link-btn", type: "button" });
    forget.textContent = t.forget;

    local.input.addEventListener("change", () => store.toggleCustom(local.input.checked));
    providerSelect.addEventListener("change", () => store.selectProvider(providerSelect.value));
    modelSelect.addEventListener("change", () => store.selectModel(modelSelect.value));
    endpointInput.addEventListener("input", () => store.setEndpoint(endpointInput.value));
    customModelInput.addEventListener("input", () => store.setCustomModel(customModelInput.value));
    keyInput.addEventListener("input", () => store.setApiKey(keyInput.value));
    remember.input.addEventListener("change", () => store.setRememberKey(remember.input.checked));
    testBtn.addEventListener("click", () => void store.test());
    saveBtn.addEventListener("click", async () => {
      const saved = await store.save();
      if (!saved.ok) return;
      session.useLocal(false);
      this.hideSetup();
      if (pending) {
        this.input.value = pending;
        void this.submit();
      }
    });
    forget.addEventListener("click", () => void store.clear());

    const testRow = el(doc, "div", { class: "row" });
    testRow.append(testBtn, result);
    this.setupView.replaceChildren(
      back,
      heading,
      intro,
      inBrowser,
      or,
      local.label,
      providerField.label,
      modelField.label,
      presets,
      endpointField.label,
      customModelField.label,
      keyField.label,
      remember.label,
      testRow,
      saveBtn,
      forget,
    );

    const draw = (s: LlmSettingsState) => {
      const custom = s.draft.custom;
      local.input.checked = custom;
      providerField.label.hidden = custom;
      modelField.label.hidden = custom;
      presets.hidden = !custom;
      endpointField.label.hidden = !custom;
      customModelField.label.hidden = !custom;
      if (s.catalogStatus === "ready") {
        fillProviders(doc, providerSelect, s, t);
        fillModels(doc, modelSelect, s);
      } else {
        providerSelect.replaceChildren(
          option(doc, "", s.catalogStatus === "error" ? t.catalogError : t.loadingCatalog),
        );
        modelSelect.replaceChildren();
      }
      if (endpointInput !== this.root.activeElement) endpointInput.value = s.draft.customEndpoint;
      if (customModelInput !== this.root.activeElement)
        customModelInput.value = s.draft.customModel;
      if (keyInput !== this.root.activeElement) keyInput.value = s.apiKey;
      remember.input.checked = s.draft.rememberKey;
      testBtn.disabled = !s.canTest || s.testing;
      testBtn.textContent = s.testing ? t.testing : t.test;
      saveBtn.disabled = !s.canSave;
      const r = s.testResult;
      result.className = r ? (r.ok ? "result ok" : "result fail") : "result";
      result.textContent = !r
        ? ""
        : r.ok
          ? t.testOk
          : `${t.testFail} ${r.reason}${r.message ? ` (${r.message})` : ""}`;
    };
    this.unsubscribe?.();
    this.unsubscribe = store.subscribe(draw);
    // Start at the top, where the in-browser choice is offered first.
    this.setupView.scrollTop = 0;
    back.focus();
  }

  private hideSetup(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.setupView.hidden = true;
    this.chatView.hidden = false;
    this.input.focus();
  }
}

function fillProviders(
  doc: Document,
  select: HTMLSelectElement,
  s: LlmSettingsState,
  t: Messages,
): void {
  const groups: [string, typeof s.providers.recommended][] = [
    [t.recommended, s.providers.recommended],
    [t.otherProviders, s.providers.others],
  ];
  const signature = `${s.draft.providerId}|${s.providers.recommended.length + s.providers.others.length}`;
  if (select.dataset.sig === signature) return;
  select.dataset.sig = signature;
  select.replaceChildren(
    ...groups
      .filter(([, list]) => list.length)
      .map(([label, list]) => {
        const g = doc.createElement("optgroup");
        g.label = label;
        g.append(...list.map((p) => option(doc, p.id, p.name)));
        return g;
      }),
  );
  select.value = s.draft.providerId;
}

function fillModels(doc: Document, select: HTMLSelectElement, s: LlmSettingsState): void {
  const signature = `${s.draft.providerId}|${s.draft.model}|${s.models.length}`;
  if (select.dataset.sig === signature) return;
  select.dataset.sig = signature;
  const rec = s.recommendedModel?.id;
  select.replaceChildren(
    ...s.models.map((m) => option(doc, m.id, m.id === rec ? `${m.name} ★` : m.name)),
  );
  select.value = s.draft.model;
}

/** sessionStorage, or nothing where the page may not use it (sandboxed frames, blocked storage). */
function tabStorage(op: "get" | "set" | "remove", key: string): boolean {
  try {
    if (op === "set") sessionStorage.setItem(key, "1");
    else if (op === "remove") sessionStorage.removeItem(key);
    else return sessionStorage.getItem(key) !== null;
  } catch {}
  return false;
}

/** Runs work when the page has nothing better to do (or soon, where idle callbacks are missing). */
function whenIdle(work: () => void): void {
  const idle = (
    globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }
  ).requestIdleCallback;
  if (idle) idle(work, { timeout: 4000 });
  else setTimeout(work, 1500);
}

function el(doc: Document, tag: string, attrs: Record<string, string> = {}): HTMLElement {
  const node = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

function text(doc: Document, tag: string, value: string, cls?: string): HTMLElement {
  const node = doc.createElement(tag);
  node.textContent = value;
  if (cls) node.className = cls;
  return node;
}

function option(doc: Document, value: string, label: string): HTMLOptionElement {
  const o = doc.createElement("option");
  o.value = value;
  o.textContent = label;
  return o;
}

function iconButton(doc: Document, name: string, label: string): HTMLButtonElement {
  const b = el(doc, "button", {
    class: "icon-btn",
    type: "button",
    title: label,
  }) as HTMLButtonElement;
  b.setAttribute("aria-label", label);
  b.append(icon(doc, name));
  return b;
}

function field(
  doc: Document,
  label: string,
  control: HTMLInputElement | HTMLSelectElement,
  hint?: string,
): { label: HTMLLabelElement; control: HTMLInputElement | HTMLSelectElement } {
  const wrap = el(doc, "label", { class: "field" }) as HTMLLabelElement;
  wrap.append(text(doc, "span", label), control);
  if (hint) wrap.append(text(doc, "small", hint));
  return { label: wrap, control };
}

function checkbox(
  doc: Document,
  label: string,
): { label: HTMLLabelElement; input: HTMLInputElement } {
  const wrap = el(doc, "label", { class: "check" }) as HTMLLabelElement;
  const input = el(doc, "input", { type: "checkbox" }) as HTMLInputElement;
  wrap.append(input, doc.createTextNode(label));
  return { label: wrap, input };
}

export type { LlmSettingsStore };
