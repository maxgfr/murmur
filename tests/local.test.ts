import { describe, expect, test } from "bun:test";
import { chatMessages, DEFAULT_LOCAL_MODEL, hasWebGPU, localModel } from "../src/local/index";
import { cleanAnswer } from "../src/rag/ground";

describe("cleanAnswer", () => {
  test("removes reasoning blocks and copied delimiters", () => {
    expect(cleanAnswer("<think>hmm</think>Open at 7 [1].")).toBe("Open at 7 [1].");
    expect(cleanAnswer('Open at 7 [1].\n\n<<<SOURCE id="1">>>.')).toBe("Open at 7 [1].");
    expect(cleanAnswer("Open [1].\n<<<END SOURCE>>>")).toBe("Open [1].");
  });
  test("hides a delimiter or a reasoning block still being written", () => {
    expect(cleanAnswer("Open at 7 [1]. <<<SOU")).toBe("Open at 7 [1].");
    expect(cleanAnswer("<think>still thinking")).toBe("");
    expect(cleanAnswer("a < b")).toBe("a < b");
  });
  test("normalizes citation variants", () => {
    expect(cleanAnswer("Yes [1, 2] and 【3】 and [Source 4].")).toBe("Yes [1][2] and [3] and [4].");
    expect(cleanAnswer("See the guides [1-3].")).toBe("See the guides [1][2][3].");
    expect(cleanAnswer("Years [2024-2026].")).toBe("Years [2024-2026].");
    expect(cleanAnswer("Oui [Source 2, 3] et [Sources 1 et 4].")).toBe("Oui [2][3] et [1][4].");
    expect(cleanAnswer("Oui [source: 2] et [réf. 3].")).toBe("Oui [2] et [3].");
    expect(cleanAnswer("Selon (Source 2), oui.")).toBe("Selon [2], oui.");
  });
  test("turns sources named in words into citations", () => {
    expect(cleanAnswer("D'après Source 1 et Source 4, la clé reste ici.")).toBe(
      "D'après [1] et [4], la clé reste ici.",
    );
    expect(cleanAnswer("Selon la source 2, oui.")).toBe("Selon [2], oui.");
    expect(cleanAnswer("See sources 1 and 3.")).toBe("See [1][3].");
    expect(cleanAnswer("Voir les sources 1 à 3.")).toBe("Voir [1][2][3].");
    expect(cleanAnswer("See sources 1-2.")).toBe("See [1][2].");
    expect(cleanAnswer("It is open source 2 times over.")).toBe("It is open source 2 times over.");
    expect(cleanAnswer("The sources say 1 thing.")).toBe("The sources say 1 thing.");
  });
  test("drops a trailing sources line the interface already shows", () => {
    expect(cleanAnswer("Open at 7 [1].\n\nSources: [1], [2]")).toBe("Open at 7 [1].");
    expect(cleanAnswer("Open at 7 [1].\n\n**Sources :** 1, 2.")).toBe("Open at 7 [1].");
    expect(cleanAnswer("The sources say 1 thing.")).toBe("The sources say 1 thing.");
  });
  test("drops a trailing list of sources with their titles", () => {
    expect(cleanAnswer("Open [1].\n\n**Sources :**\n- [1] Guide › Install\n- [2] FAQ")).toBe(
      "Open [1].",
    );
    expect(cleanAnswer("Open [1].\n\n### Sources\n\n1. Guide\n2. FAQ\n")).toBe("Open [1].");
    expect(cleanAnswer("Steps:\n1. Install [1]\n2. Run [2]")).toBe(
      "Steps:\n1. Install [1]\n2. Run [2]",
    );
  });
});

describe("local model", () => {
  test("the default is LFM3 1.7B, released after mid-2026, in its WebGPU weights", () => {
    expect(DEFAULT_LOCAL_MODEL).toMatchObject({
      id: "onnx-community/LFM3-1.7B-ONNX",
      dtype: "q4f16",
    });
  });
  test("turns an AI SDK prompt into chat messages for the template", () => {
    expect(
      chatMessages([
        { role: "system", content: "Rules" },
        {
          role: "user",
          content: [
            { type: "text", text: "Hi " },
            { type: "text", text: "there" },
          ],
        },
        { role: "assistant", content: [{ type: "text", text: "Hello" }] },
        { role: "user", content: [{ type: "text", text: "  " }] },
      ]),
    ).toEqual([
      { role: "system", content: "Rules" },
      { role: "user", content: "Hi there" },
      { role: "assistant", content: "Hello" },
    ]);
  });
  test("without WebGPU it says so instead of downloading anything", async () => {
    expect(await hasWebGPU()).toBe(false);
    const model = localModel();
    expect(model.specificationVersion).toBe("v4");
    const { stream } = await model.doStream({
      prompt: [{ role: "user", content: [{ type: "text", text: "x" }] }],
    });
    const parts: { type: string; error?: unknown }[] = [];
    for await (const part of stream) parts.push(part);
    const error = parts.find((p) => p.type === "error")?.error as Error & { code?: string };
    expect(error.name).toBe("LocalModelError");
    expect(error.code).toBe("webgpu");
  });
});
