import { relative, sep } from "node:path";
import type { PageInput } from "./index";

/** URL of a file under the site root: `docs/index.html` → `/docs/`. */
export function urlOf(file: string, rootDir: string, base: string): string {
  const rel = relative(rootDir, file).split(sep).join("/");
  const path = rel.replace(/(^|\/)index\.html?$/i, "$1");
  return `${base.replace(/\/?$/, "/")}${path}`;
}

export function pageOf(url: string, body: string, kind: string): PageInput {
  if (kind === ".html" || kind === ".htm" || kind === "html") return { url, html: body };
  if (kind === ".txt") return { url, text: body };
  return { url, markdown: body };
}
