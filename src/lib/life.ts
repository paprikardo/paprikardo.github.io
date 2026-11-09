// Shared life model for every lifetime visualisation: one cell per week, 52 per year of life.
export type PhaseKey = "child" | "youth" | "adult" | "retired" | "inactive";

export type Phase = {
  key: PhaseKey;
  label: string;
  description: string;
  startAge: number;
  endAge: number;
  start: number; // first week index (inclusive)
  end: number; // last week index (exclusive)
};

export type Life = {
  birth: Date;
  today: Date;
  exp: number;
  inactive: number;
  total: number; // weeks in the expected life
  here: number; // index of the current week
  lived: number; // exact weeks since birth
  phases: Phase[];
  phaseOf: (i: number) => Phase;
  info: (i: number) => WeekInfo;
};

export type WeekInfo = {
  index: number;
  age: number;
  weekOfYear: number;
  date: Date;
  phase: Phase;
  when: "past" | "now" | "future";
  relative: string;
};

const PHASES: { key: PhaseKey; label: string; description: string }[] = [
  { key: "child", label: "Childhood", description: "Learning to walk, talk and read — years mostly shaped by others." },
  { key: "youth", label: "Youth", description: "School, first friendships, figuring out who you are." },
  { key: "adult", label: "Adulthood", description: "Work, relationships and the bulk of your independent years." },
  { key: "retired", label: "Retirement", description: "Free time while you are still active and healthy." },
  { key: "inactive", label: "Inactive years", description: "Time when the body slows down and options narrow." },
];
export const CHILD_UNTIL = 12, YOUTH_UNTIL = 21, RETIRE_AT = 65;
const WEEK_MS = 6048e5;

const fmtN = (n: number) => n.toLocaleString("en-US");
export const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function span(weeks: number) {
  const y = Math.floor(weeks / 52), w = weeks % 52;
  if (y === 0) return `${w} week${w === 1 ? "" : "s"}`;
  return w ? `${y} year${y === 1 ? "" : "s"} ${w} week${w === 1 ? "" : "s"}` : `${y} year${y === 1 ? "" : "s"}`;
}

export function makeLife(birth: Date, exp: number, inactive: number, today = new Date()): Life {
  let age = today.getFullYear() - birth.getFullYear();
  const last = new Date(birth);
  last.setFullYear(birth.getFullYear() + age);
  if (last > today) { age--; last.setFullYear(last.getFullYear() - 1); }
  const here = age * 52 + Math.min(51, Math.floor((+today - +last) / WEEK_MS));
  const rows = Math.max(exp, age + 1);
  const total = rows * 52;

  // Phase edges in years. Everything from `inactive` onward is inactive, so earlier phases
  // are cut off there (a phase can end up empty, e.g. retirement when inactive < 65).
  const cut = (a: number) => Math.min(a, inactive, rows);
  const edges = [0, CHILD_UNTIL, YOUTH_UNTIL, RETIRE_AT, inactive];
  const phases: Phase[] = PHASES.map((p, k) => {
    const s = k < 4 ? cut(edges[k]) : Math.min(inactive, rows);
    const e = k < 4 ? cut(edges[k + 1]) : rows;
    return { ...p, startAge: s, endAge: Math.max(s, e), start: s * 52, end: Math.max(s, e) * 52 };
  });

  const phaseOf = (i: number) => phases.find((p) => i >= p.start && i < p.end) ?? phases[4];

  const info = (i: number): WeekInfo => {
    const a = Math.floor(i / 52), w = i % 52;
    const date = new Date(birth);
    date.setFullYear(birth.getFullYear() + a);
    date.setDate(date.getDate() + w * 7);
    const d = i - here;
    return {
      index: i, age: a, weekOfYear: w + 1, date, phase: phaseOf(i),
      when: d < 0 ? "past" : d === 0 ? "now" : "future",
      relative: d === 0 ? "this week" : d < 0 ? `${span(-d)} ago` : `in ${span(d)}`,
    };
  };

  return { birth, today, exp, inactive, total, here, lived: Math.floor((+today - +birth) / WEEK_MS), phases, phaseOf, info };
}

export function describe(w: WeekInfo) {
  return `<b>Week ${fmtN(w.index + 1)}</b> · age ${w.age}, week ${w.weekOfYear}<br>` +
    `<span class="tip-phase tip-${w.phase.key}"></span><b>${w.phase.label}</b> — ${w.phase.description}<br>` +
    `<span class="tip-muted">${fmtDate(w.date)} · ${w.relative}</span>`;
}

export { fmtN };

// ---------- shared hover tooltip ----------
let tip: HTMLDivElement | null = null;
export function showTip(html: string, x: number, y: number) {
  if (!tip) {
    tip = document.createElement("div");
    tip.className = "viz-tip life-root"; // life-root: phase colour tokens for the swatch
    tip.setAttribute("role", "tooltip");
    document.body.appendChild(tip);
  }
  tip.innerHTML = html;
  tip.hidden = false;
  const r = tip.getBoundingClientRect();
  const left = Math.min(window.innerWidth - r.width - 8, Math.max(8, x + 14));
  const top = y + 16 + r.height > window.innerHeight ? y - r.height - 12 : y + 16;
  tip.style.transform = `translate(${left}px, ${top}px)`;
}
export function hideTip() { if (tip) tip.hidden = true; }

/** Read the phase colours from CSS so canvas views follow the theme. */
export function phaseColors(el: Element): Record<PhaseKey, string> {
  const cs = getComputedStyle(el);
  return Object.fromEntries(PHASES.map((p) => [p.key, cs.getPropertyValue(`--phase-${p.key}`).trim()])) as Record<PhaseKey, string>;
}
