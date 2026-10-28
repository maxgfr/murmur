/** Strings of the page's language, written by scripts/pages.ts into #i18n. */
const dict: Record<string, string> = JSON.parse(
  document.getElementById("i18n")?.textContent || "{}",
);

export const lang = document.documentElement.lang || "en";
/** Relative path from this page to the site root ("./" or "../"). */
export const root = document.body.dataset.root || "./";
/** Relative path to the language's own folder, where its index lives. */
export const langRoot = "./";

export function t(key: string, vars: Record<string, string | number> = {}): string {
  const raw = dict[key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
}

/** Copy buttons: `data-copy` names the element whose text they copy. */
export function wireCopyButtons(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-copy]")) {
    const label = button.textContent ?? "";
    button.addEventListener("click", async () => {
      const source = document.getElementById(button.dataset.copy ?? "");
      if (!source) return;
      try {
        await navigator.clipboard.writeText(source.textContent ?? "");
        button.textContent = t("snippet.copied");
      } catch {
        const range = document.createRange();
        range.selectNodeContents(source);
        getSelection()?.removeAllRanges();
        getSelection()?.addRange(range);
      }
      setTimeout(() => {
        button.textContent = label;
      }, 1600);
    });
  }
}

/** Remembers the language a visitor picked, so the redirect in <head> respects it. */
export function rememberLanguageChoice(): void {
  for (const a of document.querySelectorAll<HTMLAnchorElement>("a[hreflang].lang")) {
    a.addEventListener("click", () => {
      try {
        localStorage.setItem("murmur-site-lang", a.hreflang);
      } catch {}
    });
  }
}
