import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { ownerKeySettings } from "../src/llm/index";
import { ChatSession } from "../src/widget/session";
import { installBrowserGlobals } from "./stubs";

beforeEach(() => installBrowserGlobals());

const proxy = { endpoint: "https://worker.test/v1", model: "m" };

describe("data-mode", () => {
  test("auto: the owner's proxy, then the owner's key, else the browser model with keys as an option", () => {
    expect(new ChatSession({ llm: proxy }).mode).toBe("proxy");
    expect(new ChatSession({ llm: { apiKey: "sk-x", provider: "openrouter" } }).mode).toBe("owner");
    const plain = new ChatSession({});
    expect(plain.mode).toBe("local");
    expect([plain.localAllowed, plain.keyAllowed]).toEqual([true, true]);
  });

  test("proxy: only the proxy, no key settings, no browser model", () => {
    const s = new ChatSession({ mode: "proxy", llm: proxy });
    expect([s.mode, s.localAllowed, s.keyAllowed]).toEqual(["proxy", false, false]);
  });

  test("local: only the browser model, even if a key was chosen before", () => {
    localStorage.setItem("murmur-local", "0");
    const s = new ChatSession({ mode: "local" });
    expect([s.mode, s.localAllowed, s.keyAllowed]).toEqual(["local", true, false]);
  });

  test("key: the owner's key if given, else each visitor's own", () => {
    expect(new ChatSession({ mode: "key", llm: { apiKey: "sk-x" } }).mode).toBe("owner");
    const s = new ChatSession({ mode: "key" });
    expect([s.mode, s.localAllowed, s.keyAllowed]).toEqual(["visitor", false, true]);
  });
});

describe("data-preload", () => {
  test("defaults to the first question, with no prompt", () => {
    const s = new ChatSession({});
    expect(s.preload).toBe("question");
    expect(s.needsDownloadConsent).toBe(false);
  });

  test("consent asks once", () => {
    const s = new ChatSession({ preload: "consent" });
    expect(s.needsDownloadConsent).toBe(true);
    s.agreeToDownload();
    expect(new ChatSession({ preload: "consent" }).needsDownloadConsent).toBe(false);
  });

  test("warming up does nothing outside the local mode or without WebGPU", async () => {
    const proxied = new ChatSession({ llm: proxy });
    await proxied.warmUp();
    expect(proxied.localState.status).toBe("idle");
    const local = new ChatSession({});
    const states: string[] = [];
    local.onLocalState((s) => states.push(s.status));
    await local.warmUp();
    await local.warmUpIfCached();
    expect(states).toEqual([]);
    expect(local.localState.status).toBe("idle");
  });
});

describe("ownerKeySettings", () => {
  const catalog = {
    openrouter: {
      id: "openrouter",
      name: "OpenRouter",
      npm: "@ai-sdk/openai-compatible",
      api: "https://openrouter.ai/api/v1",
      defaultModel: "a/b",
      models: { "a/b": { id: "a/b", name: "B" } },
    },
  };
  let fetchSpy: ReturnType<typeof spyOn>;
  let warn: ReturnType<typeof spyOn>;
  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(Response.json(catalog));
    warn = spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    fetchSpy.mockRestore();
    warn.mockRestore();
  });

  test("builds the provider's settings from the catalog, with its default model", async () => {
    const settings = await ownerKeySettings(
      { apiKey: "sk-x", provider: "openrouter" },
      "https://c.test/models.json",
    );
    expect(settings).toMatchObject({
      apiKey: "sk-x",
      model: "a/b",
      providerId: "openrouter",
      providerNpm: "@ai-sdk/openai-compatible",
      providerApi: "https://openrouter.ai/api/v1",
    });
    expect(warn).toHaveBeenCalled();
  });

  test("no key, no settings", async () => {
    expect(await ownerKeySettings({ provider: "openrouter" })).toBeNull();
  });
});
