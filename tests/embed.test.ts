import { describe, expect, test } from "bun:test";
import { optionsFromDataset } from "../src/embed";

describe("optionsFromDataset", () => {
  test("maps the script tag's data attributes to widget options", () => {
    const o = optionsFromDataset(
      {
        index: "/murmur-index.json",
        provider: "anthropic",
        model: "claude-sonnet-5-5",
        endpoint: "https://proxy.test/v1",
        title: "Ask Acme",
        greeting: "Hi",
        placeholder: "Your question",
        button: "Help",
        lang: "fr",
        position: "bottom-left",
        theme: "dark",
        accent: "#0b5cad",
        catalog: "models.json",
        storageKey: "acme",
        open: "true",
        instructions: "Be brief.",
      },
      "https://acme.test/docs/page.html",
    );
    expect(o).toEqual({
      index: "https://acme.test/murmur-index.json",
      llm: { provider: "anthropic", model: "claude-sonnet-5-5", endpoint: "https://proxy.test/v1" },
      instructions: "Be brief.",
      lang: "fr",
      messages: { title: "Ask Acme", greeting: "Hi", placeholder: "Your question", open: "Help" },
      position: "bottom-left",
      theme: "dark",
      accent: "#0b5cad",
      catalogUrl: "https://acme.test/docs/models.json",
      storageKey: "acme",
      open: true,
    });
  });

  test("reads the mode and the preload", () => {
    expect(optionsFromDataset({ mode: "local", preload: "idle" }, "https://a.test/")).toEqual({
      mode: "local",
      preload: "idle",
    });
    expect(optionsFromDataset({ mode: "turbo", preload: "now" }, "https://a.test/")).toEqual({});
  });

  test("ignores unknown values and leaves defaults alone", () => {
    expect(
      optionsFromDataset({ position: "top", theme: "neon", open: "yes" }, "https://a.test/"),
    ).toEqual({});
  });
});
