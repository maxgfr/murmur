import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4Prompt,
  LanguageModelV4StreamPart,
} from "@ai-sdk/provider";

/** A model that runs in the page on WebGPU, through Transformers.js. */
export interface LocalModelSpec {
  /** Hugging Face repository of the ONNX weights. */
  id: string;
  /** Weights variant: q4f16 is the one meant for WebGPU. */
  dtype: string;
  /** Display name. */
  name: string;
  /** Approximate download, in megabytes, shown before the visitor agrees to it. */
  sizeMB: number;
}

/**
 * LFM3-1.7B by Liquid AI (October 2026), 4-bit weights with fp16 activations: the smallest
 * text model released after mid-2026 with weights made for WebGPU. About 1.1 GB, downloaded
 * once and kept in the browser's cache.
 */
export const DEFAULT_LOCAL_MODEL: LocalModelSpec = {
  id: "onnx-community/LFM3-1.7B-ONNX",
  dtype: "q4f16",
  name: "LFM3 1.7B",
  sizeMB: 1090,
};

export interface LoadProgress {
  /** Bytes loaded so far, across every file of the model. */
  loaded: number;
  /** Total bytes, once known. */
  total: number;
  /** 0 to 1. */
  progress: number;
}

export interface LocalModelOptions {
  /** Which model to run. Default {@link DEFAULT_LOCAL_MODEL}. */
  spec?: LocalModelSpec;
  /** Called while the weights download. */
  onProgress?: (progress: LoadProgress) => void;
  /** Longest answer, in tokens. Default 512. */
  maxNewTokens?: number;
}

/** Whether this browser exposes a WebGPU adapter. */
export async function hasWebGPU(): Promise<boolean> {
  const gpu = (
    globalThis.navigator as
      | (Navigator & { gpu?: { requestAdapter(): Promise<unknown> } })
      | undefined
  )?.gpu;
  if (!gpu) return false;
  try {
    return !!(await gpu.requestAdapter());
  } catch {
    return false;
  }
}

/** The chat messages a Transformers.js template takes, from an AI SDK prompt (text only). */
export function chatMessages(prompt: LanguageModelV4Prompt): { role: string; content: string }[] {
  return prompt.flatMap((m) => {
    if (m.role === "system") return [{ role: "system", content: m.content }];
    if (m.role === "tool") return [];
    const text = m.content
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("")
      .trim();
    return text ? [{ role: m.role, content: text }] : [];
  });
}

// One pipeline per model for the whole page: loading weights twice would double memory.
type Generator = ((messages: unknown, options: Record<string, unknown>) => Promise<unknown>) & {
  tokenizer: unknown;
};
const loaded = new Map<string, Promise<Generator>>();
const listeners = new Map<string, Set<(p: LoadProgress) => void>>();

/** Downloads (or reads from cache) and compiles the model; later calls share the same load. */
export function loadLocalModel(
  spec: LocalModelSpec = DEFAULT_LOCAL_MODEL,
  onProgress?: (progress: LoadProgress) => void,
): Promise<Generator> {
  const key = `${spec.id}@${spec.dtype}`;
  const set = listeners.get(key) ?? new Set();
  listeners.set(key, set);
  if (onProgress) set.add(onProgress);
  let pending = loaded.get(key);
  if (!pending) {
    pending = (async () => {
      if (!(await hasWebGPU())) throw new LocalModelError("webgpu", "This browser has no WebGPU.");
      const { pipeline } = await import("@huggingface/transformers");
      const generator = await pipeline("text-generation", spec.id, {
        dtype: spec.dtype as "q4f16",
        device: "webgpu",
        progress_callback: (info: {
          status: string;
          loaded?: number;
          total?: number;
          progress?: number;
        }) => {
          if (info.status !== "progress_total") return;
          const p = {
            loaded: info.loaded ?? 0,
            total: info.total ?? 0,
            progress: Math.min(1, (info.progress ?? 0) / 100),
          };
          for (const listener of set) listener(p);
        },
      });
      return generator as unknown as Generator;
    })();
    pending.catch(() => loaded.delete(key));
    loaded.set(key, pending);
  }
  return pending;
}

export class LocalModelError extends Error {
  constructor(
    readonly code: "webgpu" | "load",
    message: string,
  ) {
    super(message);
    this.name = "LocalModelError";
  }
}

const usage = (input: number, output: number) => ({
  inputTokens: { total: input, noCache: input, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: output, text: output, reasoning: undefined },
});

/**
 * An AI SDK language model that runs in the page: pass it to `createMurmur({ model })`, or let
 * the widget create it with `local: true`. Nothing leaves the browser once the weights are cached.
 */
export function localModel(options: LocalModelOptions = {}): LanguageModelV4 {
  const spec = options.spec ?? DEFAULT_LOCAL_MODEL;

  async function run(call: LanguageModelV4CallOptions, onText: (text: string) => void) {
    const generator = await loadLocalModel(spec, options.onProgress);
    const { TextStreamer, InterruptableStoppingCriteria, StoppingCriteriaList } = await import(
      "@huggingface/transformers"
    );
    const stop = new InterruptableStoppingCriteria();
    const criteria = new StoppingCriteriaList();
    criteria.push(stop);
    const onAbort = () => stop.interrupt();
    call.abortSignal?.addEventListener("abort", onAbort, { once: true });
    let tokens = 0;
    const streamer = new TextStreamer(generator.tokenizer as never, {
      skip_prompt: true,
      skip_special_tokens: true,
      // The default cleanup drops the space before punctuation: "index ./dist" would lose it.
      decode_kwargs: { clean_up_tokenization_spaces: false },
      callback_function: (text: string) => {
        if (text) onText(text);
      },
      token_callback_function: () => {
        tokens++;
      },
    });
    try {
      await generator(chatMessages(call.prompt), {
        max_new_tokens: call.maxOutputTokens ?? options.maxNewTokens ?? 512,
        do_sample: true,
        temperature: call.temperature ?? 0.1,
        top_k: 50,
        repetition_penalty: 1.1,
        streamer,
        stopping_criteria: criteria,
        tokenizer_encode_kwargs: { enable_thinking: false },
      });
    } finally {
      call.abortSignal?.removeEventListener("abort", onAbort);
    }
    return { tokens, interrupted: stop.interrupted };
  }

  return {
    specificationVersion: "v4",
    provider: "murmur-local",
    modelId: spec.id,
    supportedUrls: {},
    async doGenerate(call) {
      let text = "";
      const { tokens, interrupted } = await run(call, (t) => {
        text += t;
      });
      return {
        content: [{ type: "text", text }],
        finishReason: { unified: interrupted ? "other" : "stop", raw: undefined },
        usage: usage(0, tokens),
        warnings: [],
      };
    },
    async doStream(call) {
      const stream = new ReadableStream<LanguageModelV4StreamPart>({
        start(controller) {
          controller.enqueue({ type: "stream-start", warnings: [] });
          controller.enqueue({ type: "text-start", id: "0" });
          run(call, (delta) => controller.enqueue({ type: "text-delta", id: "0", delta })).then(
            ({ tokens, interrupted }) => {
              controller.enqueue({ type: "text-end", id: "0" });
              controller.enqueue({
                type: "finish",
                finishReason: { unified: interrupted ? "other" : "stop", raw: undefined },
                usage: usage(0, tokens),
              });
              controller.close();
            },
            (error: unknown) => {
              controller.enqueue({ type: "error", error });
              controller.close();
            },
          );
        },
      });
      return { stream };
    },
  };
}
