import { beforeEach, describe, expect, spyOn, test } from "bun:test";
import { optionsFromDataset } from "../src/embed";
import { ChatSession } from "../src/widget/session";
import { installBrowserGlobals } from "./stubs";

beforeEach(() => installBrowserGlobals());

const proxy = { endpoint: "https://worker.test/v1", model: "m" };

describe("data-mode", () => {
  test("auto: the owner's proxy, else the browser model with keys as an option", () => {
    expect(new ChatSession({ llm: proxy }).mode).toBe("proxy");
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

  test("key: each visitor's own key", () => {
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

describe("no key in the page", () => {
  test("data-api-key is refused and said so", () => {
    const error = spyOn(console, "error").mockImplementation(() => {});
    const options = optionsFromDataset(
      { apiKey: "sk-x", provider: "openrouter" },
      "https://a.test/",
    );
    expect(JSON.stringify(options)).not.toContain("sk-x");
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
