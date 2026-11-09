// Clickable cards on the home page, grouped into sections.
// To add a card, append an object to a section. To add a section, add an entry to `sections`.
// `href` can be an internal page (create src/pages/<name>.astro) or any external URL.
export type Panel = {
  title: string;
  description: string;
  href: string;
  emoji?: string;
  meta?: string; // small monospace line, e.g. "bioRxiv · 2026" or "GitHub · Python"
};

export type Section = { id: string; title: string; panels: Panel[] };

export const sections: Section[] = [
  {
    id: "projects",
    title: "Projects",
    panels: [
      {
        title: "AF3 protein–protein bond modelling",
        description:
          "Models covalent protein–protein bonds in AlphaFold3 inputs by turning bonded residues into ligand bridges and splitting chains accordingly.",
        href: "https://github.com/paprikardo/af3-protein-protein-bond",
        emoji: "🔗",
        meta: "GitHub · Python",
      },
      {
        title: "Capabilities, specificity gaps and training-data dependence of AlphaFold3 across diverse application areas",
        description:
          "Community assessment of AlphaFold3 across application areas; the protein–protein bond modelling tool is part of this work.",
        href: "https://doi.org/10.64898/2026.07.13.738147",
        emoji: "📄",
        meta: "Follonier, O., …, Heinzmann, R., …, Beltrao, P. · bioRxiv · 2026",
      },
    ],
  },
  {
    id: "others",
    title: "Others",
    panels: [
      {
        title: "Lifetime calculator",
        description: "Your life as an hourglass — one grain of sand per week.",
        href: "/lifetime/",
        emoji: "⏳",
      },
    ],
  },
];
