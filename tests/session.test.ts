import { beforeEach, describe, expect, test } from "bun:test";
import { convertArrayToReadableStream, MockLanguageModelV4 } from "ai/test";
import { buildIndex } from "../src/rag/chunk";
import { ChatSession, SetupNeeded } from "../src/widget/session";
import { installBrowserGlobals } from "./stubs";

const index = buildIndex([
  {
    url: "/pricing/",
    title: "Pricing",
    sections: [{ heading: "Plans", anchor: "plans", text: "The Pro plan costs 12 euros a month." }],
  },
]);

const finish = {
  type: "finish" as const,
  finishReason: { unified: "stop" as const, raw: "stop" },
  usage: {
    inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 1, text: 1, reasoning: 0 },
  },
};

function model(text: string) {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: "text-start", id: "t" },
        { type: "text-delta", id: "t", delta: text },
        { type: "text-end", id: "t" },
        finish,
      ]),
    }),
  });
}

beforeEach(() => installBrowserGlobals());

describe("ChatSession", () => {
  test("answers in the browser by default; your model, then a proxy, come first", () => {
    expect(new ChatSession({ model: model("x") }).mode).toBe("custom");
    expect(new ChatSession({ llm: { endpoint: "https://p.test/v1" } }).mode).toBe("proxy");
    expect(new ChatSession({ llm: { provider: "openai" } }).mode).toBe("local");
    expect(new ChatSession({}).mode).toBe("local");
    expect(new ChatSession({ local: false }).mode).toBe("visitor");
    expect(new ChatSession({ llm: { endpoint: "https://p.test/v1" } }).localAllowed).toBe(false);
  });

  test("the visitor can switch to their own key and back", () => {
    const session = new ChatSession({});
    session.useLocal(false);
    expect(session.mode).toBe("visitor");
    expect(new ChatSession({}).mode).toBe("visitor");
    session.useLocal(true);
    expect(new ChatSession({}).mode).toBe("local");
  });

  test("preferences without a key keep the browser model", async () => {
    localStorage.setItem("murmur-llm", JSON.stringify({ providerId: "openai", model: "gpt-x" }));
    const session = new ChatSession({});
    expect(session.mode).toBe("local");
    await session.settleChoice();
    expect(session.mode).toBe("local");
  });

  test("answers, keeps the sources and persists the conversation for the tab", async () => {
    const session = new ChatSession({ index, model: model("12 euros [1].") });
    const seen: string[] = [];
    const turn = await session.ask(
      "pro plan price?",
      (text) => seen.push(text),
      new AbortController().signal,
    );
    expect(turn.content).toBe("12 euros [1].");
    expect(turn.cited).toEqual([1]);
    expect(turn.passages?.[0]).toEqual({
      url: "/pricing/",
      anchor: "plans",
      title: "Pricing",
      heading: "Plans",
    });
    expect(seen.at(-1)).toBe("12 euros [1].");

    const again = new ChatSession({ index, model: model("") });
    expect(again.turns.map((t) => t.role)).toEqual(["user", "assistant"]);
    again.clear();
    expect(new ChatSession({ index, model: model("") }).turns).toEqual([]);
  });

  test("keeps separate histories per site section and storage key", async () => {
    const a = new ChatSession({ index, model: model("a"), storageKey: "one" });
    await a.ask("plan", () => {}, new AbortController().signal);
    expect(new ChatSession({ index, model: model(""), storageKey: "two" }).turns).toEqual([]);
  });

  test("records a provider failure on the turn instead of throwing", async () => {
    const failing = new MockLanguageModelV4({
      doStream: async () => {
        throw Object.assign(new Error("Incorrect API key"), { statusCode: 401 });
      },
    });
    const turn = await new ChatSession({ index, model: failing }).ask(
      "plan",
      () => {},
      new AbortController().signal,
    );
    expect(turn.error?.split("|")[0]).toBeTruthy();
    expect(turn.content).toBe("");
  });

  test("with the in-browser model turned off, a visitor without a key must set one up first", async () => {
    const session = new ChatSession({ index, llm: { provider: "openai" }, local: false });
    expect(await session.needsSetup()).toBe(true);
    await expect(
      session.ask("plan", () => {}, new AbortController().signal),
    ).rejects.toBeInstanceOf(SetupNeeded);
    expect(session.turns).toEqual([]);
  });

  test("a proxy needs no setup", async () => {
    const session = new ChatSession({ index, llm: { endpoint: "https://p.test/v1", model: "m" } });
    expect(await session.needsSetup()).toBe(false);
    expect(await session.settings()).toMatchObject({
      customEndpoint: "https://p.test/v1",
      customModel: "m",
      apiKey: "",
    });
  });
});
