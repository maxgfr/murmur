import { describe, expect, test } from "bun:test";
import { convertArrayToReadableStream, MockLanguageModelV4 } from "ai/test";
import { createMurmur, isSmallTalk, searchQuery } from "../src/core/murmur";
import { proxySettings } from "../src/llm/index";
import { buildIndex } from "../src/rag/chunk";

const index = buildIndex([
  {
    url: "/pricing/",
    title: "Pricing",
    sections: [{ heading: "Plans", anchor: "plans", text: "The Pro plan costs 12 euros a month." }],
  },
]);

function mockModel(chunks: string[]) {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: "text-start", id: "t" },
        ...chunks.map((delta) => ({ type: "text-delta" as const, id: "t", delta })),
        { type: "text-end", id: "t" },
        {
          type: "finish",
          finishReason: { unified: "stop", raw: "stop" },
          usage: {
            inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 1, text: 1, reasoning: 0 },
          },
        },
      ]),
    }),
  });
}

describe("createMurmur", () => {
  test("streams an answer grounded in the retrieved passages", async () => {
    const model = mockModel(["It costs ", "12 € [1]."]);
    const murmur = createMurmur({
      index,
      model,
      instructions: "You are Acme's assistant.",
      language: "fr",
    });
    const answer = await murmur.ask("pro plan price?");
    let text = "";
    for await (const part of answer.textStream) text += part;
    expect(text).toBe("It costs 12 € [1].");
    expect(await answer.done).toEqual({ text, cited: [1] });
    expect(answer.passages[0]?.url).toBe("/pricing/");

    const call = model.doStreamCalls[0];
    const system = JSON.stringify(call?.prompt[0]);
    expect(system).toContain("You are Acme's assistant.");
    expect(system).toContain("12 euros");
    expect(system).toContain('code is \\"fr\\"');
  });

  test("tells the model when nothing matched", async () => {
    const model = mockModel(["Not found."]);
    const answer = await createMurmur({ index, model }).ask("zzzz qqqq");
    expect(answer.passages).toEqual([]);
    for await (const _ of answer.textStream);
    expect(JSON.stringify(model.doStreamCalls[0]?.prompt[0])).toContain("none matched");
  });

  test("a greeting gets a greeting, without looking anything up", async () => {
    const model = mockModel(["Bonjour ! Que voulez-vous savoir ?"]);
    const answer = await createMurmur({ index, model }).ask("hello");
    expect(answer.passages).toEqual([]);
    for await (const _ of answer.textStream);
    const system = JSON.stringify(model.doStreamCalls[0]?.prompt[0]);
    expect(system).toContain("only greeting or thanking you");
    expect(system).not.toContain("none matched");
    expect(isSmallTalk("Bonjour !")).toBe(true);
    expect(isSmallTalk("merci beaucoup 🙏")).toBe(true);
    expect(isSmallTalk("hello, where is my key stored?")).toBe(false);
    expect(isSmallTalk("plan")).toBe(false);
  });

  test("surfaces a provider error", async () => {
    const model = new MockLanguageModelV4({
      doStream: async () => {
        throw new Error("401 bad key");
      },
    });
    const answer = await createMurmur({ index, model }).ask("plan");
    const read = async () => {
      for await (const _ of answer.textStream);
    };
    await expect(read()).rejects.toThrow("401 bad key");
  });

  test("a short follow-up searches with the previous question", () => {
    expect(searchQuery("and yearly?", [{ role: "user", content: "pro plan price" }])).toBe(
      "pro plan price and yearly?",
    );
    expect(searchQuery("What does the enterprise plan include exactly?", [])).toBe(
      "What does the enterprise plan include exactly?",
    );
  });
});

describe("proxySettings", () => {
  test("a valid proxy needs no key", () => {
    expect(proxySettings({ endpoint: "https://proxy.example/v1/", model: "gpt-x" })).toEqual({
      apiKey: "",
      model: "gpt-x",
      customEndpoint: "https://proxy.example/v1",
      customModel: "gpt-x",
    });
  });
  test("refuses plain http to another machine and no endpoint", () => {
    expect(proxySettings({ endpoint: "http://proxy.example/v1" })).toBeNull();
    expect(proxySettings({ provider: "openai" })).toBeNull();
  });
});
