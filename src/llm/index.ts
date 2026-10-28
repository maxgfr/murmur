import {
  createLlmSettingsStore,
  DEFAULT_RECOMMENDED,
  isConfigured,
  type LlmSettings,
  type LlmSettingsStore,
  liveCatalog,
  secureStorage,
  validateEndpoint,
} from "llm-connect";

/**
 * What the site owner sets. No key: on a static site anything in the page is public.
 * With `endpoint` (an OpenAI-compatible proxy that holds the key), visitors just chat;
 * without it, each visitor brings their own key, and `provider` / `model` are preselected.
 */
export interface LlmConfig {
  /** Catalog provider id preselected for visitors, e.g. "openrouter", "anthropic". */
  provider?: string;
  /** Model id: preselected for visitors, or the model the proxy is asked for. */
  model?: string;
  /** Base URL of an OpenAI-compatible proxy (https, or http on localhost), e.g. ".../v1". */
  endpoint?: string;
  /** Extra headers sent to the proxy. */
  headers?: Record<string, string>;
}

/** Where the catalog falls back to when models.dev or OpenRouter cannot be reached. */
export const DEFAULT_CATALOG_URL = "https://maxgfr.github.io/murmur/cdn/models.json";

/** Settings calling the owner's proxy, or null when there is no (valid) proxy. */
export function proxySettings(config: LlmConfig): LlmSettings | null {
  const endpoint = config.endpoint ? validateEndpoint(config.endpoint) : null;
  if (!endpoint) return null;
  const model = config.model || "default";
  const settings: LlmSettings = { apiKey: "", model, customEndpoint: endpoint, customModel: model };
  if (config.headers) settings.headers = config.headers;
  return settings;
}

export interface VisitorStoreOptions {
  /** Fallback catalog URL. Default {@link DEFAULT_CATALOG_URL}. */
  catalogUrl?: string;
  /** Prefix of the storage keys, so two widgets on one origin keep separate settings. */
  storageKey?: string;
}

/** The settings form of a visitor who brings their own key, starting on the owner's choice. */
export function visitorStore(
  config: LlmConfig,
  options: VisitorStoreOptions = {},
): LlmSettingsStore {
  const key = options.storageKey ?? "murmur";
  const defaults: { providerId?: string; model?: string } = {};
  if (config.provider) defaults.providerId = config.provider;
  if (config.model) defaults.model = config.model;
  return createLlmSettingsStore({
    catalog: liveCatalog({ fallbackUrl: options.catalogUrl ?? DEFAULT_CATALOG_URL }),
    storage: secureStorage({ prefsKey: `${key}-llm`, dbName: `${key}-secrets` }),
    recommended: config.provider
      ? [config.provider, ...DEFAULT_RECOMMENDED.filter((id) => id !== config.provider)]
      : DEFAULT_RECOMMENDED,
    defaults,
  });
}

/** The settings to call: the owner's proxy, else what the visitor saved, else null (ask the visitor). */
export async function resolveSettings(
  config: LlmConfig,
  store: LlmSettingsStore | null,
): Promise<LlmSettings | null> {
  const proxy = proxySettings(config);
  if (proxy) return proxy;
  const saved = store ? await store.load() : null;
  return saved && isConfigured(saved) ? saved : null;
}

export {
  describeError,
  isConfigured,
  type LlmError,
  type LlmSettings,
  type LlmSettingsState,
  type LlmSettingsStore,
  loadModel,
} from "llm-connect";
