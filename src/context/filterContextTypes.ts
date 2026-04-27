import { createContext } from "react";
import type { Discipline } from "../lib/arrangements";

export type FilterDiscipline = "alle" | Discipline;

export interface FilterContextValue {
  discipline: FilterDiscipline;
  setDiscipline: (d: FilterDiscipline) => void;
}

export const FilterContext = createContext<FilterContextValue | null>(null);
