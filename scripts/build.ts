// Builds the npm library (dist/lib, dist/types, dist/cli.js), the CDN bundle (dist/cdn)
// and the GitHub Pages site (dist/site). `bun scripts/build.ts [lib|site]` builds one part.
import { cp, mkdir, rm } from "node:fs/promises";
import { $ } from "bun";
import { DEFAULT_LANG, generate, LANGS } from "./pages";

const part = process.argv[2] ?? "all";

async function lib() {
  await rm("dist/lib", { recursive: true, force: true });
  await rm("dist/types", { recursive: true, force: true });
  const res = await Bun.build({
    entrypoints: [
      "src/index.ts",
      "src/rag/index.ts",
      "src/indexer/index.ts",
      "src/llm/index.ts",
      "src/widget/index.ts",
      "src/embed.ts",
    ],
    root: "src",
    outdir: "dist/lib",
    target: "browser",
    format: "esm",
    splitting: true,
    packages: "external",
    naming: { entry: "[dir]/[name].js", chunk: "chunks/[name]-[hash].js" },
  });
  if (!res.success) throw new AggregateError(res.logs, "lib build failed");
  const cli = await Bun.build({
    entrypoints: ["src/cli.ts"],
    outdir: "dist",
    target: "node",
    format: "esm",
    packages: "external",
  });
  if (!cli.success) throw new AggregateError(cli.logs, "cli build failed");
  await $`bunx tsc -p tsconfig.build.json`;
}

async function cdn() {
  await rm("dist/cdn", { recursive: true, force: true });
  const res = await Bun.build({
    entrypoints: ["src/embed.ts"],
    outdir: "dist/cdn",
    target: "browser",
    format: "esm",
    splitting: true,
    minify: true,
    naming: { entry: "murmur.js", chunk: "[name]-[hash].js" },
    define: { "process.env.NODE_ENV": '"production"' },
  });
  if (!res.success) throw new AggregateError(res.logs, "cdn build failed");
  await cp("assets/models.json", "dist/cdn/models.json");
  const entry = Bun.file("dist/cdn/murmur.js");
  const gz = Bun.gzipSync(new Uint8Array(await entry.arrayBuffer())).length;
  console.log(
    `cdn: murmur.js ${(entry.size / 1024).toFixed(1)} KB, ${(gz / 1024).toFixed(1)} KB gzip`,
  );
}

async function site() {
  await rm("dist/site", { recursive: true, force: true });
  const pages = await generate();
  const res = await Bun.build({
    entrypoints: pages,
    outdir: "dist/site",
    target: "browser",
    minify: true,
    root: "site/_gen",
    naming: {
      entry: "[dir]/[name].[ext]",
      chunk: "assets/[name]-[hash].[ext]",
      asset: "assets/[name]-[hash].[ext]",
    },
  });
  if (!res.success) throw new AggregateError(res.logs, "site build failed");
  await cp("dist/cdn", "dist/site/cdn", { recursive: true });
  await cp("site/static", "dist/site", { recursive: true });
  await Bun.write("dist/site/.nojekyll", "");
  // Dogfood: each language's widget answers from an index of that language's built pages.
  for (const lang of LANGS) {
    const dir = lang === DEFAULT_LANG ? "dist/site" : `dist/site/${lang}`;
    const base = lang === DEFAULT_LANG ? "/murmur/" : `/murmur/${lang}/`;
    const files = ["index.html", "guide.html", "playground.html"].map((f) => `${dir}/${f}`);
    await $`bun src/cli.ts index ${files} --base ${base} --out ${dir}/murmur-index.json --exclude .no-index`;
  }
}

await mkdir("dist", { recursive: true });
if (part === "all" || part === "lib") await lib();
if (part === "all" || part === "site" || part === "cdn") await cdn();
if (part === "all" || part === "site") await site();
