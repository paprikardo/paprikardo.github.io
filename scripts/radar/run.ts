// Weekly paper radar: fetch → keyword pre-filter → Claude Haiku scoring → src/data/papers/<week>.json
//
// Scoring runs through the Claude Code CLI (`claude -p`), so it uses a Claude Pro/Max subscription:
// locally your normal login, on GitHub the CLAUDE_CODE_OAUTH_TOKEN secret (from `claude setup-token`).
//
//   node scripts/radar/run.ts            # full run
//   node scripts/radar/run.ts --dry-run  # fetch + pre-filter only, no Claude calls, writes nothing
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { tags, type TagId } from "../../src/data/tags.ts";
import { arxiv, biorxiv, pubmed, type Paper } from "./sources.ts";

const MODEL = "haiku"; // Claude Code alias for the latest Haiku
const DAYS = 7;
const MAX_CANDIDATES = 200; // papers sent to Claude per week
const BATCH = 20; // papers per Claude request
const TOP_N = 10;
const MAX_PER_TAG = 3; // diversity cap on the front page
const BACKLOG_N = 25;
const BACKLOG_MIN = 5;

const DRY = process.argv.includes("--dry-run");
const root = new URL("../../", import.meta.url);

// ---------- 1. fetch ----------
const until = new Date();
const since = new Date(until.getTime() - DAYS * 864e5);
const failures: string[] = [];
const settle = async (name: string, p: Promise<Paper[]>) => {
  try {
    const r = await p;
    console.log(`${name}: ${r.length}`);
    return r;
  } catch (e) {
    console.warn(`${name} failed: ${(e as Error).message}`);
    failures.push(name);
    return [];
  }
};
const fetched = (await Promise.all([
  settle("arxiv", arxiv(since)),
  settle("biorxiv", biorxiv(since, until)),
  settle("pubmed", pubmed(DAYS)),
])).flat();

// dedupe by id and by normalised title (PubMed often re-lists preprints)
const seen = new Set<string>();
const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 80);
const papers = fetched.filter((p) => {
  const keys = [p.id, norm(p.title)];
  if (!p.title || keys.some((k) => seen.has(k))) return false;
  keys.forEach((k) => seen.add(k));
  return true;
});

// ---------- 2. keyword pre-filter ----------
const tagEntries = Object.entries(tags) as [TagId, (typeof tags)[TagId]][];
const kwScore = (p: Paper) => {
  const text = ` ${p.title} ${p.title} ${p.abstract} `.toLowerCase(); // title counts double
  return tagEntries.reduce((s, [, t]) => s + t.keywords.filter((k) => text.includes(k)).length, 0);
};
const candidates = papers
  .map((p) => ({ p, s: kwScore(p) }))
  .filter((x) => x.s >= 2)
  .sort((a, b) => b.s - a.s)
  .slice(0, MAX_CANDIDATES)
  .map((x) => x.p);
console.log(`fetched ${fetched.length} → unique ${papers.length} → candidates ${candidates.length}`);

if (DRY) {
  candidates.slice(0, 20).forEach((p, i) => console.log(`${String(i + 1).padStart(2)}. [${p.venue}] ${p.title}`));
  process.exit(0);
}

// ---------- 3. Claude scoring ----------
const tagIds = new Set<string>(tagEntries.map(([id]) => id));
const Scored = z.object({
  papers: z.array(z.object({
    id: z.string(),
    relevance: z.number(),
    tags: z.array(z.string()), // validated against tagIds below
    summary: z.string(),
    gloss: z.string(),
  })),
});

const system =
  readFileSync(new URL("interests.md", import.meta.url), "utf8") +
  "\n\n## Tag ids\n" +
  tagEntries.map(([id, t]) => `- ${id}: ${t.label} — ${t.description}`).join("\n");

const schema = JSON.stringify(z.toJSONSchema(Scored));

// One `claude -p` call per batch: no tools, our own system prompt, schema-validated JSON out.
function claude(prompt: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "claude",
      ["-p", "--model", MODEL, "--tools", "", "--output-format", "json", "--system-prompt", system, "--json-schema", schema],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let out = "", err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => {
      try {
        const env = JSON.parse(out);
        if (code !== 0 || env.is_error) return reject(new Error(`claude exited ${code}: ${String(env.result ?? err).slice(0, 300)}`));
        resolve(env.structured_output);
      } catch {
        reject(new Error(`claude exited ${code}: ${(err || out).slice(0, 300)}`));
      }
    });
    child.stdin.end(prompt);
  });
}

async function score(batch: Paper[], attempt = 1): Promise<z.infer<typeof Scored>["papers"]> {
  const payload = batch.map((p) => ({ id: p.id, title: p.title, venue: p.venue, abstract: p.abstract }));
  try {
    const parsed = Scored.parse(await claude(
      `Score every one of these ${batch.length} papers. Return one entry per id.\n\n${JSON.stringify(payload)}`,
    ));
    return parsed.papers;
  } catch (e) {
    if (attempt < 2) return score(batch, attempt + 1);
    throw e;
  }
}

const batches: Paper[][] = [];
for (let i = 0; i < candidates.length; i += BATCH) batches.push(candidates.slice(i, i + BATCH));
const results: z.infer<typeof Scored>["papers"] = [];
for (let i = 0; i < batches.length; i += 2) {
  const done = await Promise.allSettled(batches.slice(i, i + 2).map((b) => score(b)));
  console.log(`scored ${Math.min(i + 2, batches.length)}/${batches.length} batches`);
  for (const d of done) {
    if (d.status === "fulfilled") results.push(...d.value);
    else console.warn(`batch failed: ${(d.reason as Error).message}`);
  }
}
if (candidates.length && !results.length) {
  console.error("No papers were scored — not writing an empty week.");
  process.exit(1);
}

// ---------- 4. select + write ----------
const byId = new Map(candidates.map((p) => [p.id, p]));
const ranked = results
  .filter((r) => byId.has(r.id))
  .map((r) => ({ ...r, tags: r.tags.filter((t) => tagIds.has(t)) as TagId[], relevance: Math.max(0, Math.min(10, r.relevance)), paper: byId.get(r.id)! }))
  .sort((a, b) => b.relevance - a.relevance);

const perTag = new Map<string, number>();
const picks: typeof ranked = [];
for (const r of ranked) {
  if (picks.length >= TOP_N) break;
  const primary = r.tags[0] ?? "none";
  if ((perTag.get(primary) ?? 0) >= MAX_PER_TAG) continue;
  perTag.set(primary, (perTag.get(primary) ?? 0) + 1);
  picks.push(r);
}
const pickIds = new Set(picks.map((r) => r.id));
const backlog = ranked.filter((r) => !pickIds.has(r.id) && r.relevance >= BACKLOG_MIN).slice(0, BACKLOG_N);

const authors = (a: string[]) => (a.length <= 3 ? a.join(", ") : `${a[0]}, …, ${a[a.length - 1]}`);
const fmtDate = (d: string) =>
  d.length === 10 ? new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : d;
const isoWeek = (d: Date) => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return `${y}-W${String(w).padStart(2, "0")}`;
};
const longDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

const week = isoWeek(until);
const out = {
  week,
  range: `${longDate(since)} – ${longDate(until)}`,
  screened: candidates.length,
  ...(failures.length && { note: `Some sources failed this week: ${failures.join(", ")}.` }),
  generated: until.toISOString(),
  model: "claude-haiku (via Claude Code)",
  picks: picks.map(({ paper: p, ...r }) => ({
    title: p.title,
    authors: authors(p.authors),
    venue: p.venue,
    date: fmtDate(p.date),
    url: p.url,
    ...(p.pdf && { pdf: p.pdf }),
    tags: r.tags,
    label: r.relevance >= 8 ? "read" : "track",
    score: Math.round(r.relevance * 10) / 100,
    summary: r.summary,
    abstract: p.abstract,
  })),
  backlog: backlog.map(({ paper: p, ...r }) => ({ title: p.title, url: p.url, tags: r.tags, gloss: r.gloss })),
};

const file = new URL(`src/data/papers/${week}.json`, root);
writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
console.log(`wrote ${file.pathname}: ${out.picks.length} picks, ${out.backlog.length} backlog`);
