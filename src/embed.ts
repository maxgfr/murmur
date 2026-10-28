import type { WidgetOptions } from "./widget/index";
import { mountMurmur } from "./widget/index";

/**
 * The one-line embed: reads the options from the script tag's data attributes and adds the
 * widget. `<script type="module" src=".../murmur.js" data-index="/murmur-index.json"></script>`
 */
export function optionsFromDataset(data: DOMStringMap, base: string): WidgetOptions {
  const o: WidgetOptions = {};
  if (data.index) o.index = new URL(data.index, base).href;
  const llm: NonNullable<WidgetOptions["llm"]> = {};
  if (data.provider) llm.provider = data.provider;
  if (data.model) llm.model = data.model;
  if (data.endpoint) llm.endpoint = data.endpoint;
  if (Object.keys(llm).length) o.llm = llm;
  if (data.instructions) o.instructions = data.instructions;
  if (data.lang) o.lang = data.lang;
  const messages: NonNullable<WidgetOptions["messages"]> = {};
  if (data.title) messages.title = data.title;
  if (data.greeting) messages.greeting = data.greeting;
  if (data.placeholder) messages.placeholder = data.placeholder;
  if (data.button) messages.open = data.button;
  if (Object.keys(messages).length) o.messages = messages;
  if (data.position === "bottom-left" || data.position === "bottom-right")
    o.position = data.position;
  if (data.theme === "light" || data.theme === "dark" || data.theme === "auto")
    o.theme = data.theme;
  if (data.accent) o.accent = data.accent;
  if (data.catalog) o.catalogUrl = new URL(data.catalog, base).href;
  if (data.storageKey) o.storageKey = data.storageKey;
  if (data.open === "true") o.open = true;
  return o;
}

function start(): void {
  const self = import.meta.url;
  const tag = [...document.querySelectorAll<HTMLScriptElement>("script[src]")].find(
    (s) => s.src === self && !s.dataset.murmurReady,
  );
  if (tag) tag.dataset.murmurReady = "true";
  const options = optionsFromDataset(tag?.dataset ?? {}, location.href);
  options.catalogUrl ??= new URL("./models.json", self).href;
  mountMurmur(options);
}

if (typeof document !== "undefined" && !document.querySelector("murmur-chat:not([inline])")) {
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
}
