// A: one dot per week, one row per year. Past = solid, future = tinted, hover = details.
import { type Life, describe, fmtN, hideTip, showTip } from "./life";

export function legend(life: Life, onFocus: (key: string | null) => void) {
  const box = document.createElement("div");
  box.className = "life-legend";
  for (const p of life.phases) {
    const weeks = p.end - p.start;
    if (!weeks) continue;
    const b = document.createElement("button");
    b.type = "button";
    b.innerHTML = `<span class="swatch sw-${p.key}"></span>${p.label} <small>${p.startAge}–${p.endAge} · ${fmtN(weeks)} wk</small>`;
    b.title = p.description;
    b.addEventListener("pointerenter", () => onFocus(p.key));
    b.addEventListener("pointerleave", () => onFocus(null));
    b.addEventListener("focus", () => onFocus(p.key));
    b.addEventListener("blur", () => onFocus(null));
    box.appendChild(b);
  }
  return box;
}

export function renderGrid(el: HTMLElement, life: Life) {
  const grid = document.createElement("div");
  grid.className = "wk-grid";
  grid.setAttribute("role", "img");
  grid.setAttribute("aria-label", `Life in weeks: ${fmtN(life.here)} of ${fmtN(life.total)} weeks lived`);

  const frag = document.createDocumentFragment();
  for (let r = 0; r < life.total / 52; r++) {
    const age = document.createElement("span");
    age.className = "wk-age";
    if (r % 10 === 0) age.textContent = String(r);
    frag.appendChild(age);
    for (let c = 0; c < 52; c++) {
      const i = r * 52 + c;
      const s = document.createElement("span");
      s.className = `wk ph-${life.phaseOf(i).key} ${i < life.here ? "past" : i === life.here ? "now" : "future"}`;
      s.dataset.i = String(i);
      frag.appendChild(s);
    }
  }
  grid.appendChild(frag);

  const onFocus = (key: string | null) => {
    if (key) {
      grid.dataset.focus = key;
      grid.querySelectorAll(".wk").forEach((d) => d.classList.toggle("focus", d.classList.contains(`ph-${key}`)));
    } else delete grid.dataset.focus;
  };

  const hover = (e: PointerEvent) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>(".wk");
    if (!t) return hideTip();
    showTip(describe(life.info(Number(t.dataset.i))), e.clientX, e.clientY);
  };
  grid.addEventListener("pointermove", hover);
  grid.addEventListener("pointerdown", hover); // tap on touch screens
  grid.addEventListener("pointerleave", hideTip);

  el.replaceChildren(legend(life, onFocus), grid);
}
