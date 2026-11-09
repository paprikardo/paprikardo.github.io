// C: life as a loading screen — a segmented progress bar plus an install-style log.
import { type Life, type Phase, fmtN, hideTip, showTip, span } from "./life";

const yearOf = (life: Life, week: number) => life.birth.getFullYear() + Math.floor(week / 52);

function status(life: Life, p: Phase) {
  const weeks = p.end - p.start;
  const done = Math.max(0, Math.min(weeks, life.here - p.start));
  const state = done >= weeks ? "done" : done > 0 || life.here === p.start ? "active" : "queued";
  return { weeks, done, state, pct: weeks ? (done / weeks) * 100 : 0 };
}

function phaseTip(life: Life, p: Phase) {
  const st = status(life, p);
  const line =
    st.state === "done" ? `Loaded — ${span(st.weeks)}` :
    st.state === "active" ? `In progress — ${st.pct.toFixed(1)}% · ${span(st.weeks - st.done)} to go` :
    `Queued — starts ${yearOf(life, p.start)} (in ${span(p.start - life.here)})`;
  return `<span class="tip-phase tip-${p.key}"></span><b>${p.label}</b> · age ${p.startAge}–${p.endAge}<br>${p.description}<br><span class="tip-muted">${line}</span>`;
}

export function renderLoading(el: HTMLElement, life: Life) {
  const pct = Math.min(100, (life.here / life.total) * 100);
  const phases = life.phases.filter((p) => p.end > p.start);
  const current = life.phaseOf(life.here);
  const remaining = Math.max(0, life.total - life.here);

  el.innerHTML = `
    <div class="ld">
      <div class="ld-head">
        <div class="ld-title"><span class="spinner" aria-hidden="true"></span>Loading life…</div>
        <div class="ld-pct" aria-live="polite">0.0%</div>
      </div>
      <div class="ld-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct.toFixed(1)}"
           aria-label="Share of expected life lived">
        ${phases.map((p) => `<div class="ld-seg ph-${p.key}" data-k="${p.key}" style="flex:${p.end - p.start}"><i></i></div>`).join("")}
      </div>
      <div class="ld-sub">
        <span>week ${fmtN(life.here + 1)} of ${fmtN(life.total)}</span>
        <span>ETA ${span(remaining)} · currently: ${current.label.toLowerCase()}</span>
      </div>
      <ul class="ld-log">
        ${phases.map((p) => {
          const st = status(life, p);
          const icon = st.state === "done" ? "✓" : st.state === "active" ? "⟳" : "·";
          const text =
            st.state === "done" ? `${p.label} loaded <span class="muted">(${fmtN(st.weeks)} weeks)</span>` :
            st.state === "active" ? `${p.label} <span class="muted">${fmtN(st.done)} / ${fmtN(st.weeks)} weeks (${st.pct.toFixed(0)}%)</span><span class="ld-cursor"></span>` :
            `${p.label} <span class="muted">queued · starts ${yearOf(life, p.start)}</span>`;
          return `<li data-k="${p.key}" class="${st.state === "queued" ? "queued" : ""}"><span class="st">${icon}</span><span class="swatch sw-${p.key}"></span><span>${text}</span></li>`;
        }).join("")}
      </ul>
    </div>`;

  // hover details on segments and log lines
  for (const node of el.querySelectorAll<HTMLElement>("[data-k]")) {
    const p = life.phases.find((x) => x.key === node.dataset.k)!;
    const show = (e: PointerEvent) => showTip(phaseTip(life, p), e.clientX, e.clientY);
    node.addEventListener("pointermove", show);
    node.addEventListener("pointerdown", show);
    node.addEventListener("pointerleave", hideTip);
  }

  // animate: fill the segments and count the percentage up
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pctEl = el.querySelector<HTMLElement>(".ld-pct")!;
  requestAnimationFrame(() => {
    el.querySelectorAll<HTMLElement>(".ld-seg").forEach((seg) => {
      const p = life.phases.find((x) => x.key === seg.dataset.k)!;
      const st = status(life, p);
      seg.classList.toggle("active", st.state === "active");
      seg.querySelector("i")!.style.width = `${st.pct}%`;
    });
  });
  if (reduce) { pctEl.textContent = `${pct.toFixed(1)}%`; return; }
  const t0 = performance.now();
  const tick = (now: number) => {
    const k = Math.min(1, (now - t0) / 1400);
    pctEl.textContent = `${(pct * (1 - (1 - k) ** 3)).toFixed(1)}%`;
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
