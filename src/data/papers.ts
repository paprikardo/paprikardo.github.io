// Loads every week file in src/data/papers/*.json (one file per week, written by the agent).
// File naming: YYYY-Www.json (e.g. 2026-W45.json) so they sort chronologically.
import type { TagId } from "./tags";

export type Pick = {
  title: string;
  authors: string;
  venue: string;
  date: string;
  url: string;
  pdf?: string;
  code?: string;
  tags: TagId[];
  label: "read" | "track";
  score: number | null;
  summary: string;
  abstract?: string;
};

export type BacklogItem = { title: string; url: string; tags: TagId[]; gloss: string };

export type Week = {
  week: string;
  title?: string;
  range: string;
  note?: string;
  screened: number | null;
  picks: Pick[];
  backlog: BacklogItem[];
};

const files = import.meta.glob<Week>("./papers/*.json", { eager: true, import: "default" });

export const weeks: Week[] = Object.entries(files)
  .sort(([a], [b]) => b.localeCompare(a)) // newest first
  .map(([, w]) => w);

export const latest = weeks[0];
