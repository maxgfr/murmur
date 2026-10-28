/** Browser globals the widget's session needs, for tests running outside a browser. */
export function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

export function installBrowserGlobals(pathname = "/docs/page") {
  const g = globalThis as unknown as Record<string, unknown>;
  g.sessionStorage = memoryStorage();
  g.localStorage = memoryStorage();
  g.location = { pathname, href: `https://site.test${pathname}`, search: "" };
}
