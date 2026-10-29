import type { MurmurIndex } from "../../src/rag/types";
import type { MurmurStateDetail } from "../../src/widget/index";
import { t } from "./common";
import { designation } from "./designation";

const ROW = 12;
const SVG = "http://www.w3.org/2000/svg";

interface Socket {
  key: string;
  el: HTMLAnchorElement;
  lamp: HTMLElement;
}

/** An orthogonal path through the points, its corners rounded like a cord bent by hand. */
function rounded(points: { x: number; y: number }[], radius: number) {
  return points.reduce((d, b, n) => {
    const a = points[n - 1];
    const c = points[n + 1];
    if (!a) return `M ${b.x} ${b.y}`;
    if (!c) return `${d} L ${b.x} ${b.y}`;
    const into = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const out = Math.hypot(c.x - b.x, c.y - b.y) || 1;
    const r = Math.min(radius, into / 2, out / 2);
    return `${d} L ${b.x - ((b.x - a.x) / into) * r} ${b.y - ((b.y - a.y) / into) * r} Q ${b.x} ${b.y} ${b.x + ((c.x - b.x) / out) * r} ${b.y + ((c.y - b.y) / out) * r}`;
  }, "");
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
      for (const c of sections.slice(0, ROW)) {
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
        tag.textContent = designation(c.heading);
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
    const fieldLeft = field.getBoundingClientRect().left - box.left;
    const stacked = hs.bottom <= box.top + 4;
    const sx = stacked ? hs.left + hs.width / 2 - box.left : hs.right - box.left;
    const sy = stacked ? 0 : hs.top + hs.height * 0.62 - box.top;
    cords.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
    // A cord is dressed along the panel, never across it: out of the handset, down the margin
    // left of the jack field, along the gap under its row, up between two columns of jacks,
    // then sideways into its jack. It crosses no name, no lamp and no other jack.
    const runs = patched
      .map((key, i) => {
        const s = sockets.get(key);
        const j = s?.el.querySelector(".jack")?.getBoundingClientRect();
        const row = s?.el.closest(".row")?.getBoundingClientRect();
        if (!s || !j || !row) return null;
        const gap = parseFloat(getComputedStyle(field).rowGap) || 20;
        const between = parseFloat(getComputedStyle(s.el.parentElement ?? field).columnGap) || 8;
        return {
          i,
          side: Math.min(
            box.width - 4,
            s.el.getBoundingClientRect().right + between / 2 - box.left,
          ),
          ex: j.left + j.width / 2 - box.left,
          ey: j.top + j.height / 2 - box.top,
          lane: row.bottom + gap / 2 - box.top,
        };
      })
      .filter((r) => !!r)
      .sort((a, b) => a.lane - b.lane || a.ex - b.ex);
    // A narrow margin (on a phone) packs the cords closer.
    const step = Math.min(7, Math.max(3, (fieldLeft - 10) / Math.max(1, runs.length)));
    runs.forEach(({ i, side, ex, ey, lane }, k) => {
      // Higher rows take the inner margin, so no cord crosses another's turn into its lane;
      // in a lane, the nearer jack's cord runs on top.
      const peers = runs.filter((r) => r.lane === lane);
      const rank = peers.findIndex((r) => r.i === i);
      const y = lane + (rank - (peers.length - 1) / 2) * 6;
      const gx = Math.max(4, fieldLeft - 12 - k * step);
      // The innermost cord leaves the handset last, so it never crosses the others' descent.
      const start = { x: sx, y: (stacked ? 6 : sy) + (runs.length - 1 - k) * step };
      const d = rounded(
        [
          start,
          { x: gx, y: start.y },
          { x: gx, y },
          { x: side, y },
          { x: side, y: ey },
          { x: ex, y: ey },
        ],
        16,
      );
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
      // The plug sits in the jack: a bakelite head in a brass collar, drawn over it.
      const plug = document.createElementNS(SVG, "circle");
      plug.setAttribute("cx", String(ex));
      plug.setAttribute("cy", String(ey));
      plug.setAttribute("r", "11");
      plug.setAttribute("class", "plug");
      cord.append(plug);
      if (animate && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
        plug.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 160,
          delay: 560 + i * 140,
          fill: "backwards",
        });
      }
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
