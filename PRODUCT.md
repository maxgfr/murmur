# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Bun (install, test, bundler for the library and the site), TypeScript, no UI framework: the widget is a custom element (`<murmur-chat>`) in an open Shadow DOM so it drops into any page without clashing with the host's CSS. The site is static HTML built with Bun's HTML bundler and deployed to GitHub Pages. Published to npm as `murmur-rag`.

## Users

Two audiences, both owners of a website:

- **Developers with static sites**: docs, portfolios, open-source projects on GitHub Pages, Astro, Hugo, Eleventy. Comfortable with a script tag, a CLI step in their build (`murmur index`), the npm package's headless API, and deploying a small Worker as a proxy.
- **Small non-technical structures**: a shop, an association, a showcase site. They copy a snippet from the configurator and paste it; they should never need a terminal to get a working widget.

Their visitors are the people who type questions in the widget: anyone reading the site, on phone or desktop, often in a hurry, in French or English.

## Product Purpose

murmur adds an AI chat bubble to any website, in the spirit of a support chat, that answers visitors from the site's own content (a mini RAG) with the LLM the owner picks. No backend to run and no account: the index is a static JSON file, retrieval (BM25) runs in the visitor's browser, and the model is called directly from the browser.

Success: an owner goes from "nothing" to a widget that answers correctly, with links to the right page, in minutes; a visitor gets a sourced answer instead of searching the site.

## Positioning

- Serverless and static: works on GitHub Pages; the only optional moving part is a proxy the owner controls.
- No key ever sits in the page. Either the owner points the widget at their own OpenAI-compatible proxy (visitors just chat), or each visitor brings their own key, encrypted in their browser by llm-connect.
- Any provider: OpenAI, Anthropic, Google, Mistral, OpenRouter, Groq, Ollama… through llm-connect and the llm-models catalog (same author, maxgfr).
- Answers cite their sources and link to the exact heading of the page.
- Modular: one script tag for everyone, or npm subpaths (`murmur-rag`, `/rag`, `/indexer`, `/widget`, `/embed`, `/llm`) to use only the retrieval, only the UI, or bring your own retriever/model.

Sibling of `maxgfr/ephemeral` (a one-line widget for static sites, P2P presence): same "one line, no backend, GitHub Pages" promise.

## Operating Context

- Owner flow: open the configurator on maxgfr.github.io/murmur, choose provider/model or a proxy URL, texts, position, accent; copy the snippet; optionally run `npx murmur-rag index ./dist` in the build to ship `murmur-index.json`. Without an index, the widget indexes the page it is on.
- Visitor flow: open the bubble, ask, read a streamed answer with numbered citations. In BYOK mode, the first question opens a settings view (provider, model, key, connection test).
- Testing flow: the playground lets anyone paste text or Markdown/HTML, index it in the browser and chat with it, with their own key or a local Ollama.

## Capabilities and Constraints

- Embedded in pages we do not control: style isolation, never break the host page, fail silently, small initial script with provider SDKs loaded lazily.
- Keys: never in HTML; visitor keys stored with llm-connect's `secureStorage` (AES-GCM, non-extractable key in IndexedDB).
- Retrieval is keyword-based (BM25); fine for small and medium sites, not semantic. The retriever is pluggable.
- CORS: only providers that accept browser calls work in BYOK mode (OpenAI, Anthropic, Google, Mistral, OpenRouter, Groq, Together, DeepInfra, xAI, local servers with CORS on).
- i18n: French and English at launch for the widget and the site, structured so more languages can be added; the widget follows `data-lang`, else the host page's `lang`, else the browser.

## Brand Commitments

- Name: murmur. npm package: `murmur-rag` (`murmur` is taken on npm).
- Author: maxgfr; MIT licence; part of the maxgfr.github.io family of tools.

## Evidence on Hand

- No users, testimonials, metrics or benchmarks yet: do not invent any.
- The demo answers from murmur's own README and docs, indexed at build time.

## Product Principles

1. One line works: the script tag alone must give a useful widget; everything else is optional.
2. Nothing secret in the page: the design never asks an owner to paste a key into HTML.
3. Show the source: every answer points back to the site; "not found on this site" beats an invented answer.
4. Guest in someone else's house: the widget adapts to the host (accent, position, language, light/dark) and never fights its layout.
5. Modular by default: each layer (index, retrieval, model, UI) can be used or replaced on its own.

## Accessibility & Inclusion

WCAG 2.2 AA for the widget and the site: full keyboard use, visible focus, the panel as a labelled dialog that returns focus to the bubble, streamed answers announced politely (`aria-live`), reduced motion respected, readable in light and dark, usable full-screen on small phones.
