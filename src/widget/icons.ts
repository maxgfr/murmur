/** Icons drawn for murmur: 24px grid, 1.75 stroke, round caps. */
const PATHS: Record<string, string> = {
  chat: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.4c-.5.4-1.3 0-1.3-.6V6.5Z"/><path d="M8.5 9h7M8.5 12h4.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  send: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="1.5"/>',
  settings:
    '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  reset: '<path d="M5 12a7 7 0 1 0 2.1-5"/><path d="M5 4.5V8h3.5"/>',
  back: '<path d="M14.5 6 8.5 12l6 6"/>',
  check: '<path d="m5.5 12.5 4 4 9-9"/>',
  key: '<circle cx="8" cy="15" r="3.5"/><path d="m10.5 12.5 8-8M16 7l2 2M14 9l1.5 1.5"/>',
};

export function icon(doc: Document, name: keyof typeof PATHS | string): SVGSVGElement {
  const t = doc.createElement("template");
  // Static, trusted markup from this file only.
  t.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${PATHS[name] ?? ""}</svg>`;
  return t.content.firstElementChild as SVGSVGElement;
}
