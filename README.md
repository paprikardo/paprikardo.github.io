# ricardoheinzmann.com

Personal site: weekly protein-design paper radar, small projects, profile.
Built with [Astro](https://astro.build) — outputs plain static HTML, no framework runtime.

## Develop

```sh
npm install
npm run dev      # http://localhost:4321, live reload (Astro 7 runs it in the background; stop with: npx astro dev stop)
npm run build    # static site in dist/
```

## Where to change things

| Want to change…                | Edit                                   |
| ------------------------------ | -------------------------------------- |
| Name, bio, photo, LinkedIn     | `src/data/profile.ts`, `public/profile.jpg` |
| Colours, fonts, spacing, dark mode | `src/styles/theme.css` (tokens at the top) |
| Home-page project panels       | `src/data/panels.ts` (+ a page in `src/pages/`) |
| Paper-radar interest tags      | `src/data/tags.ts`                     |
| Page shell / nav               | `src/layouts/Base.astro`               |
| Paper card look                | `src/components/PaperCard.astro`       |

## Paper radar data

One JSON file per week in `src/data/papers/`, named `YYYY-Www.json` (e.g. `2026-W45.json`).
The newest file is shown on the home page; all files appear in `/archive/`.
`0000-seed.json` is a hand-picked starter set — delete it once real weeks exist.

```jsonc
{
  "week": "2026-W45",
  "range": "3 – 9 November 2026",
  "screened": 164,                 // or null
  "note": "optional warning text",
  "picks": [{
    "title": "", "authors": "", "venue": "", "date": "", "url": "",
    "pdf": "", "code": "",           // optional
    "tags": ["plm"],                 // ids from src/data/tags.ts
    "label": "read",                 // "read" | "track"
    "score": 0.87,                   // or null
    "summary": "one sentence",
    "abstract": ""                   // optional
  }],
  "backlog": [{ "title": "", "url": "", "tags": [], "gloss": "short note" }]
}
```
