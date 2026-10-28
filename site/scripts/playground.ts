import { indexPages, type PageInput } from "../../src/indexer/index";
import { type MurmurChat, type MurmurStateDetail, mountMurmur } from "../../src/widget/index";
import { lang, rememberLanguageChoice, root, t } from "./common";

rememberLanguageChoice();

const form = document.getElementById("bench") as HTMLFormElement;
const paste = document.getElementById("paste") as HTMLTextAreaElement;
const files = document.getElementById("files") as HTMLInputElement;
const stats = document.getElementById("stats") as HTMLElement;
const handset = document.getElementById("bench-handset") as HTMLElement;
const log = document.getElementById("bench-log") as HTMLOListElement;

function logLine(text: string) {
  const li = document.createElement("li");
  const time = document.createElement("time");
  const now = new Date();
  time.textContent = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const span = document.createElement("span");
  span.textContent = text;
  li.append(time, span);
  log.append(li);
  while (log.children.length > 3) log.firstElementChild?.remove();
}
let widget: MurmurChat | null = null;

const SAMPLE: Record<string, string> = {
  en: `# Le Fournil, bakery

## Opening hours
Tuesday to Saturday, 7am to 7:30pm. Sunday 7am to 1pm. Closed on Mondays and in the first two weeks of August.

## Orders
Cakes for 6 people or more must be ordered 48 hours ahead, in the shop or by phone. Bread for events: 72 hours ahead.

## Allergens
Every product lists its allergens on its label. We have one gluten-free bread, the buckwheat loaf, baked on Thursdays; it is made in a shared workshop, so traces are possible.

## Payment
Cards from 1 euro, cash, and restaurant vouchers. No cheques.`,
  fr: `# Le Fournil, boulangerie

## Horaires
Du mardi au samedi, de 7 h à 19 h 30. Le dimanche de 7 h à 13 h. Fermé le lundi et les deux premières semaines d'août.

## Commandes
Les gâteaux de 6 parts et plus se commandent 48 heures à l'avance, en boutique ou par téléphone. Le pain pour les événements : 72 heures.

## Allergènes
Chaque produit indique ses allergènes sur son étiquette. Nous avons un pain sans gluten, la miche au sarrasin, cuite le jeudi ; il est fabriqué dans un atelier partagé, des traces sont donc possibles.

## Paiement
Carte dès 1 euro, espèces et titres-restaurant. Pas de chèques.`,
};

document.getElementById("sample")?.addEventListener("click", () => {
  paste.value = SAMPLE[lang] ?? SAMPLE.en ?? "";
  form.requestSubmit();
});

function kindOf(name: string, body: string): "html" | "markdown" | "text" {
  if (/\.html?$/i.test(name) || /^\s*<(!doctype|html|body|main|article|div|p|h\d)/i.test(body))
    return "html";
  if (/\.txt$/i.test(name)) return "text";
  return "markdown";
}

function page(name: string, body: string): PageInput {
  const kind = kindOf(name, body);
  const url = `#${encodeURIComponent(name)}`;
  if (kind === "html") return { url, title: name, html: body };
  if (kind === "text") return { url, title: name, text: body };
  return { url, markdown: body, ...(name.includes(".") ? { title: name } : {}) };
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const pages: PageInput[] = [];
  if (paste.value.trim()) pages.push(page(t("play.paste"), paste.value));
  for (const file of files.files ?? []) pages.push(page(file.name, await file.text()));
  if (!pages.length) {
    stats.textContent = t("play.nothing");
    return;
  }
  const index = indexPages(pages);
  stats.textContent = t("play.stats", { docs: index.docs.length, chunks: index.chunks.length });
  logLine(stats.textContent);
  widget?.remove();
  handset.replaceChildren();
  widget = mountMurmur({
    target: handset,
    inline: true,
    index,
    lang,
    catalogUrl: `${root}cdn/models.json`,
    storageKey: "murmur-demo",
    messages: { greeting: t("play.greeting") },
  });
  document.getElementById("bench-lamp")?.classList.add("on");
  widget.addEventListener("murmur:state", (e) => {
    const d = (e as CustomEvent<MurmurStateDetail>).detail;
    if (d.state === "searching") logLine(t("field.searching", { n: index.chunks.length }));
    if (d.state === "done") {
      const cited = (d.cited ?? [])
        .map((n) => d.passages?.[n - 1]?.heading || d.passages?.[n - 1]?.title)
        .filter(Boolean);
      logLine(
        cited.length ? t("field.patched", { list: cited.join(" · ") }) : t("field.unanswered"),
      );
    }
    if (d.state === "error") logLine(t("field.error"));
  });
  widget.shadowRoot?.querySelector("textarea")?.focus();
});

files.addEventListener("change", () => form.requestSubmit());
