// Serves dist/site under /murmur/, as GitHub Pages does, plus examples/host at the root and a
// fake OpenAI-compatible endpoint at /mock/v1 for tests. PORT=4173 by default.
import { mockLlm } from "./mock-llm";

const port = Number(process.env.PORT ?? 4173);

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/mock/v1/")) return mockLlm(req, url.pathname);
    if (!url.pathname.startsWith("/murmur/")) {
      if (url.pathname === "/") return Response.redirect("/murmur/", 302);
      const file = Bun.file(`examples/host${url.pathname}`);
      if (await file.exists()) return new Response(file);
      return new Response("Not found", { status: 404 });
    }
    let path = `dist/site/${decodeURIComponent(url.pathname.slice("/murmur/".length))}`;
    if (path.endsWith("/")) path += "index.html";
    const file = Bun.file(path);
    if (await file.exists())
      return new Response(file, {
        headers: { "access-control-allow-origin": "*", "cache-control": "no-store" },
      });
    return new Response("Not found", { status: 404 });
  },
});
console.log(`http://localhost:${port}/murmur/`);
