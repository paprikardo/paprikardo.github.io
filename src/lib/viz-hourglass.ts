// An hourglass where every grain of sand is one week of life.
// Bottom bulb: weeks already lived, heaped into a mound (oldest at the base → curved strata).
// Top bulb: weeks still ahead, draining through a funnel (next week sits right above the neck).
import { type Life, describe, fmtN, hideTip, phaseColors, showTip } from "./life";

type Grain = { x: number; y: number; i: number; shade: number };

// deterministic noise so the sand looks the same on every render
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hex = (c: string) => {
  const m = c.trim().match(/^#?([0-9a-f]{6})$/i);
  const n = m ? parseInt(m[1], 16) : 0x888888;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const shadeOf = (c: string, k: number) => {
  const [r, g, b] = hex(c);
  const f = (v: number) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
};
const SHADES = [-0.14, -0.07, 0, 0.06, 0.12];

export function legend(life: Life) {
  const box = document.createElement("div");
  box.className = "life-legend";
  for (const p of life.phases) {
    const weeks = p.end - p.start;
    if (!weeks) continue;
    const s = document.createElement("span");
    s.innerHTML = `<span class="swatch sw-${p.key}"></span>${p.label} <small>${p.startAge}–${p.endAge}</small>`;
    box.appendChild(s);
  }
  return box;
}

export function renderHourglass(el: HTMLElement, life: Life): () => void {
  const W = Math.min(el.clientWidth || 360, 380);
  const H = Math.round(W * 1.55);
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  canvas.style.width = `${W}px`;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label",
    `Hourglass of your life: ${fmtN(life.here)} weeks have fallen, ${fmtN(life.total - life.here - 1)} remain.`);

  const cs = getComputedStyle(el);
  const css = (n: string) => cs.getPropertyValue(n).trim();
  const colors = phaseColors(el);
  const ink = cs.color, muted = css("--muted"), bg = css("--bg");
  const dark = (() => { const [r, g, b] = hex(bg); return r + g + b < 384; })();

  // ---------- geometry ----------
  const cx = W / 2, capH = 12, gap = 6;
  const y0 = capH + gap, y1 = H - capH - gap; // inside of the glass
  const neckY = H / 2, h = neckY - y0;
  const maxHalf = W * 0.36, endHalf = W * 0.31;
  let d = 4; // grain diameter, solved below
  const neckHalf = () => Math.max(3, d * 1.25);
  // glass half-width at normalised distance t from the neck (0) to the cap (1):
  // cosine waist into a full bulb, then a gentle shoulder into the cap
  const hw = (t: number) => {
    t = Math.min(1, Math.max(0, t));
    const n = neckHalf();
    if (t < 0.6) return n + (maxHalf - n) * (1 - Math.cos((Math.PI * t) / 0.6)) / 2;
    const u = (t - 0.6) / 0.4;
    return maxHalf - (maxHalf - endHalf) * u * u;
  };

  // hexagonal lattice of grain centres inside one bulb (dir = +1 bottom, -1 top)
  const lattice = (dir: 1 | -1, jitter: () => number) => {
    const pts: { x: number; y: number }[] = [];
    const pitch = d * 0.87;
    for (let r = 0, y = neckY + dir * d * 1.1; dir > 0 ? y < y1 - d * 0.55 : y > y0 + d * 0.55; r++, y += dir * pitch) {
      const half = hw(Math.abs(y - neckY) / h) - d * 0.75;
      const off = r % 2 ? d / 2 : 0;
      for (let x = cx - Math.floor(half / d) * d + off - d; x <= cx + half; x += d) {
        if (Math.abs(x - cx) > half) continue;
        pts.push({ x: x + (jitter() - 0.5) * d * 0.22, y: y + (jitter() - 0.5) * d * 0.22 });
      }
    }
    return pts;
  };
  // largest grain size that still fits a whole life in one bulb
  let lo = 0.8, hi = 12;
  for (let k = 0; k < 24; k++) { d = (lo + hi) / 2; if (lattice(1, () => 0.5).length >= life.total) lo = d; else hi = d; }
  d = lo;

  // ---------- place grains ----------
  const rand = rng(7);
  const grains: Grain[] = [];
  // past: fill order = height above the base + slope·|dx| → a mound with curved strata
  const bottom = lattice(1, rand).sort((a, b) => (y1 - a.y) + 0.4 * Math.abs(a.x - cx) - ((y1 - b.y) + 0.4 * Math.abs(b.x - cx)));
  for (let i = 0; i < life.here && i < bottom.length; i++) grains.push({ ...bottom[i], i, shade: Math.floor(rand() * SHADES.length) });
  // future: fill order = height above the neck − slope·|dx| → sand drains from the centre, funnel-shaped surface
  const top = lattice(-1, rand).sort((a, b) => (neckY - a.y) - 0.2 * Math.abs(a.x - cx) - ((neckY - b.y) - 0.2 * Math.abs(b.x - cx)));
  for (let k = 0, i = life.here + 1; i < life.total && k < top.length; k++, i++) grains.push({ ...top[k], i, shade: Math.floor(rand() * SHADES.length) });
  const nowGrain: Grain = { x: cx, y: neckY, i: life.here, shade: 2 };

  const palette = Object.fromEntries(
    Object.entries(colors).map(([k, c]) => [k, SHADES.map((s) => shadeOf(c, dark ? s * 0.8 : s))]),
  ) as Record<string, string[]>;
  const fillOf = (g: Grain) => palette[life.phaseOf(g.i).key][g.shade];

  // ---------- static layer ----------
  const stat = document.createElement("canvas");
  stat.width = canvas.width; stat.height = canvas.height;
  const s = stat.getContext("2d")!;
  s.scale(dpr, dpr);

  const glassPath = (inset: number) => {
    const p = new Path2D();
    const steps = 120;
    for (let k = 0; k <= steps; k++) { const y = y0 + ((y1 - y0) * k) / steps; const x = cx - hw(Math.abs(y - neckY) / h) - inset; k ? p.lineTo(x, y) : p.moveTo(x, y); }
    for (let k = steps; k >= 0; k--) { const y = y0 + ((y1 - y0) * k) / steps; p.lineTo(cx + hw(Math.abs(y - neckY) / h) + inset, y); }
    p.closePath();
    return p;
  };

  // soft shadow on the "table"
  s.save();
  s.fillStyle = dark ? "rgba(0,0,0,.45)" : "rgba(40,30,10,.12)";
  s.filter = "blur(6px)";
  s.beginPath(); s.ellipse(cx, H - 4, maxHalf + 18, 5, 0, 0, Math.PI * 2); s.fill();
  s.restore();

  // glass body: faint tint
  const outer = glassPath(2.5);
  s.fillStyle = dark ? "rgba(255,255,255,.035)" : "rgba(255,255,255,.55)";
  s.fill(outer);

  // sand
  for (const g of grains) {
    s.fillStyle = fillOf(g);
    s.beginPath(); s.arc(g.x, g.y, d * 0.56, 0, Math.PI * 2); s.fill();
  }

  // glass: outline + sheen
  s.lineWidth = 1.4;
  s.strokeStyle = dark ? "rgba(255,255,255,.28)" : "rgba(30,35,40,.32)";
  s.stroke(outer);
  s.save();
  s.clip(outer);
  const sheen = s.createLinearGradient(cx - maxHalf, 0, cx + maxHalf, 0);
  sheen.addColorStop(0, "rgba(255,255,255,0)");
  sheen.addColorStop(0.16, dark ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.28)");
  sheen.addColorStop(0.24, "rgba(255,255,255,0)");
  sheen.addColorStop(0.85, "rgba(255,255,255,0)");
  sheen.addColorStop(0.92, dark ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.18)");
  s.fillStyle = sheen;
  s.fillRect(0, 0, W, H);
  s.restore();

  // frame: posts + caps
  const capW = maxHalf + 22;
  s.fillStyle = ink;
  s.globalAlpha = 0.55;
  for (const side of [-1, 1]) {
    const x = cx + side * (capW - 6);
    s.beginPath(); s.roundRect(x - 2, capH, 4, H - 2 * capH, 2); s.fill();
  }
  s.globalAlpha = 1;
  for (const y of [0, H - capH]) {
    const grad = s.createLinearGradient(0, y, 0, y + capH);
    grad.addColorStop(0, ink); grad.addColorStop(1, shadeOf(dark ? "#e8e6e1" : "#1d1f23", dark ? -0.35 : 0.25));
    s.fillStyle = grad;
    s.beginPath(); s.roundRect(cx - capW, y, capW * 2, capH, 4); s.fill();
  }

  // ---------- hover lookup ----------
  const cell = Math.max(d, 5);
  const hash = new Map<string, Grain[]>();
  for (const g of [...grains, nowGrain]) {
    const k = `${Math.floor(g.x / cell)},${Math.floor(g.y / cell)}`;
    (hash.get(k) ?? hash.set(k, []).get(k)!).push(g);
  }
  let hovered: Grain | null = null;
  const pick = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
    let best: Grain | null = null, bd = Math.max(d * 1.2, 7) ** 2;
    const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
      for (const g of hash.get(`${gx + a},${gy + b}`) ?? []) {
        const dd = (g.x - x) ** 2 + (g.y - y) ** 2;
        if (dd < bd) { bd = dd; best = g; }
      }
    }
    hovered = best;
    if (best) showTip(describe(life.info(best.i)), e.clientX, e.clientY); else hideTip();
    if (!animating) draw(performance.now());
  };
  canvas.addEventListener("pointermove", pick);
  canvas.addEventListener("pointerdown", pick);
  canvas.addEventListener("pointerleave", () => { hovered = null; hideTip(); if (!animating) draw(performance.now()); });

  // ---------- animated layer: the falling stream ----------
  const ctx = canvas.getContext("2d")!;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const surface = grains.filter((g) => g.y > neckY).reduce((m, g) => Math.min(m, g.y), y1) - d * 0.5;
  const streamColor = palette[life.phaseOf(life.here).key][2];
  const drops = Array.from({ length: 14 }, (_, k) => ({ o: k / 14, dx: (rng(k + 3)() - 0.5) * d * 0.5 }));
  let raf = 0, animating = false;

  function draw(now: number) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(stat, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (life.here < life.total) {
      // thin continuous trickle + a few loose grains
      ctx.strokeStyle = streamColor; ctx.globalAlpha = 0.55; ctx.lineWidth = Math.max(1, d * 0.35);
      ctx.beginPath(); ctx.moveTo(cx, neckY + d); ctx.lineTo(cx, surface); ctx.stroke();
      ctx.globalAlpha = 1; ctx.fillStyle = streamColor;
      const t = reduce ? 0 : (now / 1100) % 1;
      for (const p of drops) {
        const k = (t + p.o) % 1;
        ctx.beginPath(); ctx.arc(cx + p.dx * k, neckY + d + k * k * (surface - neckY - d), d * 0.42, 0, Math.PI * 2); ctx.fill();
      }
      // this week: the grain passing through the neck
      ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(cx, neckY, d * 0.95 + 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, neckY, d * 0.95 + 1.5, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = streamColor; ctx.beginPath(); ctx.arc(cx, neckY, d * 0.95, 0, Math.PI * 2); ctx.fill();
    }
    if (hovered && hovered !== nowGrain) {
      ctx.strokeStyle = ink; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(hovered.x, hovered.y, Math.max(d * 0.95, 4), 0, Math.PI * 2); ctx.stroke();
    }
    if (animating) raf = requestAnimationFrame(draw);
  }
  draw(performance.now());

  // animate only while visible
  const io = new IntersectionObserver(([e]) => {
    if (reduce) return;
    if (e.isIntersecting && !animating) { animating = true; raf = requestAnimationFrame(draw); }
    else if (!e.isIntersecting && animating) { animating = false; cancelAnimationFrame(raf); }
  });
  io.observe(canvas);

  // labels above and below, in HTML so they stay crisp and selectable
  const label = (cls: string, title: string, weeks: number) => {
    const p = document.createElement("p");
    p.className = `hg-label ${cls}`;
    p.innerHTML = `<b>${title}</b> <span class="mono muted">${fmtN(weeks)} weeks</span>`;
    return p;
  };
  const wrap = document.createElement("div");
  wrap.className = "hg-wrap";
  wrap.append(label("hg-future", "Still ahead", Math.max(0, life.total - life.here - 1)), canvas, label("hg-past", "Lived", life.here));
  el.replaceChildren(wrap, legend(life));
  return () => { cancelAnimationFrame(raf); io.disconnect(); animating = false; };
}
