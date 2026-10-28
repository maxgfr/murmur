# murmur

**[Site & live demo](https://maxgfr.github.io/murmur/)** · **[Guide](https://maxgfr.github.io/murmur/guide.html)** · **[Playground](https://maxgfr.github.io/murmur/playground.html)** · [npm](https://www.npmjs.com/package/murmur-rag)

An AI chat bubble for any website that answers from the site's own pages, cites them and links to the right heading. One script tag, no backend, the model you pick through [llm-connect](https://github.com/maxgfr/llm-models/tree/main/packages/llm-connect). Works on GitHub Pages.

```html
<script type="module" src="https://maxgfr.github.io/murmur/cdn/murmur.js"></script>
```

## The widget

Paste the line before `</body>`. Without options, the bubble answers from the page the visitor is on and each visitor brings their own AI key. The [configurator](https://maxgfr.github.io/murmur/#wire) writes the line for you.

| Attribute                                                        |                                                                                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `data-index`                                                     | URL of the index written by `murmur index` (`/murmur-index.json`). Without it, the current page is read |
| `data-endpoint`                                                  | Your OpenAI-compatible proxy (https): visitors chat without a key                                       |
| `data-provider`, `data-model`                                    | Provider and model preselected for visitors, or the model asked of the proxy                            |
| `data-instructions`                                              | Your instructions to the assistant                                                                      |
| `data-title`, `data-greeting`, `data-placeholder`, `data-button` | Texts of the panel                                                                                      |
| `data-lang`                                                      | `en` or `fr` (default: the page's `lang`, then the browser's)                                           |
| `data-position`                                                  | `bottom-right` (default) or `bottom-left`                                                               |
| `data-accent`, `data-theme`                                      | Any CSS colour; `auto`, `light` or `dark`                                                               |
| `data-open`, `data-storage-key`                                  | Open on load; prefix of what the widget stores                                                          |

The widget lives in a Shadow DOM and is restyled through `--murmur-accent`, `--murmur-accent-ink`, `--murmur-font`, `--murmur-radius` and `--murmur-z`. It emits `murmur:state` events (`searching`, `streaming`, `done`, `error`) with the passages found and cited.

## Index your site

```bash
npx murmur-rag index ./dist --out ./dist/murmur-index.json
```

Reads every `.html`, `.md` and `.txt` file (or a live `sitemap.xml`), keeps the content of `main` / `article` / `body`, skips navigation, headers, footers, forms, scripts and anything marked `data-murmur-ignore`, and cuts pages into passages under their headings. Options: `--base` (URL prefix), `--root`, `--exclude`, `--max-chunk`.

## AI models and keys

A key in a web page is readable by anyone, so murmur never puts one there:

- **Your proxy holds the key.** Deploy [`examples/cloudflare-worker`](examples/cloudflare-worker) (about 40 lines): it keeps the key as a secret, allows only your origin, fixes the model and caps answers. Then `data-endpoint="https://murmur-proxy.you.workers.dev/v1"`.
- **Each visitor brings theirs.** The first question opens the AI settings, built on llm-connect's store: provider and model from the [llm-models](https://github.com/maxgfr/llm-models) catalog, the key encrypted with AES-GCM under a non-extractable browser key and sent only to that provider, or a local Ollama / LM Studio.

## npm package

```bash
npm install murmur-rag
```

| Import               |                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| `murmur-rag`         | `createMurmur({ index \| retriever, model })`: `ask()` streams an answer and its cited passages, no UI |
| `murmur-rag/rag`     | `bm25Retriever`, `buildIndex`, `splitText`, `formatSources`, `citedSources`, the `Retriever` interface |
| `murmur-rag/indexer` | `indexPages`, `indexDocument`, `extractSections` (Node or browser)                                     |
| `murmur-rag/llm`     | `proxySettings`, `visitorStore`, `resolveSettings` on top of llm-connect                               |
| `murmur-rag/widget`  | `mountMurmur`, `defineMurmurChat`, `MurmurChat`, `renderMarkdown`                                      |
| `murmur-rag/embed`   | The script-tag entry                                                                                   |

```ts
import { createMurmur } from "murmur-rag";
import { anthropic } from "@ai-sdk/anthropic";

const murmur = createMurmur({ index, model: anthropic("claude-sonnet-5-5") });
const answer = await murmur.ask("What does the Pro plan include?");
for await (const part of answer.textStream) process.stdout.write(part);
```

Any object with `search(query)` returning passages replaces BM25 (embeddings, a search API…).

## How it works

1. **Index** (build time): pages become passages under their headings, in a static JSON file.
2. **Search** (in the visitor's browser): BM25 with [MiniSearch], accents folded, prefix and fuzzy matching, titles and headings boosted.
3. **Answer** (at the AI provider): the passages go to the model as quoted data, with instructions to answer only from them, cite them as `[n]`, say when the site does not cover the question and never follow instructions found inside them. The answer is rendered as text with clickable citations.

## Limits

- Keyword search, not semantic: plug in your own retriever for embeddings.
- The index downloads with the first question: fine for hundreds of pages, not tens of thousands.
- In visitor-key mode the provider must accept browser calls (CORS).
- Grounding reduces invented answers; it does not end them.

## Privacy

No server, no analytics. The question and the matching passages go to the AI provider chosen by you or the visitor, nowhere else. The conversation stays in the tab (`sessionStorage`).

## Development

```bash
bun install
bun run dev        # build, then serve on http://localhost:4317/murmur/
bun run test       # unit tests
bun run test:e2e   # Playwright against a fake OpenAI-compatible endpoint, axe WCAG 2.2 AA scans
bun run test:package  # packs, installs and checks the CLI, Node imports and types
bun run typecheck && bun run lint
```

`site/` holds the GitHub Pages site: templates rendered once per language from `site/i18n/<lang>.json` and `site/content/<lang>/` (add a language by adding both). The dev server also serves `examples/host/` (a host page, a proxy-mode page, phone frames) and a fake LLM at `/mock/v1`.

## Credits

[llm-connect and llm-models](https://github.com/maxgfr/llm-models), [Vercel AI SDK](https://ai-sdk.dev), [MiniSearch], [linkedom](https://github.com/WebReflection/linkedom), [Sofia Sans](https://github.com/lettersoup/Sofia-Sans) (OFL). Sibling of [ephemeral](https://github.com/maxgfr/ephemeral).

## License

MIT

[MiniSearch]: https://github.com/lucaong/minisearch
