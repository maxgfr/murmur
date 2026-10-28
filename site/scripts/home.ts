import type { SlimCatalog } from "llm-models/catalog";
import {
  type MurmurChat,
  type MurmurStateDetail,
  mountMurmur,
  type WidgetOptions,
} from "../../src/widget/index";
import { switchboard } from "./board";
import { lang, rememberLanguageChoice, root, t, wireCopyButtons } from "./common";

const CDN = "https://maxgfr.github.io/murmur/cdn/murmur.js";
const RECOMMENDED = ["openai", "anthropic", "google", "mistral", "openrouter", "groq"];

wireCopyButtons();
rememberLanguageChoice();

// Line 1: the live widget, inline in the console, answering from this site's index.
const handset = document.getElementById("handset") as HTMLElement;
const widget = mountMurmur({
  target: handset,
  inline: true,
  index: "murmur-index.json",
  lang,
  catalogUrl: `${root}cdn/models.json`,
  storageKey: "murmur-demo",
  messages: { greeting: t("board.greeting") },
});

const board = switchboard(
  document.getElementById("jackfield") as HTMLElement,
  document.getElementById("oplog") as HTMLOListElement,
  document.getElementById("cords") as unknown as SVGSVGElement,
  handset,
);
fetch("murmur-index.json")
  .then((r) => r.json())
  .then(board.load)
  .catch(() => {});
widget.addEventListener("murmur:state", (e) =>
  board.onState((e as CustomEvent<MurmurStateDetail>).detail),
);

for (const button of document.querySelectorAll<HTMLButtonElement>(".prompts button")) {
  button.addEventListener("click", () => void widget.ask(button.textContent ?? ""));
}

// Line 2: the configurator.
const form = document.getElementById("configurator") as HTMLFormElement;
const out = document.getElementById("wire-snippet") as HTMLElement;
const warn = document.getElementById("wire-warn") as HTMLElement;
const providerSelect = form.elements.namedItem("provider") as HTMLSelectElement;
const models = document.getElementById("models") as HTMLDataListElement;
let catalog: SlimCatalog = {};

fetch(`${root}cdn/models.json`)
  .then((r) => r.json() as Promise<SlimCatalog>)
  .then((c) => {
    catalog = c;
    const ids = Object.keys(c);
    const first = RECOMMENDED.filter((id) => c[id]);
    const rest = ids
      .filter((id) => !first.includes(id))
      .sort((a, b) => (c[a]?.name ?? a).localeCompare(c[b]?.name ?? b));
    for (const id of [...first, ...rest]) providerSelect.add(new Option(c[id]?.name ?? id, id));
  })
  .catch(() => {});

const value = (name: string) =>
  ((form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? "").trim();
const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function config(): { attrs: [string, string][]; options: WidgetOptions } {
  const mode = value("mode");
  const attrs: [string, string][] = [];
  const options: WidgetOptions = { llm: {} };
  const llm = options.llm ?? {};
  const add = (key: string, v: string) => v && attrs.push([key, v]);
  add("data-index", value("index"));
  if (value("index")) options.index = value("index");
  if (mode === "proxy") {
    add("data-endpoint", value("endpoint"));
    add("data-model", value("proxyModel"));
    if (value("endpoint")) llm.endpoint = value("endpoint");
    if (value("proxyModel")) llm.model = value("proxyModel");
  } else {
    add("data-provider", value("provider"));
    add("data-model", value("model"));
    if (value("provider")) llm.provider = value("provider");
    if (value("model")) llm.model = value("model");
  }
  add("data-title", value("title"));
  add("data-greeting", value("greeting"));
  add("data-instructions", value("instructions"));
  add("data-lang", value("lang"));
  add("data-position", value("position"));
  const accent = value("accentText");
  add("data-accent", accent);
  const messages: NonNullable<WidgetOptions["messages"]> = {};
  if (value("title")) messages.title = value("title");
  if (value("greeting")) messages.greeting = value("greeting");
  options.messages = messages;
  if (value("instructions")) options.instructions = value("instructions");
  if (value("lang")) options.lang = value("lang");
  if (value("position") === "bottom-left") options.position = "bottom-left";
  if (accent) options.accent = accent;
  return { attrs, options };
}

function update() {
  const mode = value("mode");
  for (const el of form.querySelectorAll<HTMLElement>("[data-when]"))
    el.hidden = el.dataset.when !== mode;
  const provider = catalog[value("provider")];
  const modelInput = form.elements.namedItem("model") as HTMLInputElement;
  modelInput.placeholder = provider?.defaultModel ?? t("wire.modelPlaceholder");
  if (models.dataset.provider !== value("provider")) {
    models.dataset.provider = value("provider");
    models.replaceChildren(
      ...Object.values(provider?.models ?? {}).map((m) => new Option(m.name, m.id)),
    );
  }
  const endpoint = value("endpoint");
  const badEndpoint =
    mode === "proxy" &&
    endpoint !== "" &&
    !/^https:\/\/|^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(endpoint);
  warn.hidden = !badEndpoint;
  warn.textContent = badEndpoint ? t("wire.warnEndpoint") : "";
  const { attrs } = config();
  const lines = [
    `<script type="module" src="${CDN}"`,
    ...attrs.map(([k, v]) => `  ${k}="${attr(v)}"`),
  ];
  const next = `${lines.join("\n")}></script>`;
  if (out.textContent && out.textContent !== next) flash();
  out.textContent = next;
}

// The output's lamp lights each time the line changes or is copied.
const lamp = document.getElementById("wire-lamp");
let lampTimer = 0;
function flash() {
  if (!lamp) return;
  lamp.classList.add("on");
  clearTimeout(lampTimer);
  lampTimer = window.setTimeout(() => lamp.classList.remove("on"), 900);
}
document.querySelector('[data-copy="wire-snippet"]')?.addEventListener("click", flash);

const accentPicker = form.elements.namedItem("accent") as HTMLInputElement;
const accentText = form.elements.namedItem("accentText") as HTMLInputElement;
accentPicker.addEventListener("input", () => {
  accentText.value = accentPicker.value;
});
accentText.addEventListener("input", () => {
  if (/^#[0-9a-f]{6}$/i.test(accentText.value)) accentPicker.value = accentText.value;
});
form.addEventListener("input", update);
form.addEventListener("change", update);
update();

let trial: MurmurChat | null = null;
document.getElementById("try")?.addEventListener("click", () => {
  trial?.remove();
  const { options } = config();
  trial = mountMurmur({
    ...options,
    open: true,
    storageKey: "murmur-try",
    catalogUrl: `${root}cdn/models.json`,
  });
});
