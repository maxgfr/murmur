import { MurmurChat } from "./element";
import type { WidgetOptions } from "./session";

export { MurmurChat, type MurmurStateDetail } from "./element";
export { MESSAGES, type Messages, messagesFor, pickLanguage } from "./i18n";
export { type CitationRenderer, renderMarkdown } from "./markdown";
export { type ChatTurn, SetupNeeded, type WidgetOptions } from "./session";

/** Registers `<murmur-chat>` (or another tag name) once. */
export function defineMurmurChat(tag = "murmur-chat"): typeof MurmurChat {
  if (!customElements.get(tag)) customElements.define(tag, class extends MurmurChat {});
  return customElements.get(tag) as typeof MurmurChat;
}

/** Adds a configured widget to the page (the floating bubble, or `inline` inside `target`). */
export function mountMurmur(
  options: WidgetOptions & { target?: Element; inline?: boolean } = {},
): MurmurChat {
  defineMurmurChat();
  const { target, inline, ...rest } = options;
  const widget = document.createElement("murmur-chat") as MurmurChat;
  if (inline) widget.setAttribute("inline", "");
  widget.configure(rest);
  (target ?? document.body).append(widget);
  return widget;
}
