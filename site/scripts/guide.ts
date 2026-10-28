import { mountMurmur } from "../../src/widget/index";
import { lang, rememberLanguageChoice, root, t } from "./common";

rememberLanguageChoice();

const toc = document.getElementById("toc");
for (const h of document.querySelectorAll<HTMLHeadingElement>(".prose h2[id]")) {
  const li = document.createElement("li");
  const a = document.createElement("a");
  a.href = `#${h.id}`;
  a.textContent = h.textContent;
  li.append(a);
  toc?.append(li);
}

// The guide is what the bubble knows best: it answers from this site's index.
mountMurmur({
  index: "murmur-index.json",
  lang,
  catalogUrl: `${root}cdn/models.json`,
  storageKey: "murmur-demo",
  messages: { greeting: t("board.greeting") },
});
