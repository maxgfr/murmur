// A fake OpenAI-compatible endpoint for local tests and e2e: streams a fixed answer that cites
// the first two sources it was given. Never used by the published site.
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, authorization",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

export async function mockLlm(req: Request, path: string): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (path.endsWith("/models"))
    return Response.json(
      { object: "list", data: [{ id: "mock", object: "model" }] },
      { headers: CORS },
    );
  const body = (await req.json()) as { messages?: { role: string; content: unknown }[] };
  const system = JSON.stringify(body.messages?.[0]?.content ?? "");
  const count = (system.match(/<<<SOURCE id=/g) ?? []).length;
  const answer = count
    ? `From this site: add **one script tag** to your pages [1]${count > 1 ? ", and the key never sits in the page [2]" : ""}.`
    : "I could not find that on this site.";
  const words = answer.split(/(?<= )/);
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) =>
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
      const base = {
        id: "mock-1",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "mock",
      };
      send({
        ...base,
        choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }],
      });
      for (const w of words) {
        await Bun.sleep(25);
        send({ ...base, choices: [{ index: 0, delta: { content: w }, finish_reason: null }] });
      }
      send({ ...base, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] });
      send({
        ...base,
        choices: [],
        usage: {
          prompt_tokens: 100,
          completion_tokens: words.length,
          total_tokens: 100 + words.length,
        },
      });
      controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, { headers: { ...CORS, "content-type": "text/event-stream" } });
}
