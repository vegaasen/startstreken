import type { Discipline } from "./arrangements";

export type FilterDiscipline = "alle" | Discipline;

/** Plain text labels for each discipline, used in cards and filter pills. */
export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  landevei: "Landevei",
  terreng: "Terreng",
  langrenn: "Langrenn",
  triathlon: "Triathlon",
  ultraløp: "Ultraløp",
  løping: "Løping",
};

/** Labels with emoji, used in grouped selects (e.g. NavBar). */
export const DISCIPLINE_LABEL_WITH_EMOJI: Record<Discipline, string> = {
  terreng: "🚵 Terreng",
  landevei: "🚴 Landevei",
  langrenn: "⛷️ Langrenn",
  triathlon: "🏊 Triathlon",
  ultraløp: "🏃 Ultraløp",
  løping: "🏃 Løping",
};

/** Labels including the "alle" catch-all filter, used in filter pills. */
export const FILTER_DISCIPLINE_LABEL: Record<FilterDiscipline, string> = {
  alle: "Alle",
  ...DISCIPLINE_LABEL,
};
