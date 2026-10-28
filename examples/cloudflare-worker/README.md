# murmur proxy (Cloudflare Worker)

Lets visitors chat without bringing a key: the key lives in the Worker as a secret, and the page
only knows the Worker's URL.

```bash
npx wrangler deploy
npx wrangler secret put UPSTREAM_KEY
```

Edit `wrangler.toml` first:

| Variable          |                                                                      |
| ----------------- | -------------------------------------------------------------------- |
| `UPSTREAM_URL`    | Any OpenAI-compatible API (OpenRouter, OpenAI, Groq, Mistral, vLLM…) |
| `MODEL`           | The model the proxy calls, whatever the page asks for                |
| `MAX_TOKENS`      | Cap on each answer                                                   |
| `ALLOWED_ORIGINS` | Comma-separated origins of your site; every other origin gets a 403  |

Then embed murmur with:

```html
<script type="module" src="https://maxgfr.github.io/murmur/cdn/murmur.js"
  data-endpoint="https://murmur-proxy.<you>.workers.dev/v1" data-model="openai/gpt-5-mini"></script>
```

The origin check stops other sites from using your proxy from a browser, not a script that
forges the `Origin` header. Set a spending limit at the upstream provider and, for a busy site,
add Cloudflare rate limiting in front of the Worker.
