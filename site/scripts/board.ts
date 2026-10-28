import type { MurmurIndex } from "../../src/rag/types";
import type { MurmurStateDetail } from "../../src/widget/index";
import { t } from "./common";

const ROW = 12;
const SVG = "http://www.w3.org/2000/svg";

interface Socket {
  key: string;
  el: HTMLAnchorElement;
  lamp: HTMLElement;
}

/** The jack field: one jack per section of the site, lit and patched as the widget answers. */
export function switchboard(
  field: HTMLElement,
  log: HTMLOListElement,
  cords: SVGSVGElement,
  handset: HTMLElement,
) {
  const sockets = new Map<string, Socket>();
  const board = field.parentElement as HTMLElement;
  let patched: string[] = [];
  let total = 0;

  const keyOf = (url: string, anchor: string) => `${url.split("#")[0]}#${anchor}`;

  function line(text: string) {
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

  function load(index: MurmurIndex) {
    total = index.chunks.length;
    const rows: Node[] = [];
    for (const doc of index.docs) {
      const seen = new Set<string>();
      const sections = index.chunks
        .filter((c) => c.doc === doc.id && c.heading)
        .filter((c) => !seen.has(c.anchor) && seen.add(c.anchor));
      if (!sections.length) continue;
      const row = document.createElement("div");
      row.className = "row";
      const strip = document.createElement("p");
      strip.className = "strip";
      strip.textContent = doc.title
        .replace(/\s*·\s*murmur$/i, "")
        .replace(/^murmur\s*·\s*/i, "")
        .replace(/\.$/, "");
      const jacks = document.createElement("div");
      jacks.className = "jacks";
      for (const [n, c] of sections.slice(0, ROW).entries()) {
        const a = document.createElement("a");
        a.className = "socket";
        a.href = `${doc.url}#${encodeURIComponent(c.anchor)}`;
        a.title = c.heading;
        a.setAttribute("aria-label", c.heading);
        const lamp = document.createElement("span");
        lamp.className = "lamp";
        lamp.setAttribute("aria-hidden", "true");
        const jack = document.createElement("span");
        jack.className = "jack";
        jack.setAttribute("aria-hidden", "true");
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = String(n + 1).padStart(2, "0");
        a.append(lamp, jack, tag);
        jacks.append(a);
        sockets.set(keyOf(doc.url, c.anchor), { key: keyOf(doc.url, c.anchor), el: a, lamp });
      }
      for (let i = sections.length; i < ROW; i++) {
        const ghost = document.createElement("span");
        ghost.className = "socket";
        ghost.setAttribute("aria-hidden", "true");
        ghost.innerHTML =
          '<span class="lamp"></span><span class="jack ghost"></span><span class="tag">&nbsp;</span>';
        jacks.append(ghost);
      }
      if (sections.length > ROW) {
        const more = document.createElement("p");
        more.className = "note";
        more.textContent = t("field.more", { n: sections.length - ROW });
        row.append(strip, jacks, more);
      } else row.append(strip, jacks);
      rows.push(row);
    }
    field.replaceChildren(...rows);
  }

  function reset() {
    for (const s of sockets.values()) {
      s.lamp.className = "lamp";
      s.el.classList.remove("patched");
    }
    patched = [];
    cords.replaceChildren();
  }

  function draw(animate: boolean) {
    cords.replaceChildren();
    const box = board.getBoundingClientRect();
    const hs = handset.getBoundingClientRect();
    const stacked = hs.bottom <= box.top + 4;
    const sx = stacked ? hs.left + hs.width / 2 - box.left : hs.right - box.left;
    const sy = stacked ? 0 : hs.top + hs.height * 0.62 - box.top;
    cords.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
    patched.forEach((key, i) => {
      const s = sockets.get(key);
      if (!s) return;
      const j = s.el.querySelector(".jack")?.getBoundingClientRect();
      if (!j) return;
      const ex = j.left + j.width / 2 - box.left;
      const ey = j.top + j.height / 2 - box.top;
      const sag = 60 + Math.abs(ex - sx) * 0.18 + i * 14;
      const d = `M ${sx} ${sy + i * 8} C ${sx + (ex - sx) * 0.35} ${Math.max(sy, ey) + sag}, ${ex - (ex - sx) * 0.15} ${ey + sag * 0.6}, ${ex} ${ey}`;
      // Cords alternate red and black, as on a real board.
      const cord = document.createElementNS(SVG, "g");
      if (i % 2) cord.setAttribute("class", "black");
      cords.append(cord);
      for (const cls of ["sheath", "core"]) {
        const path = document.createElementNS(SVG, "path");
        path.setAttribute("d", d);
        path.setAttribute("class", cls);
        cord.append(path);
        if (animate && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
          const len = path.getTotalLength();
          path.style.strokeDasharray = `${len}`;
          path.style.strokeDashoffset = `${len}`;
          path.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], {
            duration: 700,
            delay: i * 140,
            easing: "cubic-bezier(0.16, 1, 0.3, 1)",
            fill: "forwards",
          });
        }
      }
      const plug = document.createElementNS(SVG, "circle");
      plug.setAttribute("cx", String(ex));
      plug.setAttribute("cy", String(ey));
      plug.setAttribute("r", "9");
      plug.setAttribute("class", "plug");
      cord.append(plug);
    });
  }

  function onState(detail: MurmurStateDetail) {
    const passages = detail.passages ?? [];
    if (detail.state === "searching") {
      reset();
      line(t("field.searching", { n: total || "…" }));
    } else if (detail.state === "streaming") {
      line(passages.length ? t("field.found", { n: passages.length }) : t("field.none"));
      for (const p of passages) {
        const s = sockets.get(keyOf(p.url, p.anchor));
        if (s) s.lamp.className = "lamp on blink";
      }
    } else if (detail.state === "done") {
      for (const s of sockets.values()) s.lamp.className = "lamp";
      const cited = (detail.cited ?? []).map((n) => passages[n - 1]).filter((p) => !!p);
      patched = [...new Set(cited.map((p) => keyOf(p.url, p.anchor)))].filter((k) =>
        sockets.has(k),
      );
      for (const key of patched) {
        const s = sockets.get(key);
        if (!s) continue;
        s.lamp.className = "lamp on";
        s.el.classList.add("patched");
      }
      if (!passages.length) line(t("field.none"));
      else if (!cited.length) line(t("field.unanswered"));
      else
        line(
          t("field.patched", {
            list: cited.map((p) => (p.heading || p.title).replace(/\.$/, "")).join(" · "),
          }),
        );
      draw(true);
    } else if (detail.state === "error") {
      reset();
      line(t("field.error"));
    }
  }

  let frame = 0;
  const redraw = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => patched.length && draw(false));
  };
  new ResizeObserver(redraw).observe(board);
  addEventListener("resize", redraw);

  return { load, onState };
}
