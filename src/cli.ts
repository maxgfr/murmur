#!/usr/bin/env node
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { parseArgs } from "node:util";
import { parseHTML } from "linkedom";
import { pageOf, urlOf } from "./indexer/files";
import { DEFAULT_EXCLUDE, type IndexOptions, indexPages, type PageInput } from "./indexer/index";

const HELP = `murmur index <dir|file|url>... [options]

Builds the index the murmur widget answers from: every .html, .md and .txt file
under the given folders (your site's build output), or the pages of a live
site's sitemap.xml.

Options
  -o, --out <file>      Where to write the index (default: murmur-index.json)
  -b, --base <url>      URL prefix of the pages (default: /)
      --root <css>      Content root of a page (default: main, article, body)
      --exclude <css>   Extra elements to skip, added to the defaults
      --max-chunk <n>   Longest passage in characters (default: 2000)
  -h, --help            Show this help`;

const TEXT = new Set([".html", ".htm", ".md", ".mdx", ".markdown", ".txt"]);

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(path)));
    else if (TEXT.has(extname(entry.name).toLowerCase())) out.push(path);
  }
  return out;
}

async function fromUrl(url: string): Promise<PageInput[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const body = await res.text();
  if (!/<urlset|<sitemapindex/.test(body)) return [pageOf(url, body, "html")];
  const locs = [...body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1] ?? "");
  const pages: PageInput[] = [];
  for (const loc of locs) pages.push(...(await fromUrl(loc)));
  return pages;
}

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      out: { type: "string", short: "o", default: "murmur-index.json" },
      base: { type: "string", short: "b", default: "/" },
      root: { type: "string" },
      exclude: { type: "string" },
      "max-chunk": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (command !== "index" || values.help || positionals.length === 0) {
    console.log(HELP);
    return command === "index" || values.help ? 0 : 1;
  }

  const pages: PageInput[] = [];
  for (const input of positionals) {
    if (/^https?:\/\//.test(input)) {
      pages.push(...(await fromUrl(input)));
      continue;
    }
    const info = await stat(input);
    const files = info.isDirectory() ? await walk(input) : [input];
    const rootDir = info.isDirectory() ? input : join(input, "..");
    for (const file of files) {
      const kind = extname(file).toLowerCase();
      pages.push(pageOf(urlOf(file, rootDir, values.base), await readFile(file, "utf8"), kind));
    }
  }

  const options: IndexOptions = {
    parseHtml: (html) => parseHTML(html).document as unknown as Document,
    exclude: values.exclude ? `${DEFAULT_EXCLUDE},${values.exclude}` : DEFAULT_EXCLUDE,
  };
  if (values.root) options.root = values.root;
  if (values["max-chunk"]) options.maxChunk = Number(values["max-chunk"]);
  const index = indexPages(pages, options);
  await writeFile(values.out, `${JSON.stringify(index)}\n`);
  const kb = (Buffer.byteLength(JSON.stringify(index)) / 1024).toFixed(1);
  console.log(
    `${index.docs.length} pages, ${index.chunks.length} passages → ${values.out} (${kb} KB)`,
  );
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
