// murmur proxy: an OpenAI-compatible endpoint that holds the key, so visitors chat without one.
// Deploy with `npx wrangler deploy`, then `npx wrangler secret put UPSTREAM_KEY`.
// Point the widget at it: data-endpoint="https://<name>.<you>.workers.dev/v1" data-model="<MODEL>".

const ALLOWED_PATHS = new Set(["/v1/chat/completions", "/v1/models"]);

function cors(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!allowed.includes(origin)) return null;
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = cors(request.headers.get("origin") || "", env);
    if (!headers) return new Response("Origin not allowed", { status: 403 });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (!ALLOWED_PATHS.has(url.pathname))
      return new Response("Not found", { status: 404, headers });

    let body;
    if (request.method === "POST") {
      body = await request.json();
      // The proxy decides the model and caps the answer, whatever the page sends.
      body.model = env.MODEL;
      body.max_tokens = Math.min(Number(body.max_tokens) || 1024, Number(env.MAX_TOKENS || 1024));
      delete body.max_completion_tokens;
    }

    const upstream = await fetch(`${env.UPSTREAM_URL.replace(/\/$/, "")}${url.pathname.slice(3)}`, {
      method: request.method,
      headers: { "content-type": "application/json", authorization: `Bearer ${env.UPSTREAM_KEY}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const out = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(headers)) out.set(k, v);
    return new Response(upstream.body, { status: upstream.status, headers: out });
  },
};
