// The clickable panels on the home page. To add one, append an object.
// `href` can be an internal page (create src/pages/<name>.astro) or any external URL.
export type Panel = {
  title: string;
  description: string;
  href: string;
  emoji?: string;
};

export const panels: Panel[] = [
  {
    title: "Lifetime calculator",
    description: "Your life in weeks — one dot per week, one row per year.",
    href: "/lifetime/",
    emoji: "⏳",
  },
  // {
  //   title: "Next project",
  //   description: "Short teaser text.",
  //   href: "/next-project/",
  //   emoji: "🧪",
  // },
];
