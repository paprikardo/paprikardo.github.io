// Fetch last week's papers from arXiv, bioRxiv and PubMed. No API keys needed.
export type Paper = {
  id: string; // stable key: doi or arXiv id
  title: string;
  abstract: string;
  authors: string[];
  venue: string;
  date: string; // YYYY-MM-DD
  url: string;
  pdf?: string;
};

const UA = { "User-Agent": "ricardoheinzmann.com-paper-radar/1.0" };

async function get(url: string, retries = 3): Promise<Response> {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(150_000) });
      if (r.ok) return r;
      if (i >= retries || r.status < 500) throw new Error(`HTTP ${r.status} for ${url}`);
    } catch (e) {
      if (i >= retries) throw e;
    }
    await new Promise((res) => setTimeout(res, 2000 * (i + 1)));
  }
}

const clean = (s: string) =>
  s.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
   .replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] ?? "";
const tagsAll = (xml: string, name: string) =>
  [...xml.matchAll(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "g"))].map((m) => m[1]);
const ymd = (d: Date) => d.toISOString().slice(0, 10);

// ---------- arXiv ----------
export async function arxiv(since: Date): Promise<Paper[]> {
  const q = "(cat:q-bio.BM OR cat:q-bio.QM OR cat:q-bio.MN OR cat:cs.LG OR cat:physics.bio-ph) AND (abs:protein OR abs:enzyme)";
  const url = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(q)}&sortBy=submittedDate&sortOrder=descending&max_results=400`;
  const xml = await (await get(url)).text();
  return tagsAll(xml, "entry")
    .map((e) => {
      const absUrl = clean(tag(e, "id")).replace("http://", "https://");
      const id = absUrl.split("/abs/")[1]?.replace(/v\d+$/, "") ?? absUrl;
      return {
        id: `arxiv:${id}`,
        title: clean(tag(e, "title")),
        abstract: clean(tag(e, "summary")),
        authors: tagsAll(e, "name").map(clean),
        venue: "arXiv",
        date: clean(tag(e, "published")).slice(0, 10),
        url: `https://arxiv.org/abs/${id}`,
        pdf: `https://arxiv.org/pdf/${id}`,
      };
    })
    .filter((p) => p.date >= ymd(since));
}

// ---------- bioRxiv ----------
// The API is slow (~30 s per page of 30), so query only relevant categories, in parallel.
const BIORXIV_CATS = ["bioinformatics", "synthetic_biology", "biochemistry", "bioengineering", "biophysics"];

export async function biorxiv(since: Date, until: Date): Promise<Paper[]> {
  const base = `https://api.biorxiv.org/details/biorxiv/${ymd(since)}/${ymd(until)}`;
  const category = async (cat: string) => {
    const rows: any[] = [];
    for (let cursor = 0; ; ) {
      const d = (await (await get(`${base}/${cursor}?category=${cat}`)).json()) as any;
      const batch: any[] = d.collection ?? [];
      rows.push(...batch);
      cursor += batch.length;
      if (!batch.length || cursor >= Number(d.messages?.[0]?.total ?? 0)) break;
    }
    return rows;
  };
  const rows = (await Promise.all(BIORXIV_CATS.map(category))).flat();
  const byDoi = new Map<string, Paper>();
  for (const r of rows) {
    if (String(r.version) !== "1") continue; // only genuinely new preprints
    byDoi.set(r.doi, {
      id: `doi:${r.doi.toLowerCase()}`,
      title: clean(r.title),
      abstract: clean(r.abstract ?? ""),
      authors: String(r.authors ?? "").split(";").map((a: string) => a.trim()).filter(Boolean),
      venue: "bioRxiv",
      date: r.date,
      url: `https://doi.org/${r.doi}`,
      pdf: `https://www.biorxiv.org/content/${r.doi}v${r.version}.full.pdf`,
    });
  }
  return [...byDoi.values()];
}

// ---------- PubMed ----------
export async function pubmed(days: number): Promise<Paper[]> {
  const term = [
    '"protein design"', '"enzyme design"', '"protein engineering"', '"protein language model"',
    '"structure prediction"', "alphafold", "flavoenzyme", "flavin", '"ene-reductase"',
    '"directed evolution"', '"deep mutational scanning"', '"machine learning" AND protein',
  ].map((t) => `(${t}[tiab])`).join(" OR ");
  const es = await (await get(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=300&datetype=edat&reldate=${days}&term=${encodeURIComponent(term)}`,
  )).json() as any;
  const ids: string[] = es.esearchresult?.idlist ?? [];
  const out: Paper[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const xml = await (await get(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&retmode=xml&id=${ids.slice(i, i + 100).join(",")}`,
    )).text();
    for (const a of tagsAll(xml, "PubmedArticle")) {
      const pmid = clean(tag(a, "PMID"));
      const doi = a.match(/<ArticleId IdType="doi">([^<]+)<\/ArticleId>/)?.[1];
      const authors = tagsAll(a, "Author").map((x) => `${clean(tag(x, "LastName"))}, ${clean(tag(x, "Initials"))}`.replace(/^, |, $/, ""));
      const y = clean(tag(tag(a, "PubDate"), "Year")) || new Date().getFullYear().toString();
      out.push({
        id: doi ? `doi:${doi.toLowerCase()}` : `pmid:${pmid}`,
        title: clean(tag(a, "ArticleTitle")),
        abstract: tagsAll(a, "AbstractText").map(clean).join(" "),
        authors,
        venue: clean(tag(tag(a, "Journal"), "ISOAbbreviation")) || clean(tag(tag(a, "Journal"), "Title")),
        date: y,
        url: doi ? `https://doi.org/${doi}` : `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      });
    }
  }
  return out.filter((p) => p.abstract);
}
