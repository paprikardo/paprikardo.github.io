// B: an hourglass where every grain of sand is one week.
// Bottom bulb = weeks already lived (oldest at the bottom → phases form strata).
// Top bulb = weeks still ahead (the next week sits right above the neck).
import { type Life, describe, fmtN, hideTip, phaseColors, showTip } from "./life";
import { legend } from "./viz-grid";

type Grain = { x: number; y: number; i: number };

export function renderHourglass(el: HTMLElement, life: Life): () => void {
  const W = Math.min(el.clientWidth || 400, 460);
  const H = Math.round(W * 1.4);
  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement("canvas");
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = `${W}px`;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", `Hourglass: ${fmtN(life.here)} weeks of sand have fallen, ${fmtN(life.total - life.here - 1)} remain`);
  const wrap = document.createElement("div");
  wrap.className = "hg-wrap";
  wrap.appendChild(canvas);

  const cs = getComputedStyle(el);
  const colors = phaseColors(el);
  const ink = cs.color, muted = cs.getPropertyValue("--muted").trim(), border = cs.getPropertyValue("--border").trim();
  const bg = cs.getPropertyValue("--bg").trim();

  // ---------- geometry ----------
  const cx = W * 0.4, maxHalf = W * 0.3, neckY = H / 2, frame = 14, y0 = frame + 6, y1 = H - frame - 6;
  const h = neckY - y0;
  let d = 4; // grain diameter, solved below
  const neckHalf = () => d * 1.4;
  // half-width of the glass at normalised distance t (0 = neck, 1 = far end): rounded bulbs
  const hw = (t: number) => neckHalf() + (maxHalf - neckHalf()) * Math.sqrt(Math.sin(Math.min(1, Math.max(0, t)) * Math.PI / 2));

  // rows of grain centres in the bottom bulb, from the base up to the neck
  const bottomRowsFor = () => {
    const out: { y: number; xs: number[] }[] = [];
    for (let y = y1 - d / 2; y > neckY + d; y -= d * 0.88) {
      const n = Math.max(0, Math.floor((2 * (hw((y - neckY) / h) - d * 0.75)) / d));
      out.push({ y, xs: Array.from({ length: n }, (_, k) => cx - ((n - 1) * d) / 2 + k * d) });
    }
    return out;
  };
  const capacity = () => bottomRowsFor().reduce((sum, r) => sum + r.xs.length, 0);
  // largest grain that still fits a whole life in one bulb
  let lo = 0.8, hi = 14;
  for (let k = 0; k < 22; k++) { d = (lo + hi) / 2; if (capacity() >= life.total) lo = d; else hi = d; }
  d = lo;

  // ---------- place grains ----------
  const grains: Grain[] = [];
  let i = 0;
  for (const row of bottomRowsFor()) for (const x of row.xs) { if (i >= life.here) break; grains.push({ x, y: row.y, i: i++ }); }
  // top bulb: fill from just above the neck upwards with the next weeks first
  const pitch = d * 0.88;
  let f = life.here + 1;
  for (let y = neckY - d * 1.2; y > y0 + d / 2 && f < life.total; y -= pitch) {
    const half = hw((neckY - y) / h) - d * 0.75;
    const n = Math.max(0, Math.floor((2 * half) / d));
    for (let k = 0; k < n && f < life.total; k++) grains.push({ x: cx - ((n - 1) * d) / 2 + k * d, y, i: f++ });
  }
  const nowGrain: Grain = { x: cx, y: neckY, i: life.here };
  grains.push(nowGrain);

  // ---------- static layer ----------
  const stat = document.createElement("canvas");
  stat.width = canvas.width; stat.height = canvas.height;
  const s = stat.getContext("2d")!;
  s.scale(dpr, dpr);

  // glass outline
  s.strokeStyle = muted; s.lineWidth = 1.5; s.globalAlpha = 0.7;
  for (const side of [-1, 1]) {
    s.beginPath();
    for (let y = y0; y <= y1; y += 2) {
      const x = cx + side * (hw(Math.abs(y - neckY) / h) + 3);
      y === y0 ? s.moveTo(x, y) : s.lineTo(x, y);
    }
    s.stroke();
  }
  s.globalAlpha = 1;
  // frame
  s.fillStyle = ink;
  for (const y of [frame - 4, H - frame - 2]) s.fillRect(cx - maxHalf - 14, y, (maxHalf + 14) * 2, 6);

  const color = (idx: number) => colors[life.phaseOf(idx).key];
  for (const g of grains) {
    if (g === nowGrain) continue;
    s.fillStyle = color(g.i);
    s.beginPath(); s.arc(g.x, g.y, d * 0.46, 0, Math.PI * 2); s.fill();
  }

  // direct labels: past / future totals + phase strata
  const lx = cx + maxHalf + 18;
  s.font = `600 12px ${cs.getPropertyValue("--font-body")}`;
  s.fillStyle = ink; s.textBaseline = "middle";
  s.fillText("Future", lx, y0 + 10);
  s.fillText("Past", lx, neckY + 22);
  s.font = `11px ${cs.getPropertyValue("--font-mono")}`;
  s.fillStyle = muted;
  s.fillText(`${fmtN(life.total - life.here - 1)} weeks`, lx, y0 + 26);
  s.fillText(`${fmtN(life.here)} weeks`, lx, neckY + 38);
  s.font = `11px ${cs.getPropertyValue("--font-body")}`;
  const placed: number[] = [neckY + 22, neckY + 38, y0 + 10, y0 + 26];
  for (const p of life.phases) {
    for (const bulb of [1, -1]) {
      const ys = grains.filter((g) => g !== nowGrain && life.phaseOf(g.i) === p && Math.sign(g.y - neckY) === bulb).map((g) => g.y);
      if (ys.length < 2) continue;
      const lo2 = Math.min(...ys), hi2 = Math.max(...ys);
      if (hi2 - lo2 < 8) continue;
      const y = (lo2 + hi2) / 2;
      if (placed.some((py) => Math.abs(py - y) < 14)) continue;
      placed.push(y);
      s.fillStyle = colors[p.key]; s.fillRect(lx, y - 4, 8, 8);
      s.fillStyle = ink; s.fillText(p.label, lx + 13, y);
    }
  }

  // ---------- hover lookup ----------
  const cell = Math.max(d, 4);
  const hash = new Map<string, Grain[]>();
  for (const g of grains) {
    const k = `${Math.floor(g.x / cell)},${Math.floor(g.y / cell)}`;
    (hash.get(k) ?? hash.set(k, []).get(k)!).push(g);
  }
  let hovered: Grain | null = null;
  const pick = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
    let best: Grain | null = null, bd = Math.max(d, 6) ** 2;
    const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      for (const g of hash.get(`${gx + a},${gy + b}`) ?? []) {
        const dd = (g.x - x) ** 2 + (g.y - y) ** 2;
        if (dd < bd) { bd = dd; best = g; }
      }
    }
    hovered = best;
    if (best) showTip(describe(life.info(best.i)), e.clientX, e.clientY); else hideTip();
    if (!animating) draw(0);
  };
  canvas.addEventListener("pointermove", pick);
  canvas.addEventListener("pointerdown", pick);
  canvas.addEventListener("pointerleave", () => { hovered = null; hideTip(); if (!animating) draw(0); });

  // ---------- animated layer ----------
  const ctx = canvas.getContext("2d")!;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const surface = grains.filter((g) => g.y > neckY && g !== nowGrain).reduce((m, g) => Math.min(m, g.y), y1);
  const fall = surface - neckY - d;
  const stream = Array.from({ length: 7 }, (_, k) => k / 7);
  let raf = 0, animating = !reduce, t0 = performance.now();

  function draw(now: number) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(stat, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const c = color(life.here);
    if (animating) {
      const phase = ((now - t0) / 1400) % 1;
      ctx.fillStyle = c;
      for (const k of stream) {
        const p = (phase + k) % 1;
        ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.arc(cx + Math.sin(p * 9 + k * 5) * 0.4, neckY + d + p * p * fall, d * 0.34, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // the current week, in the neck
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(nowGrain.x, nowGrain.y, d * 1.15 + 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(nowGrain.x, nowGrain.y, d * 1.15 + 1, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(nowGrain.x, nowGrain.y, d * 1.15, 0, Math.PI * 2); ctx.fill();
    if (hovered && hovered !== nowGrain) {
      ctx.strokeStyle = ink; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(hovered.x, hovered.y, Math.max(d * 0.9, 4), 0, Math.PI * 2); ctx.stroke();
    }
    if (animating) raf = requestAnimationFrame(draw);
  }
  draw(performance.now());

  // pause the animation when off screen
  const io = new IntersectionObserver(([e]) => {
    if (reduce) return;
    if (e.isIntersecting && !animating) { animating = true; t0 = performance.now(); raf = requestAnimationFrame(draw); }
    else if (!e.isIntersecting) { animating = false; cancelAnimationFrame(raf); }
  });
  io.observe(canvas);

  el.replaceChildren(legend(life, () => {}), wrap);
  return () => { cancelAnimationFrame(raf); io.disconnect(); animating = false; };
}
