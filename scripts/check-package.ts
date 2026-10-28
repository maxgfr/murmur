// Packs murmur-rag as npm would publish it, installs the tarball in a scratch project and
// checks what a consumer gets: the CLI, Node imports of every server-safe entry point, and
// the types under both `nodenext` and `bundler` resolution.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { $ } from "bun";

const root = resolve(import.meta.dir, "..");
const dir = await mkdtemp(join(tmpdir(), "murmur-package-"));
try {
  const tarball = (await $`npm pack --silent --pack-destination ${dir}`.cwd(root).text()).trim();
  await Bun.write(
    join(dir, "package.json"),
    JSON.stringify({ name: "consumer", private: true, type: "module" }),
  );
  await $`npm install --silent --no-audit --no-fund ${join(dir, tarball)} typescript@7`.cwd(dir);

  await Bun.write(
    join(dir, "site/index.html"),
    '<main><h1>Acme</h1><h2 id="prix">Prix</h2><p>Le plan Pro coûte 12 euros.</p></main>',
  );
  await $`npx murmur index site --base /acme/ --out idx.json`.cwd(dir);

  await Bun.write(
    join(dir, "run.mjs"),
    `import { readFileSync } from "node:fs";
import { createMurmur, bm25Retriever } from "murmur-rag";
import { indexPages } from "murmur-rag/indexer";
import { isMurmurIndex } from "murmur-rag/rag";
import { proxySettings } from "murmur-rag/llm";
// The browser entry points must import on a server (SSR) without touching the DOM.
await import("murmur-rag/widget");
await import("murmur-rag/embed");
const local = await import("murmur-rag/local");
if (local.DEFAULT_LOCAL_MODEL.id !== "onnx-community/LFM3-1.7B-ONNX" || await local.hasWebGPU()) throw new Error("local");
const index = JSON.parse(readFileSync("idx.json", "utf8"));
if (!isMurmurIndex(index)) throw new Error("bad index");
const hits = await bm25Retriever(index).search("combien coûte le plan pro");
if (hits[0]?.anchor !== "prix") throw new Error("retrieval: " + JSON.stringify(hits));
if (indexPages([{ url: "/r", markdown: "# R\\n## A\\ntext" }]).chunks.length !== 1) throw new Error("indexer");
if (!proxySettings({ endpoint: "https://x.dev/v1" })) throw new Error("llm");
if (typeof createMurmur !== "function") throw new Error("core");
console.log("node imports ok");
`,
  );
  await $`node run.mjs`.cwd(dir);

  await Bun.write(
    join(dir, "types.ts"),
    `import { createMurmur, type Retriever, type MurmurIndex, type Passage } from "murmur-rag";
import { bm25Retriever, citedSources } from "murmur-rag/rag";
import { indexPages, type PageInput } from "murmur-rag/indexer";
import { proxySettings, type LlmConfig } from "murmur-rag/llm";
import { mountMurmur, type MurmurChat, type WidgetOptions } from "murmur-rag/widget";
import { optionsFromDataset } from "murmur-rag/embed";
import { localModel, type LocalModelSpec } from "murmur-rag/local";
const spec: LocalModelSpec = { id: "x", dtype: "q4f16", name: "x", sizeMB: 1 };
export const lm = localModel({ spec });
const index: MurmurIndex = { version: 1, generatedAt: "", docs: [], chunks: [] };
const retriever: Retriever = bm25Retriever(index);
const page: PageInput = { url: "/", markdown: "# x" };
const llm: LlmConfig = { endpoint: "https://x.dev/v1", model: "m" };
const options: WidgetOptions = { llm, lang: "fr", retriever };
const passages: Passage[] = [];
export const all = [createMurmur, citedSources, indexPages([page]), proxySettings(llm), mountMurmur, optionsFromDataset, options, passages];
export type W = MurmurChat;
`,
  );
  const common = [
    "--noEmit",
    "--strict",
    "--skipLibCheck",
    "--lib",
    "es2023,dom,dom.iterable",
    "types.ts",
  ];
  await $`npx tsc --module nodenext --moduleResolution nodenext ${common}`.cwd(dir);
  await $`npx tsc --module preserve --moduleResolution bundler ${common}`.cwd(dir);
  console.log("types ok (nodenext, bundler)");
} finally {
  await rm(dir, { recursive: true, force: true });
}
